import { NextResponse } from 'next/server';
import {
  getMockCalendarEventsForRange,
  type EconomicCalendarApiResponse,
  type EconomicCalendarEventDTO,
  type EconomicImpactLevel,
} from '@/lib/economic-calendar';

// Free public mirror of ForexFactory's weekly calendar — same data, no
// auth required, no rate limit beyond reasonable courtesy. Both files
// are refreshed by faireconomy.media every ~15 minutes. Times in the
// CSV are America/New_York wall time.
const FF_URLS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.csv',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.csv',
];

const CURRENCY_FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', HKD: '🇭🇰',
  SGD: '🇸🇬', INR: '🇮🇳', SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰',
  ZAR: '🇿🇦', BRL: '🇧🇷', MXN: '🇲🇽', RUB: '🇷🇺', TRY: '🇹🇷',
  KRW: '🇰🇷',
};

const REGION_FROM_CURRENCY: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU', NZD: 'NZ',
  CAD: 'CA', CHF: 'CH', CNY: 'CN', HKD: 'HK', SGD: 'SG', INR: 'IN',
  SEK: 'SE', NOK: 'NO', DKK: 'DK', ZAR: 'ZA', BRL: 'BR', MXN: 'MX',
  RUB: 'RU', TRY: 'TR', KRW: 'KR',
};

function normalizeImpact(raw: string): EconomicImpactLevel | null {
  const v = raw.trim().toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  if (v === 'low') return 'low';
  // Holiday / Non-Economic / Tentative — show as low so users still see the row.
  if (v === 'holiday' || v === 'non-economic') return 'low';
  return null;
}

// Parse one CSV line accounting for quoted fields that may contain commas.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// Convert ET wall time (MM-DD-YYYY + 12h string like "8:30am") to a UTC Date.
// Returns null if the time string is "All Day" / "Tentative" / empty — those
// events are still useful as date-only entries; we map them to 00:00 local ET.
function etWallToUtc(dateStr: string, timeStr: string): Date | null {
  // Date format: MM-DD-YYYY (CSV) or M/D/YYYY (older mirrors). Accept both.
  const dateMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!dateMatch) return null;
  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);

  let hour = 0;
  let minute = 0;
  const t = (timeStr || '').trim().toLowerCase();
  if (t && t !== 'all day' && t !== 'tentative') {
    const tm = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
    if (tm) {
      hour = Number(tm[1]) % 12;
      minute = Number(tm[2]);
      if (tm[3] === 'pm') hour += 12;
    } else {
      // 24h fallback
      const t24 = t.match(/^(\d{1,2}):(\d{2})$/);
      if (t24) { hour = Number(t24[1]); minute = Number(t24[2]); }
    }
  }

  // Treat the parsed parts as a UTC instant first, then ask Intl what that
  // instant looks like in ET. The difference tells us how far we drifted —
  // shift the original instant by that amount to land on the right ET wall
  // time. This handles DST without a TZ library.
  const candidate = Date.UTC(year, month - 1, day, hour, minute);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date(candidate));
  const pick = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  // Intl can return hour=24 for midnight; normalise.
  let etHour = pick('hour'); if (etHour === 24) etHour = 0;
  const etInUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), etHour, pick('minute'));
  const diff = candidate - etInUtc;
  return new Date(candidate + diff);
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchOne(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    // next.revalidate gives us a 15-minute server-side cache shared across
    // all callers — well under the mirror's refresh cadence so we're a
    // good citizen and never block on a slow upstream during a render.
    const res = await fetch(url, {
      signal,
      headers: { 'user-agent': 'SwisDex-Calendar/1.0' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseCsv(text: string): EconomicCalendarEventDTO[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  // Expected columns: title, country, date, time, impact, forecast, previous.
  const idx = (name: string) => header.indexOf(name);
  const iTitle = idx('title');
  const iCountry = idx('country');
  const iDate = idx('date');
  const iTime = idx('time');
  const iImpact = idx('impact');
  const iForecast = idx('forecast');
  const iPrevious = idx('previous');
  if (iTitle < 0 || iCountry < 0 || iDate < 0 || iImpact < 0) return [];

  const out: EconomicCalendarEventDTO[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const title = (cols[iTitle] || '').trim();
    const currency = (cols[iCountry] || '').trim().toUpperCase();
    const dateStr = (cols[iDate] || '').trim();
    const timeStr = iTime >= 0 ? (cols[iTime] || '').trim() : '';
    const impactRaw = (cols[iImpact] || '').trim();
    if (!title || !currency || !dateStr) continue;

    const impact = normalizeImpact(impactRaw);
    if (!impact) continue;

    const dt = etWallToUtc(dateStr, timeStr);
    if (!dt || Number.isNaN(dt.getTime())) continue;

    const previous = iPrevious >= 0 ? (cols[iPrevious] || '').trim() : '';
    const consensus = iForecast >= 0 ? (cols[iForecast] || '').trim() : '';

    out.push({
      id: `${currency}-${dt.getTime()}-${title}`.slice(0, 256),
      datetime: dt.toISOString(),
      region: REGION_FROM_CURRENCY[currency],
      currency,
      flag: CURRENCY_FLAG[currency] || '·',
      impact,
      title,
      actual: null,
      previous: previous || null,
      consensus: consensus || null,
    });
  }
  return out;
}

async function fetchFromFaireconomy(): Promise<EconomicCalendarEventDTO[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const texts = await Promise.all(FF_URLS.map((u) => fetchOne(u, ctrl.signal)));
    const events: EconomicCalendarEventDTO[] = [];
    for (const t of texts) if (t) events.push(...parseCsv(t));
    if (events.length === 0) return null;
    return events;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/economic-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Sources rows from the free faireconomy.media mirror of ForexFactory
 * (this week + next week). Falls back to mock data if the mirror is
 * unreachable so the page never goes blank.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Query params from and to (YYYY-MM-DD) are required.' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to.' }, { status: 400 });
  }

  let events: EconomicCalendarEventDTO[] = [];
  const upstream = await fetchFromFaireconomy();
  if (upstream && upstream.length > 0) {
    events = upstream.filter((e) => {
      const ymd = toLocalYmd(new Date(e.datetime));
      return ymd >= from && ymd <= to;
    });
  } else {
    events = getMockCalendarEventsForRange(from, to);
  }

  const body: EconomicCalendarApiResponse = { events };
  return NextResponse.json(body);
}
