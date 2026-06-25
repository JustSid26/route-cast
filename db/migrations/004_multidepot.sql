-- Multi-depot support: each route result records the home depot its vehicle
-- departs from (a single job can now span several depots). Nullable + ON DELETE
-- SET NULL so deleting a depot never orphans historical route results.
ALTER TABLE route_results
  ADD COLUMN IF NOT EXISTS depot_id uuid REFERENCES depots(id) ON DELETE SET NULL;
