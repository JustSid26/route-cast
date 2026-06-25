-- Inventory imports: a user-uploaded Excel workbook, parsed to JSON and stored
-- whole so any sheet/column set can be persisted and re-displayed (Shopify-style
-- inventory tab). Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS inventory_imports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    text        NOT NULL,
  sheet_count integer     NOT NULL DEFAULT 0,
  row_count   integer     NOT NULL DEFAULT 0,
  data        jsonb       NOT NULL DEFAULT '{}',   -- { sheets: [{ name, columns, rows }] }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_imports_created_at
  ON inventory_imports (created_at DESC);
