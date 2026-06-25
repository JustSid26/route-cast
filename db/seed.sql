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

-- Mumbai alcohol retailers (wine shops / liquor stores / bars) — delivery stops.
INSERT INTO deliveries (id, customer_name, address, latitude, longitude, weight, volume, priority) VALUES
  ('66666666-0000-0000-0000-000000000001', 'Living Liquidz — Bandra',      'Hill Road, Bandra West, Mumbai',      19.0540, 72.8270, 180, 1.6, 2),
  ('66666666-0000-0000-0000-000000000002', 'Wine Park — Andheri',          'Lokhandwala, Andheri West, Mumbai',   19.1330, 72.8290, 150, 1.4, 2),
  ('66666666-0000-0000-0000-000000000003', 'Discount Wine Shop — Colaba',  'Colaba Causeway, Mumbai',             18.9067, 72.8147, 120, 1.1, 1),
  ('66666666-0000-0000-0000-000000000004', 'Cellar Door Wines — Parel',    'Lower Parel, Mumbai',                 18.9970, 72.8270, 200, 1.9, 2),
  ('66666666-0000-0000-0000-000000000005', 'Aspara Wines — Dadar',         'Dadar West, Mumbai',                  19.0190, 72.8430, 160, 1.5, 3),
  ('66666666-0000-0000-0000-000000000006', 'Madhuram Wines — Powai',       'Hiranandani, Powai, Mumbai',          19.1180, 72.9050, 140, 1.3, 3),
  ('66666666-0000-0000-0000-000000000007', 'Vivek Wines — Vile Parle',     'Vile Parle West, Mumbai',             19.0990, 72.8470, 110, 1.0, 2),
  ('66666666-0000-0000-0000-000000000008', 'Manepally Liquor — Borivali',  'Borivali West, Mumbai',               19.2300, 72.8560, 175, 1.6, 4),
  ('66666666-0000-0000-0000-000000000009', 'Highway Wines — Malad',        'Malad West, Mumbai',                  19.1860, 72.8480, 130, 1.2, 3),
  ('66666666-0000-0000-0000-000000000010', 'Sea Breeze Wines — Worli',     'Worli, Mumbai',                       19.0096, 72.8170, 210, 2.0, 1),
  ('66666666-0000-0000-0000-000000000011', 'Galaxy Wine Shop — Goregaon',  'Goregaon West, Mumbai',               19.1640, 72.8490, 145, 1.3, 3),
  ('66666666-0000-0000-0000-000000000012', 'The Bottle Shop — Khar',       'Khar West, Mumbai',                   19.0710, 72.8330, 125, 1.1, 2),
  ('66666666-0000-0000-0000-000000000013', 'Royal Wines — Chembur',        'Chembur, Mumbai',                     19.0626, 72.8997, 165, 1.5, 3),
  ('66666666-0000-0000-0000-000000000014', 'Empire Wines — Ghatkopar',     'Ghatkopar West, Mumbai',              19.0860, 72.9080, 155, 1.4, 3),
  ('66666666-0000-0000-0000-000000000015', 'Mahalaxmi Wines — Mahalaxmi',  'Mahalaxmi, Mumbai',                   18.9820, 72.8230, 190, 1.8, 2),
  ('66666666-0000-0000-0000-000000000016', 'Juhu Wine Mart — Juhu',        'Juhu, Mumbai',                        19.1075, 72.8263, 135, 1.2, 2),
  ('66666666-0000-0000-0000-000000000017', 'Marine Lines Liquor',          'Marine Lines, Mumbai',                18.9430, 72.8230, 115, 1.0, 1),
  ('66666666-0000-0000-0000-000000000018', 'Kurla Wine Centre — Kurla',    'Kurla West, Mumbai',                  19.0700, 72.8790, 170, 1.6, 3),
  ('66666666-0000-0000-0000-000000000019', 'Thane Spirits — Thane',        'Thane West, Mumbai',                  19.2000, 72.9780, 220, 2.1, 4),
  ('66666666-0000-0000-0000-000000000020', 'Andheri Liquor Mart — MIDC',   'Andheri East MIDC, Mumbai',           19.1136, 72.8697, 160, 1.5, 2)
ON CONFLICT (id) DO NOTHING;

-- ============ stock-aware dispatch seed (generated) ============
INSERT INTO depot_stock (depot_id, brand, category, bottles) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Royal Stag', 'Whisky', 1231),
  ('11111111-1111-1111-1111-111111111111', 'Blenders Pride', 'Whisky', 1054),
  ('11111111-1111-1111-1111-111111111111', 'Signature', 'Whisky', 1304),
  ('11111111-1111-1111-1111-111111111111', 'McDowell''s No.1', 'Whisky', 949),
  ('11111111-1111-1111-1111-111111111111', 'Imperial Blue', 'Whisky', 974),
  ('11111111-1111-1111-1111-111111111111', 'Old Monk', 'Rum', 1448),
  ('11111111-1111-1111-1111-111111111111', 'Bacardi', 'Rum', 996),
  ('11111111-1111-1111-1111-111111111111', 'McDowell''s No.1 Celebration', 'Rum', 1274),
  ('11111111-1111-1111-1111-111111111111', 'Contessa', 'Rum', 1496),
  ('11111111-1111-1111-1111-111111111111', 'Hercules', 'Rum', 959),
  ('11111111-1111-1111-1111-111111111111', 'Magic Moments', 'Vodka', 1419),
  ('11111111-1111-1111-1111-111111111111', 'Smirnoff', 'Vodka', 1119),
  ('11111111-1111-1111-1111-111111111111', 'Absolut', 'Vodka', 938),
  ('11111111-1111-1111-1111-111111111111', 'Romanov', 'Vodka', 988),
  ('11111111-1111-1111-1111-111111111111', 'White Mischief', 'Vodka', 1344),
  ('11111111-1111-1111-1111-111111111111', 'Bombay Sapphire', 'Gin', 1328),
  ('11111111-1111-1111-1111-111111111111', 'Gordon''s', 'Gin', 971),
  ('11111111-1111-1111-1111-111111111111', 'Greater Than', 'Gin', 1146),
  ('11111111-1111-1111-1111-111111111111', 'Blue Riband', 'Gin', 992),
  ('11111111-1111-1111-1111-111111111111', 'Beefeater', 'Gin', 1464),
  ('11111111-1111-1111-1111-111111111111', 'Mansion House', 'Brandy', 1334),
  ('11111111-1111-1111-1111-111111111111', 'Honey Bee', 'Brandy', 960),
  ('11111111-1111-1111-1111-111111111111', 'McDowell''s No.1 Brandy', 'Brandy', 1479),
  ('11111111-1111-1111-1111-111111111111', 'Morpheus', 'Brandy', 1026),
  ('11111111-1111-1111-1111-111111111111', 'Old Admiral', 'Brandy', 1128),
  ('11111111-1111-1111-1111-111111111111', 'Kingfisher', 'Beer', 1496),
  ('11111111-1111-1111-1111-111111111111', 'Budweiser', 'Beer', 963),
  ('11111111-1111-1111-1111-111111111111', 'Heineken', 'Beer', 1490),
  ('11111111-1111-1111-1111-111111111111', 'Carlsberg', 'Beer', 1499),
  ('11111111-1111-1111-1111-111111111111', 'Tuborg', 'Beer', 1306),
  ('11111111-1111-1111-1111-111111111111', 'Sula', 'Wine', 950),
  ('11111111-1111-1111-1111-111111111111', 'Fratelli', 'Wine', 1126),
  ('11111111-1111-1111-1111-111111111111', 'Grover Zampa', 'Wine', 947),
  ('11111111-1111-1111-1111-111111111111', 'Jacob''s Creek', 'Wine', 1470),
  ('11111111-1111-1111-1111-111111111111', 'Big Banyan', 'Wine', 1036),
  ('11111111-1111-1111-1111-111111111111', 'Bacardi Breezer', 'RTD', 1196),
  ('11111111-1111-1111-1111-111111111111', 'Smirnoff Ice', 'RTD', 1329),
  ('11111111-1111-1111-1111-111111111111', 'Kingfisher Radler', 'RTD', 1047),
  ('11111111-1111-1111-1111-111111111111', 'Bro Code', 'RTD', 1453),
  ('11111111-1111-1111-1111-111111111111', 'Tilt', 'RTD', 0),
  ('11111111-1111-1111-1111-111111111111', 'Tango Punch', 'Country Liquor', 1020),
  ('11111111-1111-1111-1111-111111111111', 'Santra No.1', 'Country Liquor', 1484),
  ('11111111-1111-1111-1111-111111111111', 'Narangi Special', 'Country Liquor', 1215),
  ('11111111-1111-1111-1111-111111111111', 'Mosambi Punch', 'Country Liquor', 1473),
  ('11111111-1111-1111-1111-111111111111', 'Gavthi Desi', 'Country Liquor', 1085),
  ('44444444-4444-4444-4444-444444444401', 'Royal Stag', 'Whisky', 50),
  ('44444444-4444-4444-4444-444444444401', 'Blenders Pride', 'Whisky', 150),
  ('44444444-4444-4444-4444-444444444401', 'Signature', 'Whisky', 326),
  ('44444444-4444-4444-4444-444444444401', 'McDowell''s No.1', 'Whisky', 343),
  ('44444444-4444-4444-4444-444444444401', 'Imperial Blue', 'Whisky', 228),
  ('44444444-4444-4444-4444-444444444401', 'Old Monk', 'Rum', 55),
  ('44444444-4444-4444-4444-444444444401', 'Bacardi', 'Rum', 204),
  ('44444444-4444-4444-4444-444444444401', 'McDowell''s No.1 Celebration', 'Rum', 320),
  ('44444444-4444-4444-4444-444444444401', 'Contessa', 'Rum', 362),
  ('44444444-4444-4444-4444-444444444401', 'Hercules', 'Rum', 196),
  ('44444444-4444-4444-4444-444444444401', 'Magic Moments', 'Vodka', 45),
  ('44444444-4444-4444-4444-444444444401', 'Smirnoff', 'Vodka', 195),
  ('44444444-4444-4444-4444-444444444401', 'Absolut', 'Vodka', 338),
  ('44444444-4444-4444-4444-444444444401', 'Romanov', 'Vodka', 232),
  ('44444444-4444-4444-4444-444444444401', 'White Mischief', 'Vodka', 307),
  ('44444444-4444-4444-4444-444444444401', 'Bombay Sapphire', 'Gin', 60),
  ('44444444-4444-4444-4444-444444444401', 'Gordon''s', 'Gin', 316),
  ('44444444-4444-4444-4444-444444444401', 'Greater Than', 'Gin', 289),
  ('44444444-4444-4444-4444-444444444401', 'Blue Riband', 'Gin', 378),
  ('44444444-4444-4444-4444-444444444401', 'Beefeater', 'Gin', 260),
  ('44444444-4444-4444-4444-444444444401', 'Mansion House', 'Brandy', 299),
  ('44444444-4444-4444-4444-444444444401', 'Honey Bee', 'Brandy', 329),
  ('44444444-4444-4444-4444-444444444401', 'McDowell''s No.1 Brandy', 'Brandy', 296),
  ('44444444-4444-4444-4444-444444444401', 'Morpheus', 'Brandy', 272),
  ('44444444-4444-4444-4444-444444444401', 'Old Admiral', 'Brandy', 256),
  ('44444444-4444-4444-4444-444444444401', 'Kingfisher', 'Beer', 40),
  ('44444444-4444-4444-4444-444444444401', 'Budweiser', 'Beer', 226),
  ('44444444-4444-4444-4444-444444444401', 'Heineken', 'Beer', 358),
  ('44444444-4444-4444-4444-444444444401', 'Carlsberg', 'Beer', 379),
  ('44444444-4444-4444-4444-444444444401', 'Tuborg', 'Beer', 242),
  ('44444444-4444-4444-4444-444444444401', 'Sula', 'Wine', 35),
  ('44444444-4444-4444-4444-444444444401', 'Fratelli', 'Wine', 327),
  ('44444444-4444-4444-4444-444444444401', 'Grover Zampa', 'Wine', 256),
  ('44444444-4444-4444-4444-444444444401', 'Jacob''s Creek', 'Wine', 314),
  ('44444444-4444-4444-4444-444444444401', 'Big Banyan', 'Wine', 306),
  ('44444444-4444-4444-4444-444444444401', 'Bacardi Breezer', 'RTD', 267),
  ('44444444-4444-4444-4444-444444444401', 'Smirnoff Ice', 'RTD', 366),
  ('44444444-4444-4444-4444-444444444401', 'Kingfisher Radler', 'RTD', 294),
  ('44444444-4444-4444-4444-444444444401', 'Bro Code', 'RTD', 253),
  ('44444444-4444-4444-4444-444444444401', 'Tilt', 'RTD', 0),
  ('44444444-4444-4444-4444-444444444401', 'Tango Punch', 'Country Liquor', 335),
  ('44444444-4444-4444-4444-444444444401', 'Santra No.1', 'Country Liquor', 198),
  ('44444444-4444-4444-4444-444444444401', 'Narangi Special', 'Country Liquor', 210),
  ('44444444-4444-4444-4444-444444444401', 'Mosambi Punch', 'Country Liquor', 311),
  ('44444444-4444-4444-4444-444444444401', 'Gavthi Desi', 'Country Liquor', 287),
  ('44444444-4444-4444-4444-444444444402', 'Royal Stag', 'Whisky', 1068),
  ('44444444-4444-4444-4444-444444444402', 'Blenders Pride', 'Whisky', 1250),
  ('44444444-4444-4444-4444-444444444402', 'Signature', 'Whisky', 1055),
  ('44444444-4444-4444-4444-444444444402', 'McDowell''s No.1', 'Whisky', 1400),
  ('44444444-4444-4444-4444-444444444402', 'Imperial Blue', 'Whisky', 1331),
  ('44444444-4444-4444-4444-444444444402', 'Old Monk', 'Rum', 940),
  ('44444444-4444-4444-4444-444444444402', 'Bacardi', 'Rum', 979),
  ('44444444-4444-4444-4444-444444444402', 'McDowell''s No.1 Celebration', 'Rum', 1471),
  ('44444444-4444-4444-4444-444444444402', 'Contessa', 'Rum', 1486),
  ('44444444-4444-4444-4444-444444444402', 'Hercules', 'Rum', 1221),
  ('44444444-4444-4444-4444-444444444402', 'Magic Moments', 'Vodka', 1248),
  ('44444444-4444-4444-4444-444444444402', 'Smirnoff', 'Vodka', 1258),
  ('44444444-4444-4444-4444-444444444402', 'Absolut', 'Vodka', 1408),
  ('44444444-4444-4444-4444-444444444402', 'Romanov', 'Vodka', 1493),
  ('44444444-4444-4444-4444-444444444402', 'White Mischief', 'Vodka', 1367),
  ('44444444-4444-4444-4444-444444444402', 'Bombay Sapphire', 'Gin', 970),
  ('44444444-4444-4444-4444-444444444402', 'Gordon''s', 'Gin', 995),
  ('44444444-4444-4444-4444-444444444402', 'Greater Than', 'Gin', 1176),
  ('44444444-4444-4444-4444-444444444402', 'Blue Riband', 'Gin', 1385),
  ('44444444-4444-4444-4444-444444444402', 'Beefeater', 'Gin', 966),
  ('44444444-4444-4444-4444-444444444402', 'Mansion House', 'Brandy', 962),
  ('44444444-4444-4444-4444-444444444402', 'Honey Bee', 'Brandy', 1217),
  ('44444444-4444-4444-4444-444444444402', 'McDowell''s No.1 Brandy', 'Brandy', 1491),
  ('44444444-4444-4444-4444-444444444402', 'Morpheus', 'Brandy', 1356),
  ('44444444-4444-4444-4444-444444444402', 'Old Admiral', 'Brandy', 1191),
  ('44444444-4444-4444-4444-444444444402', 'Kingfisher', 'Beer', 1295),
  ('44444444-4444-4444-4444-444444444402', 'Budweiser', 'Beer', 1255),
  ('44444444-4444-4444-4444-444444444402', 'Heineken', 'Beer', 923),
  ('44444444-4444-4444-4444-444444444402', 'Carlsberg', 'Beer', 1372),
  ('44444444-4444-4444-4444-444444444402', 'Tuborg', 'Beer', 1263),
  ('44444444-4444-4444-4444-444444444402', 'Sula', 'Wine', 1072),
  ('44444444-4444-4444-4444-444444444402', 'Fratelli', 'Wine', 1019),
  ('44444444-4444-4444-4444-444444444402', 'Grover Zampa', 'Wine', 1405),
  ('44444444-4444-4444-4444-444444444402', 'Jacob''s Creek', 'Wine', 960),
  ('44444444-4444-4444-4444-444444444402', 'Big Banyan', 'Wine', 1123),
  ('44444444-4444-4444-4444-444444444402', 'Bacardi Breezer', 'RTD', 1194),
  ('44444444-4444-4444-4444-444444444402', 'Smirnoff Ice', 'RTD', 1032),
  ('44444444-4444-4444-4444-444444444402', 'Kingfisher Radler', 'RTD', 1153),
  ('44444444-4444-4444-4444-444444444402', 'Bro Code', 'RTD', 1307),
  ('44444444-4444-4444-4444-444444444402', 'Tilt', 'RTD', 0),
  ('44444444-4444-4444-4444-444444444402', 'Tango Punch', 'Country Liquor', 1300),
  ('44444444-4444-4444-4444-444444444402', 'Santra No.1', 'Country Liquor', 1408),
  ('44444444-4444-4444-4444-444444444402', 'Narangi Special', 'Country Liquor', 982),
  ('44444444-4444-4444-4444-444444444402', 'Mosambi Punch', 'Country Liquor', 1070),
  ('44444444-4444-4444-4444-444444444402', 'Gavthi Desi', 'Country Liquor', 1359)
ON CONFLICT (depot_id, brand) DO UPDATE SET bottles=EXCLUDED.bottles, category=EXCLUDED.category;

UPDATE deliveries SET order_category='Whisky', order_brand='Royal Stag', order_qty=200 WHERE id='66666666-0000-0000-0000-000000000001';
UPDATE deliveries SET order_category='Beer', order_brand='Kingfisher', order_qty=180 WHERE id='66666666-0000-0000-0000-000000000002';
UPDATE deliveries SET order_category='Vodka', order_brand='Magic Moments', order_qty=150 WHERE id='66666666-0000-0000-0000-000000000003';
UPDATE deliveries SET order_category='Rum', order_brand='Old Monk', order_qty=160 WHERE id='66666666-0000-0000-0000-000000000004';
UPDATE deliveries SET order_category='Wine', order_brand='Sula', order_qty=140 WHERE id='66666666-0000-0000-0000-000000000005';
UPDATE deliveries SET order_category='Gin', order_brand='Bombay Sapphire', order_qty=120 WHERE id='66666666-0000-0000-0000-000000000006';
UPDATE deliveries SET order_category='RTD', order_brand='Tilt', order_qty=60 WHERE id='66666666-0000-0000-0000-000000000007';
UPDATE deliveries SET order_category='Whisky', order_brand='Blenders Pride', order_qty=80 WHERE id='66666666-0000-0000-0000-000000000008';
UPDATE deliveries SET order_category='Whisky', order_brand='Blenders Pride', order_qty=100 WHERE id='66666666-0000-0000-0000-000000000009';
UPDATE deliveries SET order_category='Beer', order_brand='Budweiser', order_qty=90 WHERE id='66666666-0000-0000-0000-000000000010';
UPDATE deliveries SET order_category='Beer', order_brand='Tuborg', order_qty=70 WHERE id='66666666-0000-0000-0000-000000000011';
UPDATE deliveries SET order_category='Vodka', order_brand='Smirnoff', order_qty=60 WHERE id='66666666-0000-0000-0000-000000000012';
UPDATE deliveries SET order_category='Rum', order_brand='Bacardi', order_qty=75 WHERE id='66666666-0000-0000-0000-000000000013';
UPDATE deliveries SET order_category='Brandy', order_brand='Mansion House', order_qty=110 WHERE id='66666666-0000-0000-0000-000000000014';
UPDATE deliveries SET order_category='Brandy', order_brand='Honey Bee', order_qty=95 WHERE id='66666666-0000-0000-0000-000000000015';
UPDATE deliveries SET order_category='Wine', order_brand='Fratelli', order_qty=50 WHERE id='66666666-0000-0000-0000-000000000016';
UPDATE deliveries SET order_category='Gin', order_brand='Gordon''s', order_qty=65 WHERE id='66666666-0000-0000-0000-000000000017';
UPDATE deliveries SET order_category='RTD', order_brand='Bacardi Breezer', order_qty=55 WHERE id='66666666-0000-0000-0000-000000000018';
UPDATE deliveries SET order_category='Country Liquor', order_brand='Tango Punch', order_qty=130 WHERE id='66666666-0000-0000-0000-000000000019';
UPDATE deliveries SET order_category='Whisky', order_brand='Blenders Pride', order_qty=120 WHERE id='66666666-0000-0000-0000-000000000020';
