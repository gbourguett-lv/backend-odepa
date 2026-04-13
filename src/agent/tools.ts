import { tool, jsonSchema } from "ai";
import { supabase, TABLE, T_MERCADOS, T_PRODUCTOS } from "../lib/supabase.js";

const T_VARIEDADES = "variedades" as const;

// Helper: resolve variedad_tipo list from a grupo name
async function resolveGrupo(
  producto: string,
  grupo: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from(T_VARIEDADES)
    .select("variedad_tipo")
    .ilike("producto", `%${producto}%`)
    .ilike("grupo", `%${grupo}%`)
    .eq("activo", true);

  if (error || !data?.length) return null;
  return data.map((r) => r.variedad_tipo);
}

export const tools = {
  query_prices: tool({
    description:
      "Consulta precios mayoristas de frutas y hortalizas en los mercados de Chile. Filtra por producto, mercado, región, variedad o grupo semántico de variedades.",
    inputSchema: jsonSchema<{
      producto: string;
      mercado?: string;
      region?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      variedad?: string;
      grupo?: string;
      limit?: number;
    }>({
      type: "object",
      properties: {
        producto: {
          type: "string",
          description: 'Nombre del producto (ej: "Tomate", "Palta", "Manzana")',
        },
        mercado: {
          type: "string",
          description: 'Nombre del mercado (ej: "Lo Valledor")',
        },
        region: {
          type: "string",
          description: 'Nombre de la región (ej: "Metropolitana")',
        },
        fecha_desde: {
          type: "string",
          description: "Fecha inicial YYYY-MM-DD",
        },
        fecha_hasta: { type: "string", description: "Fecha final YYYY-MM-DD" },
        variedad: {
          type: "string",
          description: "Filtrar por variedad específica (búsqueda parcial)",
        },
        grupo: {
          type: "string",
          description:
            'Filtrar por grupo semántico de variedades (ej: "Pulpa blanca", "Zafiro", "Navel"). Incluye automáticamente todas las variedades del grupo.',
        },
        limit: { type: "number", minimum: 1, maximum: 50, default: 20 },
      },
      required: ["producto"],
    }),
    execute: async ({
      producto,
      mercado,
      region,
      fecha_desde,
      fecha_hasta,
      variedad,
      grupo,
      limit = 20,
    }) => {
      let query = supabase
        .from(TABLE)
        .select(
          "fecha,producto,variedad_tipo,mercado,region,precio_minimo,precio_maximo,precio_promedio_ponderado,unidad_comercializacion",
        )
        .ilike("producto", `%${producto}%`)
        .order("fecha", { ascending: false })
        .limit(limit);

      if (mercado) query = query.ilike("mercado", `%${mercado}%`);
      if (region) query = query.ilike("region", `%${region}%`);
      if (fecha_desde) query = query.gte("fecha", fecha_desde);
      if (fecha_hasta) query = query.lte("fecha", fecha_hasta);

      // grupo takes precedence over variedad
      if (grupo) {
        const variedades = await resolveGrupo(producto, grupo);
        if (!variedades) {
          return { message: `No se encontró el grupo "${grupo}" para "${producto}". Usá get_varieties para ver los grupos disponibles.` };
        }
        query = query.in("variedad_tipo", variedades);
      } else if (variedad) {
        query = query.ilike("variedad_tipo", `%${variedad}%`);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };
      if (!data?.length)
        return { message: `No se encontraron registros para "${producto}"` };

      return {
        total: data.length,
        registros: data.map((r) => ({
          fecha: r.fecha,
          variedad: r.variedad_tipo ?? "-",
          min: r.precio_minimo,
          max: r.precio_maximo,
          prom: r.precio_promedio_ponderado,
          unidad: r.unidad_comercializacion,
        })),
      };
    },
  }),

  get_products: tool({
    description:
      "Lista todos los productos disponibles en la base de datos de ODEPA.",
    inputSchema: jsonSchema<{ search?: string }>({
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Filtrar productos por nombre parcial",
        },
      },
    }),
    execute: async ({ search }) => {
      let query = supabase
        .from(T_PRODUCTOS)
        .select("nombre, subsector")
        .order("nombre");
      if (search) query = query.ilike("nombre", `%${search}%`);

      const { data, error } = await query;
      if (error) return { error: error.message };

      return { products: data, total: data?.length ?? 0 };
    },
  }),

  get_markets: tool({
    description:
      "Lista todos los mercados mayoristas disponibles con su región.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
    }),
    execute: async () => {
      const { data, error } = await supabase
        .from(T_MERCADOS)
        .select("nombre, region")
        .eq("activo", true)
        .order("region");

      if (error) return { error: error.message };

      return { markets: data, total: data?.length ?? 0 };
    },
  }),

  get_varieties: tool({
    description:
      "Lista las variedades disponibles para un producto, con sus grupos semánticos. Útil para descubrir qué grupos existen (ej: 'Pulpa blanca', 'Zafiro') antes de consultar precios por grupo.",
    inputSchema: jsonSchema<{
      producto: string;
      solo_con_grupo?: boolean;
    }>({
      type: "object",
      properties: {
        producto: {
          type: "string",
          description: "Nombre del producto",
        },
        solo_con_grupo: {
          type: "boolean",
          description:
            "Si es true, devuelve solo variedades que tienen grupo asignado",
        },
      },
      required: ["producto"],
    }),
    execute: async ({ producto, solo_con_grupo = false }) => {
      let query = supabase
        .from(T_VARIEDADES)
        .select("variedad_tipo, grupo, registros")
        .ilike("producto", `%${producto}%`)
        .eq("activo", true)
        .order("grupo", { ascending: true })
        .order("variedad_tipo", { ascending: true });

      if (solo_con_grupo) query = query.not("grupo", "is", null);

      const { data, error } = await query;
      if (error) return { error: error.message };
      if (!data?.length)
        return { message: `No hay variedades registradas para "${producto}"` };

      // Group by grupo for a cleaner response
      const grouped: Record<string, string[]> = {};
      const sinGrupo: string[] = [];

      for (const r of data) {
        if (r.grupo) {
          if (!grouped[r.grupo]) grouped[r.grupo] = [];
          grouped[r.grupo].push(r.variedad_tipo);
        } else {
          sinGrupo.push(r.variedad_tipo);
        }
      }

      return {
        producto,
        total_variedades: data.length,
        grupos: Object.entries(grouped).map(([grupo, variedades]) => ({
          grupo,
          variedades,
          cantidad: variedades.length,
        })),
        sin_grupo: sinGrupo.length > 0 ? sinGrupo : undefined,
      };
    },
  }),

  get_price_trend: tool({
    description:
      "Obtiene tendencia de precios de un producto agrupada por semana y variedad. Soporta filtro por grupo semántico (ej: todas las variedades 'Pulpa blanca' de Nectarín). Ideal para analizar evolución en el tiempo.",
    inputSchema: jsonSchema<{
      producto: string;
      mercado?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      dias?: number;
      variedad?: string;
      grupo?: string;
    }>({
      type: "object",
      properties: {
        producto: { type: "string", description: "Nombre del producto" },
        mercado: { type: "string", description: "Nombre del mercado (opcional)" },
        fecha_desde: { type: "string", description: "Fecha inicio YYYY-MM-DD (alternativa a dias)" },
        fecha_hasta: { type: "string", description: "Fecha fin YYYY-MM-DD (alternativa a dias)" },
        dias: {
          type: "number",
          minimum: 7,
          maximum: 365,
          default: 30,
          description: "Días hacia atrás desde hoy (si no se especifican fechas)",
        },
        variedad: {
          type: "string",
          description: "Filtrar por variedad específica (búsqueda parcial)",
        },
        grupo: {
          type: "string",
          description:
            'Filtrar por grupo semántico (ej: "Pulpa blanca", "Navel"). Incluye todas las variedades del grupo automáticamente.',
        },
      },
      required: ["producto"],
    }),
    execute: async ({ producto, mercado, fecha_desde, fecha_hasta, dias = 30, variedad, grupo }) => {
      // Resolve date range
      let desde = fecha_desde;
      let hasta = fecha_hasta;
      if (!desde) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - dias);
        desde = d.toISOString().slice(0, 10);
      }
      if (!hasta) {
        hasta = new Date().toISOString().slice(0, 10);
      }

      // Resolve grupo → variedad_tipo list
      let variedadesDelGrupo: string[] | null = null;
      if (grupo) {
        variedadesDelGrupo = await resolveGrupo(producto, grupo);
        if (!variedadesDelGrupo) {
          return {
            message: `No se encontró el grupo "${grupo}" para "${producto}". Usá get_varieties para ver los grupos disponibles.`,
          };
        }
      }

      let query = supabase
        .from(TABLE)
        .select("fecha,variedad_tipo,precio_minimo,precio_maximo,precio_promedio_ponderado,unidad_comercializacion,volumen")
        .ilike("producto", `%${producto}%`)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: true })
        .limit(2000);

      if (mercado) query = query.ilike("mercado", `%${mercado}%`);

      if (variedadesDelGrupo) {
        query = query.in("variedad_tipo", variedadesDelGrupo);
      } else if (variedad) {
        query = query.ilike("variedad_tipo", `%${variedad}%`);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };
      if (!data?.length)
        return { message: `Sin datos de tendencia para "${producto}" entre ${desde} y ${hasta}` };

      // Aggregate by (ISO week, variedad_tipo) to keep tokens minimal
      type Agg = { minSum: number; maxSum: number; promSum: number; count: number; volSum: number; unit: string };
      const byWeekVariety = new Map<string, Agg>();

      for (const r of data) {
        const d = new Date(r.fecha);
        // ISO week start (Monday)
        const day = d.getUTCDay() || 7;
        const weekStart = new Date(d);
        weekStart.setUTCDate(d.getUTCDate() - day + 1);
        const week = weekStart.toISOString().slice(0, 10);
        const variety = (r.variedad_tipo ?? "Sin variedad").trim() || "Sin variedad";
        const key = `${week}||${variety}`;

        const prev = byWeekVariety.get(key) ?? { minSum: 0, maxSum: 0, promSum: 0, count: 0, volSum: 0, unit: r.unidad_comercializacion ?? "" };
        prev.minSum  += r.precio_minimo  ?? 0;
        prev.maxSum  += r.precio_maximo  ?? 0;
        prev.promSum += r.precio_promedio_ponderado ?? 0;
        prev.volSum  += r.volumen ?? 0;
        prev.count   += 1;
        byWeekVariety.set(key, prev);
      }

      const summary = [...byWeekVariety.entries()].map(([key, v]) => {
        const [week, variety] = key.split("||");
        return {
          semana: week,
          variedad: variety,
          precio_min: Math.round(v.minSum / v.count),
          precio_max: Math.round(v.maxSum / v.count),
          precio_prom: Math.round(v.promSum / v.count),
          volumen_total: Math.round(v.volSum),
          unidad: v.unit,
          dias_con_datos: v.count,
        };
      });

      return {
        producto,
        grupo: grupo ?? null,
        periodo: `${desde} → ${hasta}`,
        registros_raw: data.length,
        semanas: summary.length,
        resumen: summary,
      };
    },
  }),
};
