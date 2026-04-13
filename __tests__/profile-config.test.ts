import { describe, it, expect } from '@jest/globals';
import {
  resolveModelId,
  buildSystemPromptText,
  DEFAULT_MODEL,
  chatRouter,
} from '../src/routes/chat.js';
import { profileRouter } from '../src/routes/profile.js';

// ── 5.1  Model resolution ─────────────────────────────────────────────────────
describe('resolveModelId', () => {
  it('returns the requested model when it is valid', () => {
    expect(resolveModelId('claude-haiku-4-5')).toBe('claude-haiku-4-5');
    expect(resolveModelId('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(resolveModelId('kimi-k2')).toBe('kimi-k2');
    expect(resolveModelId('minimax-m2')).toBe('minimax-m2');
  });

  it('falls back to DEFAULT_MODEL for unknown model ids', () => {
    expect(resolveModelId('nonexistent-model')).toBe(DEFAULT_MODEL);
    expect(resolveModelId('')).toBe(DEFAULT_MODEL);
    expect(resolveModelId('gpt-4')).toBe(DEFAULT_MODEL);
  });
});

// ── 5.2  Auth middleware — 401 without token ─────────────────────────────────
describe('requireAuth — 401 enforcement', () => {
  it('GET /api/profile returns 401 when Authorization header is missing', async () => {
    const res = await profileRouter.request('http://localhost/');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/profile returns 401 when Authorization header is missing', async () => {
    const res = await profileRouter.request('http://localhost/', { method: 'PATCH' });
    expect(res.status).toBe(401);
  });

  it('POST /api/chat accepts requests without auth (optionalAuth)', async () => {
    const res = await chatRouter.request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    // optionalAuth allows unauthenticated requests — should not be 401
    expect(res.status).not.toBe(401);
  });
});

// ── 5.3  System prompt ───────────────────────────────────────────────────────
describe('buildSystemPromptText', () => {
  it('returns base prompt containing ODEPA and Lo Valledor', () => {
    const prompt = buildSystemPromptText();
    expect(prompt).toContain('ODEPA');
    expect(prompt).toContain('Lo Valledor');
  });

  it('appends system_prompt_extra when provided', () => {
    const prompt = buildSystemPromptText('Responde siempre en bullet points');
    expect(prompt).toContain('Responde siempre en bullet points');
  });

  it('is longer with extra than without', () => {
    const withExtra = buildSystemPromptText('extra text');
    const withoutExtra = buildSystemPromptText();
    expect(withExtra.length).toBeGreaterThan(withoutExtra.length);
  });

  it('ignores empty or whitespace-only extra', () => {
    const withEmpty = buildSystemPromptText('   ');
    const withoutExtra = buildSystemPromptText();
    expect(withEmpty).toBe(withoutExtra);
  });
});
