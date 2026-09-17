// Date-range resolution for the owner click analytics dashboard.
//
// Every boundary here is computed in UTC, deliberately. clicked_at is a
// timestamptz — already normalized internally — and nothing anywhere in this
// application stores an owner or visitor timezone (there's no timezone
// column, no locale setting, nothing to read one from). Mixing a "rolling
// last N*24h" window for multi-day presets with a "since local midnight"
// definition of Today would drift against each other depending on what time
// of day the owner happens to load the page. Using UTC calendar-day
// boundaries for every preset, including Today, keeps them consistent with
// each other and avoids the off-by-one that a naive `now - N*24h` window
// produces when "today" is only partially elapsed.

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  sinceIso: string;
  /** Exclusive upper bound. */
  untilIso: string;
  /** Only set for key === "custom"; the raw YYYY-MM-DD values, for the form inputs. */
  fromDate?: string;
  toDate?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_SPAN_DAYS = 400;

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Strict YYYY-MM-DD parse in UTC — new Date("2026-09-17") is already UTC
// midnight per the ISO 8601 spec Date.parse follows for date-only strings,
// but validated here so a malformed query param can't produce "Invalid Date".
function parseDateInput(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PRESET_DAYS: Record<Exclude<RangeKey, "custom">, number> = {
  today: 0,
  "7d": 6,
  "30d": 29,
  "90d": 89,
};

const PRESET_LABELS: Record<Exclude<RangeKey, "custom">, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

/**
 * Resolves the `range`/`from`/`to` search params into concrete UTC
 * boundaries. Always returns a valid range — an unrecognized or missing
 * `range` falls back to "7d", and an invalid custom from/to falls back the
 * same way, so a malformed query string can never produce an unbounded or
 * reversed query.
 */
export function resolveDateRange(searchParams: { range?: string; from?: string; to?: string }): ResolvedRange {
  const now = new Date();
  const todayStart = utcDayStart(now);

  if (searchParams.range === "custom") {
    const fromParsed = parseDateInput(searchParams.from);
    const toParsed = parseDateInput(searchParams.to);
    if (fromParsed && toParsed && fromParsed.getTime() <= toParsed.getTime()) {
      const spanDays = Math.round((toParsed.getTime() - fromParsed.getTime()) / DAY_MS);
      const clampedTo = spanDays > MAX_CUSTOM_SPAN_DAYS ? addDays(fromParsed, MAX_CUSTOM_SPAN_DAYS) : toParsed;
      return {
        key: "custom",
        label: `${formatDateInput(fromParsed)} to ${formatDateInput(clampedTo)}`,
        sinceIso: fromParsed.toISOString(),
        // Exclusive: start of the day AFTER the end date, so the end date
        // itself is fully included regardless of what time it is "now".
        untilIso: addDays(utcDayStart(clampedTo), 1).toISOString(),
        fromDate: formatDateInput(fromParsed),
        toDate: formatDateInput(clampedTo),
      };
    }
    // Invalid custom input falls through to the 7d default below.
  }

  const key: Exclude<RangeKey, "custom"> =
    searchParams.range === "today" || searchParams.range === "30d" || searchParams.range === "90d"
      ? searchParams.range
      : "7d";

  return {
    key,
    label: PRESET_LABELS[key],
    sinceIso: addDays(todayStart, -PRESET_DAYS[key]).toISOString(),
    // Presets extend to the live moment, not to end-of-day, so the dashboard
    // reflects activity up to the instant it was loaded.
    untilIso: now.toISOString(),
  };
}

/** Every day in [sinceIso, untilIso) as YYYY-MM-DD, for filling zero-click gaps in the trend chart. */
export function daysInRange(sinceIso: string, untilIso: string): string[] {
  const start = utcDayStart(new Date(sinceIso));
  const end = utcDayStart(new Date(new Date(untilIso).getTime() - 1)); // untilIso is exclusive
  const days: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    days.push(formatDateInput(d));
  }
  return days;
}
