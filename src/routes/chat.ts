import { Hono } from 'hono';
import type { Json } from '../database.types.js';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { createMinimax } from 'vercel-minimax-ai-provider';
import { streamText, stepCountIs, convertToModelMessages, type LanguageModel } from 'ai';
import { tools } from '../agent/tools.js';
import { supabase } from '../lib/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import type { AuthVariables, AiConfig } from '../types.js';

const chatRouter = new Hono<{ Variables: AuthVariables }>();

const minimax = createMinimax({ apiKey: process.env.MINIMAX_API_KEY });

type ModelConfig = {
  model: () => LanguageModel;
  label: string;
  provider: string;
  description: string;
  maxMessages?: number;
};

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-haiku-4-5': {
    model: () => anthropic(process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'),
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    description: 'Preciso, rápido en razonamiento estructurado',
  },
  'gemini-2.5-flash': {
    model: () => google(process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'),
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Muy rápido, ideal para consultas simples',
  },
  'kimi-k2': {
    model: () => groq('moonshotai/kimi-k2-instruct'),
    label: 'Kimi K2',
    provider: 'Groq',
    description: '128k contexto, código abierto',
    maxMessages: 10,
  },
  'minimax-m2': {
    model: () => minimax(process.env.MINIMAX_MODEL ?? 'MiniMax-M2.5'),
    label: 'MiniMax M2.5',
    provider: 'MiniMax',
    description: 'Modelo de respaldo',
  },
};

export const AVAILABLE_MODELS = Object.entries(MODEL_CONFIGS).map(([id, cfg]) => ({
  id,
  label: cfg.label,
  provider: cfg.provider,
  description: cfg.description,
}));

export const DEFAULT_MODEL = 'claude-haiku-4-5';

// Hard cap on conversation history sent to the LLM to avoid huge prompts/costs.
const DEFAULT_MAX_MESSAGES = 50;

// ── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * Resolves which model to use given the requested model id.
 * Falls back to DEFAULT_MODEL if the requested id is not in MODEL_CONFIGS.
 */
export function resolveModelId(requestedId: string): string {
  return requestedId in MODEL_CONFIGS ? requestedId : DEFAULT_MODEL;
}

/**
 * Builds the system prompt, optionally appending user-defined extra instructions.
 */
export function buildSystemPromptText(systemPromptExtra?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const base = `Eres un asistente especializado en precios mayoristas de frutas y hortalizas del Mercado Lo Valledor, basado en datos oficiales de ODEPA (Oficina de Estudios y Políticas Agrarias).

Fecha actual: ${today}. Los datos llegan hasta esta fecha. Cuando el usuario diga "hoy" o "ahora", usa ${today} como referencia.

MERCADO POR DEFECTO — REGLA CRÍTICA:
- A menos que el usuario indique explícitamente otro mercado, SIEMPRE consulta y presenta datos del Mercado Lo Valledor.
- Si el usuario nombra otro mercado explícitamente, usa ese mercado para esa consulta.
- Nunca mezcles datos de múltiples mercados sin que el usuario lo haya pedido.

ALCANCE DEL ASISTENTE — REGLA CRÍTICA:
- Solo puedes responder preguntas relacionadas con precios, productos y tendencias en mercados mayoristas.
- Fuera de ese ámbito (clima, recetas, política, etc.): responde brevemente que solo puedes ayudar con precios mayoristas.
- No inventes información. Si los datos no existen en la base de datos, dilo claramente.

INSTRUCCIONES OPERATIVAS:
1. Cuando el usuario pregunte por precios, SIEMPRE usa las herramientas disponibles ANTES de responder.
2. Después de recibir resultados de herramientas, SIEMPRE genera una respuesta de texto completa en español.
3. NUNCA devuelvas una respuesta vacía después de usar una herramienta.
4. Si los datos existen, resúmelos claramente. Si no, explica por qué.

Responde en español neutro, claro y directo.
Indica siempre: "Datos: ODEPA · Mercado Lo Valledor" y la fecha del último registro.`;

  if (systemPromptExtra?.trim()) {
    return `${base}\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${systemPromptExtra.trim()}`;
  }
  return base;
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────
chatRouter.post('/', optionalAuth, async (c) => {
  const body = await c.req.json();
  const rawMessages: unknown[] = body.messages ?? [];
  const requestedModelId: string = body.modelId ?? DEFAULT_MODEL;
  const threadId: string | undefined = body.threadId;
  const userId = c.get('userId'); // '' para invitados
  const aiConfig = c.get('aiConfig') as AiConfig;
  const modelId = resolveModelId(requestedModelId);

  // Load historical messages from DB
  let historicalMessages: unknown[] = [];
  if (threadId && userId) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(DEFAULT_MAX_MESSAGES);

    if (!error && data) {
      historicalMessages = data.map((r) => r.content).reverse();
    }
  }

  const allMessages = [...historicalMessages, ...rawMessages];
  const config = MODEL_CONFIGS[modelId] ?? MODEL_CONFIGS[DEFAULT_MODEL];
  const effectiveMax = config.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const messages = allMessages.slice(-effectiveMax);

  // Persist new user messages before streaming
  if (threadId && userId) {
    const userMsgs = rawMessages.filter(
      (m): m is Record<string, unknown> =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>).role === 'user' &&
        typeof (m as Record<string, unknown>).id === 'string'
    );
    if (userMsgs.length) {
      await supabase.from('chat_messages').upsert(
        userMsgs.map((m) => ({
          id: m.id as string,
          thread_id: threadId,
          role: 'user' as const,
          content: m as unknown as Json,
        })),
        { onConflict: 'id', ignoreDuplicates: true }
      );
    }
  }

  // Apply ai_config: temperature + optional system_prompt_extra
  const systemPrompt = buildSystemPromptText(aiConfig.system_prompt_extra);
  const streamOptions: Parameters<typeof streamText>[0] = {
    model: config.model(),
    system: systemPrompt,
    messages: await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0]
    ),
    tools,
    stopWhen: stepCountIs(5),
    onError: (err) => console.error('[chat] error:', err),
    onFinish: async ({ text, response }) => {
      if (!threadId || !userId || !userId.length) return;

      const assistantId =
        (response.messages.findLast((m) => m.role === 'assistant') as { id?: string } | undefined)
          ?.id ?? crypto.randomUUID();

      await supabase
        .from('chat_messages')
        .insert({
          id: assistantId,
          thread_id: threadId,
          role: 'assistant',
          content: {
            id: assistantId,
            role: 'assistant',
            content: text,
            parts: [{ type: 'text', text }],
          },
        })
        .then(({ error }) => {
          if (error) console.error('[chat] save assistant msg:', error.message);
        });

      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
        .eq('user_id', userId);
    },
  };

  if (typeof aiConfig.temperature === 'number') {
    (streamOptions as Record<string, unknown>).temperature = aiConfig.temperature;
  }

  const result = streamText(streamOptions);
  return result.toUIMessageStreamResponse();
});

// Expose model list to frontend (filtered by role if auth header present)
chatRouter.get('/models', (c) => {
  return c.json({ models: AVAILABLE_MODELS, default: DEFAULT_MODEL });
});

export { chatRouter };
