import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../lib/supabase.js';
import type { AuthVariables } from '../types.js';

const threadsRouter = new Hono<{ Variables: AuthVariables }>();

threadsRouter.use('*', requireAuth);

// ── List threads ──────────────────────────────────────────────────────────────
threadsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, archived, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ threads: data });
});

// ── Upsert thread (called by adapter.initialize) ──────────────────────────────
threadsRouter.post('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const { error } = await supabase
    .from('chat_threads')
    .upsert(
      { id, user_id: userId, title: 'Nueva conversación' },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ id });
});

// ── Get messages for a thread ─────────────────────────────────────────────────
threadsRouter.get('/:id/messages', async (c) => {
  const userId = c.get('userId');
  const threadId = c.req.param('id');

  // Verify ownership
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .single();

  if (!thread) return c.json({ error: 'Not found' }, 404);

  const { data, error } = await supabase
    .from('chat_messages')
    .select('content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  // content is a full UIMessage stored as JSONB — return as-is
  const messages = (data ?? []).map((r) => r.content);

  return c.json({ messages });
});

// ── Rename thread ─────────────────────────────────────────────────────────────
threadsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const threadId = c.req.param('id');
  const body = await c.req.json<{ title?: string; archived?: boolean }>();

  const { error } = await supabase
    .from('chat_threads')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// ── Delete thread ─────────────────────────────────────────────────────────────
threadsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const threadId = c.req.param('id');

  const { error } = await supabase
    .from('chat_threads')
    .delete()
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

export { threadsRouter };
