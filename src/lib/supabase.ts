import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// supabaseRaw: untyped client for user_profiles queries only.
// The generated Supabase types for user_profiles combined with Hono's context generics
// trigger TS2589 ("type instantiation excessively deep") in TypeScript 5.x.
// All other tables use the typed `supabase` client.
export const supabaseRaw = createClient(supabaseUrl, supabaseKey);

export const TABLE = 'odepa_market_data_transformed' as const;
export const T_MERCADOS = 'mercados' as const;
export const T_PRODUCTOS = 'productos' as const;
