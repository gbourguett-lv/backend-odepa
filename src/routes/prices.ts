import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { supabase, TABLE, T_MERCADOS, T_PRODUCTOS } from '../lib/supabase.js';

const pricesRouter = new Hono();

const filtersSchema = z.object({
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  producto: z.string().optional(),
  mercado: z.string().optional(),
  region: z.string().optional(),
  limit: z.coerce.number().min(1).max(5000).default(500),
});

pricesRouter.get('/', zValidator('query', filtersSchema), async (c) => {
  const { fecha_desde, fecha_hasta, producto, mercado, region, limit } = c.req.valid('query');

  let query = supabase.from(TABLE).select('*').limit(limit).order('fecha', { ascending: false });

  if (fecha_desde) query = query.gte('fecha', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha', fecha_hasta);
  if (producto) query = query.ilike('producto', `%${producto}%`);
  if (mercado) query = query.ilike('mercado', `%${mercado}%`);
  if (region) query = query.ilike('region', `%${region}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json(data);
});

pricesRouter.get('/products', async (c) => {
  const { data, error } = await supabase
    .from(T_PRODUCTOS)
    .select('nombre, subsector')
    .order('nombre');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

pricesRouter.get('/markets', async (c) => {
  const { data, error } = await supabase
    .from(T_MERCADOS)
    .select('nombre, region, id_region')
    .eq('activo', true)
    .order('region');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

export { pricesRouter };
