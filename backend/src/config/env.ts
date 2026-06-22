// Centralised environment configuration. Read once, validated, exported typed.

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num(process.env.BACKEND_PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://vrp:vrp_password@localhost:5432/vrp',
  optimizationServiceUrl:
    process.env.OPTIMIZATION_SERVICE_URL ?? 'http://localhost:8000',
  ors: {
    apiKey: process.env.ORS_API_KEY?.trim() || null,
    profile: process.env.ORS_PROFILE ?? 'driving-car',
    baseUrl: 'https://api.openrouteservice.org',
    // Geocoding relevance: restrict to a country (ISO code) when no focus point
    // is supplied, and search within this radius (km) of a supplied focus point.
    geocodeCountry: process.env.ORS_GEOCODE_COUNTRY?.trim() || null,
    geocodeRadiusKm: num(process.env.ORS_GEOCODE_RADIUS_KM, 60),
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

export const orsEnabled = Boolean(env.ors.apiKey);
