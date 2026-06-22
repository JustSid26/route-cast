-- Seed data: one depot, three vehicles, twelve deliveries around Bengaluru.
-- Idempotent: safe to re-run (uses fixed UUIDs + ON CONFLICT).

INSERT INTO depots (id, name, address, latitude, longitude) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Central Distribution Hub', 'Whitefield Main Rd, Bengaluru', 12.9698, 77.7500),
  -- Mumbai depots
  ('44444444-4444-4444-4444-444444444401',
   'Mumbai West Hub', 'Andheri MIDC, Mumbai', 19.1197, 72.8697),
  ('44444444-4444-4444-4444-444444444402',
   'Bhiwandi Logistics Park', 'Bhiwandi, Mumbai Metropolitan Region', 19.2813, 73.0483)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, name, registration_number, capacity_kg, max_height_m, max_weight_kg, avg_speed_kmh, active) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Truck A', 'KA01AB1234', 1500, 2.8, 1500, 35, true),
  ('22222222-2222-2222-2222-222222222202', 'Truck B', 'KA01AB5678', 1000, 2.5, 1000, 40, true),
  ('22222222-2222-2222-2222-222222222203', 'Van C',   'KA01AB9012',  600, 2.0,  600, 45, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO deliveries (id, customer_name, address, latitude, longitude, weight, volume, priority) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Meghana Foods',      'Indiranagar, Bengaluru',   12.9719, 77.6412, 120, 1.2, 2),
  ('33333333-0000-0000-0000-000000000002', 'Koramangala Mart',   'Koramangala, Bengaluru',   12.9352, 77.6245, 220, 2.1, 1),
  ('33333333-0000-0000-0000-000000000003', 'HSR Layout Stores',  'HSR Layout, Bengaluru',    12.9116, 77.6389, 90,  0.8, 3),
  ('33333333-0000-0000-0000-000000000004', 'Jayanagar Traders',  'Jayanagar, Bengaluru',     12.9250, 77.5938, 300, 2.8, 2),
  ('33333333-0000-0000-0000-000000000005', 'MG Road Retail',     'MG Road, Bengaluru',       12.9756, 77.6068, 60,  0.5, 1),
  ('33333333-0000-0000-0000-000000000006', 'Malleshwaram Depot', 'Malleshwaram, Bengaluru',  13.0035, 77.5709, 180, 1.6, 3),
  ('33333333-0000-0000-0000-000000000007', 'Hebbal Logistics',   'Hebbal, Bengaluru',        13.0358, 77.5970, 250, 2.4, 4),
  ('33333333-0000-0000-0000-000000000008', 'Marathahalli Goods', 'Marathahalli, Bengaluru',  12.9591, 77.6974, 140, 1.3, 2),
  ('33333333-0000-0000-0000-000000000009', 'Electronic City Co', 'Electronic City, Bengaluru',12.8452, 77.6602, 320, 3.0, 3),
  ('33333333-0000-0000-0000-000000000010', 'Yelahanka Supply',   'Yelahanka, Bengaluru',     13.1007, 77.5963, 110, 1.0, 4),
  ('33333333-0000-0000-0000-000000000011', 'BTM Layout Shop',    'BTM Layout, Bengaluru',    12.9166, 77.6101, 75,  0.7, 3),
  ('33333333-0000-0000-0000-000000000012', 'Rajajinagar Mart',   'Rajajinagar, Bengaluru',   12.9914, 77.5526, 200, 1.9, 2),
  -- Mumbai delivery destinations (around the Mumbai depots)
  ('55555555-0000-0000-0000-000000000001', 'Bandra Linking Rd Store', 'Bandra West, Mumbai',     19.0596, 72.8295, 140, 1.3, 2),
  ('55555555-0000-0000-0000-000000000002', 'Andheri Lokhandwala',     'Andheri West, Mumbai',    19.1364, 72.8296, 90,  0.8, 1),
  ('55555555-0000-0000-0000-000000000003', 'Powai Hiranandani',       'Powai, Mumbai',           19.1176, 72.9060, 210, 1.9, 3),
  ('55555555-0000-0000-0000-000000000004', 'Dadar Market',            'Dadar West, Mumbai',      19.0178, 72.8478, 160, 1.5, 2),
  ('55555555-0000-0000-0000-000000000005', 'Lower Parel Phoenix',     'Lower Parel, Mumbai',     18.9960, 72.8302, 80,  0.6, 1),
  ('55555555-0000-0000-0000-000000000006', 'Thane Viviana Mall',      'Thane West, Mumbai',      19.2183, 72.9781, 260, 2.4, 4),
  ('55555555-0000-0000-0000-000000000007', 'Borivali National Park',  'Borivali East, Mumbai',   19.2307, 72.8567, 120, 1.1, 3),
  ('55555555-0000-0000-0000-000000000008', 'Malad Infiniti Mall',     'Malad West, Mumbai',      19.1860, 72.8484, 150, 1.4, 2),
  ('55555555-0000-0000-0000-000000000009', 'Chembur Diamond Garden',  'Chembur, Mumbai',         19.0626, 72.8997, 100, 0.9, 3),
  ('55555555-0000-0000-0000-000000000010', 'Vashi Inorbit Mall',      'Vashi, Navi Mumbai',      19.0760, 72.9986, 300, 2.8, 4),
  ('55555555-0000-0000-0000-000000000011', 'Kurla Phoenix Market',    'Kurla West, Mumbai',      19.0726, 72.8845, 110, 1.0, 2),
  ('55555555-0000-0000-0000-000000000012', 'Ghatkopar R City Mall',   'Ghatkopar West, Mumbai',  19.0860, 72.9080, 175, 1.6, 3)
ON CONFLICT (id) DO NOTHING;
