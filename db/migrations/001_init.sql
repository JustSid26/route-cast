-- VRP Platform schema (PostgreSQL + PostGIS)
-- Run automatically on first container init via docker-entrypoint-initdb.d.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- updated_at trigger helper -------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- depots --------------------------------------------------------------------
CREATE TABLE depots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  address     text        NOT NULL DEFAULT '',
  latitude    double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude   double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geom        geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX depots_geom_idx ON depots USING GIST (geom);
CREATE TRIGGER depots_updated BEFORE UPDATE ON depots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vehicles ------------------------------------------------------------------
CREATE TABLE vehicles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  registration_number text        NOT NULL DEFAULT '',
  capacity_kg         double precision NOT NULL CHECK (capacity_kg > 0),
  max_height_m        double precision NOT NULL DEFAULT 0 CHECK (max_height_m >= 0),
  max_weight_kg       double precision NOT NULL DEFAULT 0 CHECK (max_weight_kg >= 0),
  avg_speed_kmh       double precision NOT NULL DEFAULT 40 CHECK (avg_speed_kmh > 0),
  active              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER vehicles_updated BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- deliveries ----------------------------------------------------------------
CREATE TABLE deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text        NOT NULL,
  address       text        NOT NULL DEFAULT '',
  latitude      double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude     double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  weight        double precision NOT NULL DEFAULT 0 CHECK (weight >= 0),
  volume        double precision NOT NULL DEFAULT 0 CHECK (volume >= 0),
  priority      integer     NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  geom          geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deliveries_geom_idx ON deliveries USING GIST (geom);
CREATE TRIGGER deliveries_updated BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- route_jobs ----------------------------------------------------------------
CREATE TABLE route_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_id       uuid REFERENCES depots(id) ON DELETE SET NULL,
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','failed')),
  objective      text        NOT NULL DEFAULT 'distance'
                   CHECK (objective IN ('distance','time')),
  total_distance double precision NOT NULL DEFAULT 0,  -- meters
  total_time     double precision NOT NULL DEFAULT 0,  -- seconds
  vehicle_count  integer     NOT NULL DEFAULT 0,
  stop_count     integer     NOT NULL DEFAULT 0,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_jobs_created_idx ON route_jobs (created_at DESC);
CREATE TRIGGER route_jobs_updated BEFORE UPDATE ON route_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- route_results (one row per vehicle used by a job) -------------------------
CREATE TABLE route_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES route_jobs(id) ON DELETE CASCADE,
  vehicle_id      uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_name    text        NOT NULL DEFAULT '',
  color           text        NOT NULL DEFAULT '#2563eb',
  stop_sequence   jsonb       NOT NULL DEFAULT '[]',  -- DeliveryStop[]
  geometry        jsonb       NOT NULL DEFAULT '[]',  -- [lat,lng][]
  total_distance  double precision NOT NULL DEFAULT 0,
  total_time      double precision NOT NULL DEFAULT 0,
  load_kg         double precision NOT NULL DEFAULT 0,
  utilization_pct double precision NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_results_job_idx ON route_results (job_id);
