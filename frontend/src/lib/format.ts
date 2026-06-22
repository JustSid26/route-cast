// Display formatters. Backend returns meters + seconds; format for humans here.

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString()} kg`;
}

export function priorityLabel(p: number): string {
  return ['', 'P1 · Highest', 'P2 · High', 'P3 · Normal', 'P4 · Low', 'P5 · Lowest'][p] ?? `P${p}`;
}
