import { schedule } from 'node-cron'
import { supabase, TABLE } from '../lib/supabase.js'
import { downloadExcel, parseExcel } from './odepa.js'

let syncRunning = false

export async function getLastSyncedDate(): Promise<Date> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return new Date('2018-01-01')
  return new Date(data.fecha)
}

// Generate business days (Mon–Fri) between two dates inclusive
function getBusinessDays(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const cursor = new Date(from)
  cursor.setUTCDate(cursor.getUTCDate() + 1) // start from day after last sync

  while (cursor <= to) {
    const dow = cursor.getUTCDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function syncDate(date: Date): Promise<{ inserted: number; skipped: boolean }> {
  const buf = await downloadExcel(date)
  if (!buf) return { inserted: 0, skipped: true }

  const raw = parseExcel(buf)
  if (raw.length === 0) return { inserted: 0, skipped: true }

  // Deduplicate within the batch — same conflict key keeps the last occurrence
  const seen = new Map<string, typeof raw[0]>()
  for (const r of raw) {
    const key = `${r.fecha}|${r.mercado}|${r.producto}|${r.variedad_tipo}|${r.calidad}`
    seen.set(key, r)
  }
  const records = [...seen.values()]

  const { error } = await supabase
    .from(TABLE)
    .upsert(records, {
      onConflict: 'fecha,mercado,producto,variedad_tipo,calidad',
      ignoreDuplicates: false,
    })

  if (error) throw new Error(`Supabase upsert error: ${error.message}`)

  return { inserted: records.length, skipped: false }
}

/**
 * Sync only business days from the current week that are not already in the database.
 * This prevents re-fetching days that have already been loaded.
 */
export async function runWeeklySync(delayMs = 600): Promise<void> {
  if (syncRunning) {
    console.log('[sync] Already running, skipping')
    return
  }
  syncRunning = true

  try {
    const today = new Date()
    // Get start of current week (Monday)
    const dayOfWeek = today.getUTCDay() || 7 // Convert Sunday (0) to 7
    const monday = new Date(today)
    monday.setUTCDate(today.getUTCDate() - dayOfWeek + 1)
    monday.setUTCHours(0, 0, 0, 0)

    // getBusinessDays() starts from from + 1 day, so pass the previous day
    // to include Monday in the weekly sync range.
    const weekStart = new Date(monday)
    weekStart.setUTCDate(weekStart.getUTCDate() - 1)

    // Get all dates from Monday to today (business days only)
    const weekDates = getBusinessDays(weekStart, today)

    console.log(`[sync] Weekly sync: ${weekDates.length} dates from ${monday.toISOString().slice(0, 10)} to ${today.toISOString().slice(0, 10)}`)

    let total = 0
    for (const date of weekDates) {
      const dateStr = date.toISOString().slice(0, 10)

      // Check if this date already exists in the database.
      // Use maybeSingle() so that "0 rows" returns { data: null, error: null }
      // instead of a PGRST116 error. Real errors (network/auth) are thrown.
      const { data: existing, error: existsError } = await supabase
        .from(TABLE)
        .select('fecha')
        .eq('fecha', dateStr)
        .limit(1)
        .maybeSingle()

      if (existsError) {
        throw new Error(`[sync] Failed to check existence for ${dateStr}: ${existsError.message}`)
      }

      if (existing) {
        console.log(`[sync] ${dateStr} — already exists, skipping`)
        continue
      }

      const result = await syncDate(date)

      if (result.skipped) {
        console.log(`[sync] ${dateStr} — skipped (no file)`)
      } else {
        console.log(`[sync] ${dateStr} — inserted ${result.inserted} records`)
        total += result.inserted
      }

      await sleep(delayMs)
    }

    console.log(`[sync] Weekly sync complete. Total inserted: ${total}`)
  } finally {
    syncRunning = false
  }
}

export async function runBackfill(delayMs = 600): Promise<void> {
  if (syncRunning) {
    console.log('[sync] Already running, skipping')
    return
  }
  syncRunning = true

  try {
    const lastDate = await getLastSyncedDate()
    const today = new Date()
    const dates = getBusinessDays(lastDate, today)

    console.log(`[sync] Backfill: ${dates.length} dates from ${lastDate.toISOString().slice(0, 10)}`)

    let total = 0
    for (const date of dates) {
      const dateStr = date.toISOString().slice(0, 10)
      const result = await syncDate(date)

      if (result.skipped) {
        console.log(`[sync] ${dateStr} — skipped (no file)`)
      } else {
        console.log(`[sync] ${dateStr} — inserted ${result.inserted} records`)
        total += result.inserted
      }

      await sleep(delayMs)
    }

    console.log(`[sync] Backfill complete. Total inserted: ${total}`)
  } finally {
    syncRunning = false
  }
}

export function scheduleDailySync(): void {
  // Run at 10:00 AM Chile time (UTC-3/UTC-4) → 13:00 UTC
  schedule('0 13 * * 1-5', async () => {
    console.log('[sync] Daily sync triggered')
    await runBackfill(300)
  })
  console.log('[sync] Daily sync scheduled (Mon–Fri 10:00 CLT)')
}

export function isSyncRunning(): boolean {
  return syncRunning
}
