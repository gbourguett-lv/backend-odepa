import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseRaw } from '../lib/supabase.js';
import type { AuthVariables, AiConfig } from '../types.js';

const profileRouter = new Hono<{ Variables: AuthVariables }>();

profileRouter.use('*', requireAuth);

// ── GET /api/profile ──────────────────────────────────────────────────────────
profileRouter.get('/', async (c) => {
  const userId = c.get('userId') as string;

  const { data, error } = await supabaseRaw
    .from('user_profiles')
    .select('role, ai_config, preferred_model, messages_today, messages_today_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  // Return defaults if profile doesn't exist yet
  if (!data) {
    return c.json({
      role: 'free',
      ai_config: {},
      preferred_model: 'gemini-2.5-flash',
      messages_today: 0,
      messages_today_date: new Date().toISOString().slice(0, 10),
    });
  }

  return c.json(data);
});

// ── PATCH /api/profile ────────────────────────────────────────────────────────
profileRouter.patch('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<{ ai_config?: AiConfig; preferred_model?: string }>();

  const updates: Record<string, unknown> = {};
  if (body.ai_config !== undefined) updates.ai_config = body.ai_config;
  if (body.preferred_model !== undefined) updates.preferred_model = body.preferred_model;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  const { error } = await supabaseRaw.from('user_profiles').update(updates).eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

export { profileRouter };
