-- Store per-job savings analysis (optimized vs usual/average/worst baselines).
ALTER TABLE route_jobs
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}';
