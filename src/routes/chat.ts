import { Hono } from 'hono';
import type { Json } from '../database.types.js';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { createMinimax } from 'vercel-minimax-ai-provider';
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type LanguageModel,
  type ErrorHandler,
} from 'ai';
import { tools } from '../agent/tools.js';
import { supabase } from '../lib/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
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
  const base = `Eres un asistente especializado en precios mayoristas de frutas y hortalizas de Chile, basado en datos oficiales de ODEPA (Oficina de Estudios y Políticas Agrarias). Cubres los 12 mercados mayoristas del país.

Fecha actual: ${today}. Los datos llegan hasta esta fecha. Cuando el usuario diga "hoy" o "ahora", usa ${today} como referencia.

MERCADO POR DEFECTO — REGLA CRÍTICA:
- A menos que el usuario indique explícitamente otro mercado, SIEMPRE consulta y presenta datos del Mercado Lo Valledor.
- Si el usuario nombra otro mercado explícitamente (ej: "Vega Central", "Temuco", "Concepción"), usa ese mercado para esa consulta.
- Si el usuario pide comparar mercados, consulta cada uno por separado y presenta los resultados diferenciados.
- Nunca mezcles datos de múltiples mercados en una misma tabla sin que el usuario lo haya pedido.

MERCADOS DISPONIBLES: Lo Valledor (Santiago), Vega Central Mapocho (Santiago), Mapocho venta directa (Santiago), Vega Monumental (Concepción), Vega Modelo (Temuco), Macroferia Regional (Talca), Femacal (La Calera), Terminal La Palmera (La Serena), Solcoagro (Ovalle), Feria Lagunitas (Puerto Montt), Agro Chillán, Agrícola del Norte (Arica). Usa get_markets para obtener la lista completa.

ALCANCE DEL ASISTENTE — REGLA CRÍTICA:
- Solo puedes responder preguntas relacionadas con precios, productos y tendencias en mercados mayoristas.
- Fuera de ese ámbito (clima, recetas, política, etc.): responde brevemente que solo puedes ayudar con precios mayoristas.
- No inventes información. Si los datos no existen en la base de datos, dilo claramente.

INSTRUCCIONES OPERATIVAS:
1. Cuando el usuario pregunte por precios, SIEMPRE usa las herramientas disponibles ANTES de responder.
2. Después de recibir resultados de herramientas, SIEMPRE genera una respuesta de texto completa en español.
3. NUNCA devuelvas una respuesta vacía después de usar una herramienta.
4. Si los datos existen, resúmelos claramente indicando el mercado y la fecha. Si no, explica por qué.

Responde en español neutro, claro y directo.
Indica siempre la fuente: "Datos: ODEPA · {nombre del mercado consultado}" y la fecha del último registro.`;

  if (systemPromptExtra?.trim()) {
    return `${base}\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${systemPromptExtra.trim()}`;
  }
  return base;
}

// ── Error classification ──────────────────────────────────────────────────────

type ErrorClass = 'tool' | 'llm' | 'network' | 'auth' | 'unknown';

function classifyError(err: unknown): { cls: ErrorClass; message: string } {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name;

    // Tool execution errors (from AI SDK tool calls)
    if (name === 'ToolExecutionError' || msg.includes('tool')) {
      return { cls: 'tool', message: err.message };
    }

    // LLM provider errors (rate limit, content filter, invalid request)
    if (
      msg.includes('rate limit') ||
      msg.includes('content filter') ||
      msg.includes('blocked') ||
      msg.includes('overloaded') ||
      msg.includes('too many tokens') ||
      name.includes('AI') ||
      name.includes('LanguageModel')
    ) {
      return { cls: 'llm', message: err.message };
    }

    // Network / connectivity errors
    if (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket') ||
      msg.includes('connection') ||
      name === 'FetchError'
    ) {
      return { cls: 'network', message: err.message };
    }

    // Auth / permission errors
    if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403')) {
      return { cls: 'auth', message: err.message };
    }

    return { cls: 'unknown', message: err.message };
  }

  return { cls: 'unknown', message: String(err) };
}

const errorHandler: ErrorHandler = ({ error }) => {
  const { cls, message } = classifyError(error);

  switch (cls) {
    case 'tool':
      console.error('[chat][tool-error]', message);
      break;
    case 'llm':
      console.error('[chat][llm-error]', message);
      break;
    case 'network':
      console.error('[chat][network-error]', message);
      break;
    case 'auth':
      console.error('[chat][auth-error]', message);
      break;
    default:
      console.error('[chat][unknown-error]', message);
  }
};

// ── Chat endpoint ─────────────────────────────────────────────────────────────
chatRouter.post('/', optionalAuth, rateLimit, async (c) => {
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
    stopWhen: stepCountIs(3),
    onError: errorHandler,
    onFinish: async ({ text, response }) => {
      if (!threadId || !userId || !userId.length) return;

      const assistantId =
        (response.messages.findLast((m) => m.role === 'assistant') as { id?: string } | undefined)
          ?.id ?? crypto.randomUUID();

      const { error: insertError } = await supabase.from('chat_messages').insert({
        id: assistantId,
        thread_id: threadId,
        role: 'assistant',
        content: {
          id: assistantId,
          role: 'assistant',
          content: text,
          parts: [{ type: 'text', text }],
        },
      });

      if (insertError) {
        const { cls } = classifyError(insertError);
        console.error(`[chat][db-save][${cls}]`, insertError.message);
      }

      const { error: updateError } = await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[chat][thread-update]', updateError.message);
      }
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
