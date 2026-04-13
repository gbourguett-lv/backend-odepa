import { createMiddleware } from 'hono/factory';
import { supabase, supabaseRaw } from '../lib/supabase.js';
import type { AiConfig, AuthVariables } from '../types.js';

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = header.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('userId', user.id);

  // Load user profile — use defaults if not found yet (e.g. trigger hasn't run)
  const { data: profile } = await supabaseRaw
    .from('user_profiles')
    .select('role, ai_config, preferred_model')
    .eq('user_id', user.id)
    .maybeSingle();

  c.set('userRole', profile?.role ?? 'free');
  c.set('aiConfig', (profile?.ai_config as AiConfig | null) ?? {});

  await next();
});

// Middleware opcional: si hay token válido lo usa, si no pasa como invitado (free, sin userId).
// Permite que usuarios no autenticados usen el chat sin guardar historial.
export const optionalAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header('Authorization');

  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      c.set('userId', user.id);

      const { data: profile } = await supabaseRaw
        .from('user_profiles')
        .select('role, ai_config, preferred_model')
        .eq('user_id', user.id)
        .maybeSingle();

      c.set('userRole', profile?.role ?? 'free');
      c.set('aiConfig', (profile?.ai_config as AiConfig | null) ?? {});
      await next();
      return;
    }
  }

  // Sin token o token inválido → invitado con rol free
  c.set('userId', '');
  c.set('userRole', 'free');
  c.set('aiConfig', {});
  await next();
});
