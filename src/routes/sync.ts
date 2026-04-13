import { Hono } from 'hono';
import { supabase, TABLE } from '../lib/supabase.js';
import { getLastSyncedDate, runBackfill, runWeeklySync, isSyncRunning } from '../scraper/sync.js';

const syncRouter = new Hono();

syncRouter.get('/status', async (c) => {
  const [latest, countResult] = await Promise.all([
    supabase.from(TABLE).select('fecha').order('fecha', { ascending: false }).limit(1).single(),
    supabase.from(TABLE).select('id', { count: 'exact', head: true }),
  ]);

  if (latest.error && latest.error.code !== 'PGRST116') {
    return c.json({ error: latest.error.message }, 500);
  }

  return c.json({
    last_date: latest.data?.fecha ?? null,
    total_rows: countResult.count ?? 0,
    is_running: isSyncRunning(),
  });
});

syncRouter.post('/', async (c) => {
  if (isSyncRunning()) {
    return c.json({ message: 'Sync already in progress' }, 409);
  }

  // Run in background — don't await
  runBackfill().catch((err) => console.error('[sync] Backfill error:', err));

  return c.json({ message: 'Backfill started' }, 202);
});

// New endpoint for weekly sync (only missing days from current week)
syncRouter.post('/weekly', async (c) => {
  if (isSyncRunning()) {
    return c.json({ message: 'Sync already in progress' }, 409);
  }

  // Run in background — don't await
  runWeeklySync().catch((err) => console.error('[sync] Weekly sync error:', err));

  return c.json({ message: 'Weekly sync started' }, 202);
});

export { syncRouter };
