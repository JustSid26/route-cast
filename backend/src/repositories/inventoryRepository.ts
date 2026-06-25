import { query, queryOne } from '../config/db';
import { InventoryImport } from '../types';
import { InventoryImportInput } from '../validation/schemas';

const COLS = 'id, filename, sheet_count, row_count, data, created_at';
const SUMMARY_COLS = 'id, filename, sheet_count, row_count, created_at';

export type InventoryImportSummary = Omit<InventoryImport, 'data'>;

export const inventoryRepository = {
  /** Store a parsed workbook whole (JSONB). Returns the summary (no data echo). */
  create: (input: InventoryImportInput) => {
    const rowCount = input.sheets.reduce((s, sh) => s + sh.rows.length, 0);
    return queryOne<InventoryImportSummary>(
      `INSERT INTO inventory_imports (filename, sheet_count, row_count, data)
       VALUES ($1, $2, $3, $4) RETURNING ${SUMMARY_COLS}`,
      [input.filename, input.sheets.length, rowCount, JSON.stringify({ sheets: input.sheets })]
    );
  },

  latest: () =>
    queryOne<InventoryImport>(
      `SELECT ${COLS} FROM inventory_imports ORDER BY created_at DESC LIMIT 1`
    ),

  findById: (id: string) =>
    queryOne<InventoryImport>(`SELECT ${COLS} FROM inventory_imports WHERE id = $1`, [id]),

  list: () =>
    query<InventoryImportSummary>(
      `SELECT ${SUMMARY_COLS} FROM inventory_imports ORDER BY created_at DESC`
    ),

  remove: (id: string) =>
    queryOne<{ id: string }>(`DELETE FROM inventory_imports WHERE id = $1 RETURNING id`, [id]),
};
