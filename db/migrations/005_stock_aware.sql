-- Stock-aware dispatch: a product order on each delivery + per-brand warehouse
-- stock on each depot. Idempotent — safe to re-run.

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_category text    NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_brand    text    NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_qty      integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS depot_stock (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_id   uuid NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  brand      text NOT NULL,
  category   text NOT NULL DEFAULT '',
  bottles    integer NOT NULL DEFAULT 0 CHECK (bottles >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (depot_id, brand)
);
CREATE INDEX IF NOT EXISTS idx_depot_stock_depot ON depot_stock (depot_id);
