import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { pricesRouter } from './routes/prices.js';
import { syncRouter } from './routes/sync.js';
import { chatRouter } from './routes/chat.js';
import { threadsRouter } from './routes/threads.js';
import { profileRouter } from './routes/profile.js';
import { scheduleDailySync } from './scraper/sync.js';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors());

app.route('/api/prices', pricesRouter);
app.route('/api/sync', syncRouter);
app.route('/api/chat', chatRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/profile', profileRouter);

// Serve React build in production
app.use('*', serveStatic({ root: '../web/dist' }));
app.get('*', serveStatic({ path: '../web/dist/index.html' }));

const PORT = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] Server running on http://localhost:${info.port}`);
  scheduleDailySync();
});
