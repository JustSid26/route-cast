import { AppError } from '../utils/AppError';
import { deliverySchema, DeliveryInput } from '../validation/schemas';
import { DeliveryStop } from '../types';

export interface RowError {
  row: number; // 1-based data row (excludes header)
  message: string;
}

export interface CsvValidationResult {
  rows: number;
  valid: DeliveryInput[];
  errors: RowError[];
}

const REQUIRED_COLUMNS = [
  'customer_name', 'address', 'latitude', 'longitude', 'weight', 'volume', 'priority',
];

/** Minimal RFC-4180-ish parser: handles quoted fields and embedded commas. */
export function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumber(value: string): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse + validate CSV text. Never throws on bad rows — collects per-row errors
 * so the UI can show exactly which rows failed. Throws only for structural
 * problems (empty file, missing/duplicate columns).
 */
export function validateCsv(csv: string): CsvValidationResult {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) throw AppError.badRequest('CSV file is empty');

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw AppError.badRequest(`CSV is missing required column(s): ${missing.join(', ')}`);
  }

  if (lines.length === 1) throw AppError.badRequest('CSV has a header but no data rows');

  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const valid: DeliveryInput[] = [];
  const errors: RowError[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]);
    const raw = {
      customer_name: cells[idx.customer_name] ?? '',
      address: cells[idx.address] ?? '',
      latitude: toNumber(cells[idx.latitude] ?? ''),
      longitude: toNumber(cells[idx.longitude] ?? ''),
      weight: toNumber(cells[idx.weight] ?? '') ?? 0,
      volume: toNumber(cells[idx.volume] ?? '') ?? 0,
      priority: toNumber(cells[idx.priority] ?? '') ?? 3,
    };

    if (raw.latitude === null || raw.longitude === null) {
      errors.push({ row: r, message: 'latitude and longitude must be valid numbers' });
      continue;
    }

    const parsed = deliverySchema.safeParse(raw);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      const msg = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      errors.push({ row: r, message: msg });
    }
  }

  return { rows: lines.length - 1, valid, errors };
}

/**
 * Parse an "uploaded usual route" CSV — a manager's actual driving order — and
 * reorder the job's deliveries to match. The row format is detected from the
 * header: match by `delivery_id` if that column is present, otherwise by
 * `customer_name`; a `sequence` column gives the visiting order. Unlike
 * `validateCsv`, this throws on ANY problem rather than collecting per-row
 * errors, because a baseline must cover exactly the job's deliveries (no extras,
 * no duplicates, none missing) for the optimized-vs-usual comparison to stay
 * apples-to-apples on the same matrix.
 */
export function parseUsualRoute(csv: string, deliveries: DeliveryStop[]): DeliveryStop[] {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) throw AppError.badRequest('CSV file is empty');

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  if (!header.includes('sequence')) {
    throw AppError.badRequest("CSV must include a 'sequence' column");
  }

  let matchBy: 'delivery_id' | 'customer_name';
  if (header.includes('delivery_id')) matchBy = 'delivery_id';
  else if (header.includes('customer_name')) matchBy = 'customer_name';
  else throw AppError.badRequest("CSV must include a 'delivery_id' or 'customer_name' column");

  if (lines.length === 1) throw AppError.badRequest('CSV has a header but no data rows');

  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  // Lookups over the job's deliveries. Names can collide, so keep a list per name.
  const byId = new Map(deliveries.map((d) => [d.delivery_id, d]));
  const byName = new Map<string, DeliveryStop[]>();
  for (const d of deliveries) {
    const k = d.customer_name.trim().toLowerCase();
    const arr = byName.get(k);
    if (arr) arr.push(d);
    else byName.set(k, [d]);
  }

  const errors: string[] = [];
  const picked: { seq: number; stop: DeliveryStop }[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < lines.length; r++) {
    const cells = parseLine(lines[r]);
    const seq = toNumber(cells[idx.sequence] ?? '');
    if (seq === null) {
      errors.push(`row ${r}: sequence must be a number`);
      continue;
    }

    let stop: DeliveryStop | undefined;
    if (matchBy === 'delivery_id') {
      const id = cells[idx.delivery_id] ?? '';
      stop = byId.get(id);
      if (!stop) {
        errors.push(`row ${r}: delivery_id "${id}" is not part of this route`);
        continue;
      }
    } else {
      const raw = cells[idx.customer_name] ?? '';
      const matches = byName.get(raw.trim().toLowerCase()) ?? [];
      if (matches.length === 0) {
        errors.push(`row ${r}: customer "${raw}" is not part of this route`);
        continue;
      }
      if (matches.length > 1) {
        errors.push(`row ${r}: customer "${raw}" is ambiguous — use delivery_id instead`);
        continue;
      }
      stop = matches[0];
    }

    if (seen.has(stop.delivery_id)) {
      errors.push(`row ${r}: ${stop.customer_name} appears more than once`);
      continue;
    }
    seen.add(stop.delivery_id);
    picked.push({ seq, stop });
  }

  const missing = deliveries.filter((d) => !seen.has(d.delivery_id));
  if (missing.length > 0) {
    errors.push(
      `route is missing ${missing.length} stop(s): ${missing.map((d) => d.customer_name).join(', ')}`
    );
  }

  if (errors.length > 0) {
    throw AppError.badRequest(`Could not read usual route — ${errors.join('; ')}`);
  }

  return picked.sort((a, b) => a.seq - b.seq).map((p) => p.stop);
}
