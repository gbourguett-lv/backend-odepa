// ── Auth / Profile types ──────────────────────────────────────────────────────

export interface AiConfig {
  temperature?: number;
  system_prompt_extra?: string;
}

export interface UserProfile {
  role: string;
  ai_config: AiConfig;
  preferred_model: string;
  messages_today: number;
  messages_today_date: string;
}

export type AuthVariables = {
  userId: string;
  userRole: string;
  aiConfig: AiConfig;
};

// ── ODEPA data types ──────────────────────────────────────────────────────────

export interface OdepaRecord {
  id?: number;
  fecha: string; // YYYY-MM-DD
  id_region: number;
  region: string;
  mercado: string;
  subsector: string;
  producto: string;
  variedad_tipo: string;
  calidad: string;
  unidad_comercializacion: string;
  origen: string;
  volumen: number;
  precio_minimo: number;
  precio_maximo: number;
  precio_promedio_ponderado: number;
  kg_unidad_comercializacion: number;
  precio_kg_unidad_comercializacion: number;
  total_volume: number;
}

export interface PriceFilters {
  fecha_desde?: string;
  fecha_hasta?: string;

  producto?: string;
  mercado?: string;
  region?: string;
  limit?: number;
}

export interface SyncStatus {
  last_date: string;
  total_rows: number;
  is_running: boolean;
}
