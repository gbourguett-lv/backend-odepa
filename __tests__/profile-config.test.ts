import { describe, it, expect } from '@jest/globals';
import {
  resolveModelId,
  checkDailyLimit,
  buildSystemPromptText,
  chatRouter,
} from '../src/routes/chat.js';
import { profileRouter } from '../src/routes/profile.js';

// ── 5.1  Free user model restriction ─────────────────────────────────────────
describe('resolveModelId', () => {
  it('forces gemini-2.5-flash for free users regardless of requested model', () => {
    expect(resolveModelId('claude-haiku-4-5', 'free')).toBe('gemini-2.5-flash');
    expect(resolveModelId('kimi-k2', 'free')).toBe('gemini-2.5-flash');
    expect(resolveModelId('minimax-m2', 'free')).toBe('gemini-2.5-flash');
  });

  it('respects requested model for premium users', () => {
    expect(resolveModelId('claude-haiku-4-5', 'premium')).toBe('claude-haiku-4-5');
    expect(resolveModelId('kimi-k2', 'premium')).toBe('kimi-k2');
  });

  it('falls back to default for unknown model ids (any role)', () => {
    expect(resolveModelId('nonexistent-model', 'premium')).toBe('claude-haiku-4-5');
  });
});

// ── 5.2  Daily message limit ──────────────────────────────────────────────────
describe('checkDailyLimit', () => {
  const TODAY = '2026-04-13';

  it('blocks free user at 20 messages', () => {
    expect(checkDailyLimit(20, TODAY, TODAY, 'free').limited).toBe(true);
    expect(checkDailyLimit(25, TODAY, TODAY, 'free').limited).toBe(true);
  });

  it('allows free user below the limit', () => {
    expect(checkDailyLimit(0, TODAY, TODAY, 'free').limited).toBe(false);
    expect(checkDailyLimit(19, TODAY, TODAY, 'free').limited).toBe(false);
  });

  it('never limits premium users', () => {
    expect(checkDailyLimit(100, TODAY, TODAY, 'premium').limited).toBe(false);
  });

  it('resets counter when date has changed', () => {
    const result = checkDailyLimit(20, '2026-04-12', TODAY, 'free');
    expect(result.shouldReset).toBe(true);
    expect(result.limited).toBe(false); // reset brings count to 0
  });

  it('does not reset when date is current', () => {
    const result = checkDailyLimit(5, TODAY, TODAY, 'free');
    expect(result.shouldReset).toBe(false);
  });
});

// ── 5.4  Auth middleware — 401 without token ─────────────────────────────────
describe('requireAuth — 401 enforcement', () => {
  it('GET /api/profile returns 401 when Authorization header is missing', async () => {
    const res = await profileRouter.request('http://localhost/');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/profile returns 401 when Authorization header is missing', async () => {
    const res = await profileRouter.request('http://localhost/', { method: 'PATCH' });
    expect(res.status).toBe(401);
  });

  it('POST /api/chat returns 401 when Authorization header is missing', async () => {
    const res = await chatRouter.request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(401);
  });
});

// ── 5.3  AI config — system prompt extra ─────────────────────────────────────
describe('buildSystemPromptText', () => {
  it('returns base prompt without extra', () => {
    const prompt = buildSystemPromptText();
    expect(prompt).toContain('ODEPA');
    expect(prompt).toContain('Lo Valledor');
  });

  it('appends system_prompt_extra when provided', () => {
    const prompt = buildSystemPromptText('Responde siempre en bullet points');
    expect(prompt).toContain('Responde siempre en bullet points');
  });

  it('does not add extra section when undefined', () => {
    const withExtra = buildSystemPromptText('extra text');
    const withoutExtra = buildSystemPromptText();
    expect(withExtra.length).toBeGreaterThan(withoutExtra.length);
  });
});
