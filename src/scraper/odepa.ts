import * as XLSX from 'xlsx'
import type { OdepaRecord } from '../types.js'

// Canonical names matching existing Supabase data
const MARKET_MAP: Record<string, { mercado: string; region: string; id_region: number }> = {
  'Lo Valledor':        { mercado: 'Mercado Mayorista Lo Valledor de Santiago',  region: 'Región Metropolitana de Santiago', id_region: 13 },
  'Vega Central Mapocho': { mercado: 'Vega Central Mapocho de Santiago',         region: 'Región Metropolitana de Santiago', id_region: 13 },
  'Mapocho Vta.dir':    { mercado: 'Mapocho venta directa de Santiago',          region: 'Región Metropolitana de Santiago', id_region: 13 },
  'Macroferia Talca':   { mercado: 'Macroferia Regional de Talca',               region: 'Región del Maule',                id_region: 7  },
  'Femacal':            { mercado: 'Femacal de La Calera',                       region: 'Región de Valparaíso',            id_region: 5  },
  'La Palmera':         { mercado: 'Terminal La Palmera de La Serena',           region: 'Región de Coquimbo',              id_region: 4  },
  'Solcoagro':          { mercado: 'Solcoagro de Ovalle',                        region: 'Región de Coquimbo',              id_region: 4  },
  'Vega Monumental':    { mercado: 'Vega Monumental Concepción',                 region: 'Región del Biobío',               id_region: 8  },
  'Lagunita Pto.Montt': { mercado: 'Feria Lagunitas de Puerto Montt',           region: 'Región de Los Lagos',             id_region: 10 },
  'Vega Modelo Temuco': { mercado: 'Vega Modelo de Temuco',                     region: 'Región de La Araucanía',          id_region: 9  },
  'Agrochillan':        { mercado: 'Terminal Hortofrutícola Agro Chillán',      region: 'Región de Ñuble',                 id_region: 16 },
  'Agronor':            { mercado: 'Agrícola del Norte S.A. de Arica',          region: 'Región de Arica y Parinacota',    id_region: 15 },
}

const SUBSECTOR_MAP: Record<string, string> = {
  'Frutas':     'Frutas y frutos secos',
  'Hortalizas': 'Hortalizas y tubérculos',
}

// Extract kilos from unit string: "$/caja 15 kilos" → 15, "$/bandeja 2 kilos" → 2
function extractKg(unit: string): number {
  const match = unit.match(/(\d+(?:\.\d+)?)\s*kilo/i)
  return match ? parseFloat(match[1]) : 1
}

// Excel serial date → "YYYY-MM-DD"
function excelDateToString(serial: number): string {
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
  return date.toISOString().slice(0, 10)
}

// ODEPA changed URL format at some point:
//   Old: Boletin_Diario_de_Frutas_y_Hortalizas_YYYYMMDD.xlsx
//   New: Boletin-Diario-de-Frutas-y-Hortalizas_DDMMYYYY.xlsx
export function buildUrls(date: Date): string[] {
  const iso = date.toISOString().slice(0, 10) // "YYYY-MM-DD" in UTC
  const [y, m, d] = iso.split('-')
  return [
    `https://www.odepa.gob.cl/wp-content/uploads/${y}/${m}/Boletin-Diario-de-Frutas-y-Hortalizas_${d}${m}${y}.xlsx`,
    `https://www.odepa.gob.cl/wp-content/uploads/${y}/${m}/Boletin_Diario_de_Frutas_y_Hortalizas_${y}${m}${d}.xlsx`,
  ]
}

function isXlsx(contentType: string): boolean {
  return (
    contentType.includes('spreadsheet') ||
    contentType.includes('octet-stream') ||
    contentType.includes('zip')
  )
}

export async function downloadExcel(date: Date): Promise<Buffer | null> {
  for (const url of buildUrls(date)) {
    const res = await fetch(url)
    if (!res.ok) continue

    // ODEPA returns HTML (200) when the file doesn't exist — detect via content-type
    const contentType = res.headers.get('content-type') ?? ''
    if (!isXlsx(contentType)) continue

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }
  return null
}

export function parseExcel(buffer: Buffer): OdepaRecord[] {
  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 65001 })
  const records: OdepaRecord[] = []

  for (const sheetName of wb.SheetNames) {
    if (sheetName.startsWith('Portada')) continue

    const separatorIdx = sheetName.indexOf('_')
    if (separatorIdx === -1) continue

    const subsectorKey = sheetName.slice(0, separatorIdx)   // "Frutas" | "Hortalizas"
    const marketKey    = sheetName.slice(separatorIdx + 1)  // "Lo Valledor", etc.

    const subsector = SUBSECTOR_MAP[subsectorKey]
    const market    = MARKET_MAP[marketKey]
    if (!subsector || !market) continue

    const ws   = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Find date row dynamically — look for "Día:" in col 0
    let fecha = ''
    let dataStartRow = -1

    for (let i = 0; i < rows.length; i++) {
      const col0 = String(rows[i][0] ?? '').trim()
      if (col0.startsWith('Día:') || col0 === 'Día:') {
        const serial = rows[i][1]
        if (typeof serial === 'number') fecha = excelDateToString(serial)
      }
      if (col0.startsWith('Producto')) {
        dataStartRow = i + 1
        break
      }
    }

    if (!fecha || dataStartRow === -1) continue

    // Parse data rows
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i]
      const producto = String(row[0] ?? '').trim()

      // Stop at empty rows or footer
      if (!producto || producto.startsWith('Fuente:')) break

      const unidad    = String(row[7] ?? '').trim()
      const volumen   = Number(row[3]) || 0
      const kgUnit    = extractKg(unidad)
      const precioMin = Number(row[5]) || 0

      records.push({
        fecha,
        id_region: market.id_region,
        region:    market.region,
        mercado:   market.mercado,
        subsector,
        producto,
        variedad_tipo:                     String(row[1] ?? '').trim(),
        calidad:                           String(row[2] ?? '').trim(),
        unidad_comercializacion:           unidad,
        origen:                            String(row[8] ?? '').trim(),
        volumen,
        precio_maximo:                     Number(row[4]) || 0,
        precio_minimo:                     precioMin,
        precio_promedio_ponderado:         Number(row[6]) || 0,
        kg_unidad_comercializacion:        kgUnit,
        precio_kg_unidad_comercializacion: kgUnit > 0 ? Math.round((precioMin / kgUnit) * 100) / 100 : 0,
        total_volume:                      Math.round((volumen * kgUnit / 1000) * 100) / 100,
      })
    }
  }

  return records
}
