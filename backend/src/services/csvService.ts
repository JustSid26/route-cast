import { AppError } from '../utils/AppError';
import { deliverySchema, DeliveryInput } from '../validation/schemas';

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
function parseLine(line: string): string[] {
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
