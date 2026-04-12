export function getSeverityRank(severity?: string): number {
  const normalized = severity?.toLowerCase();
  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 4;
  if (normalized === 'medium') return 3;
  if (normalized === 'low') return 2;
  return 1;
}

export function getStatusRank(status?: string): number {
  const normalized = status?.toLowerCase();
  if (normalized === 'open') return 5;
  if (normalized === 'investigating') return 4;
  if (normalized === 'contained') return 3;
  if (normalized === 'resolved') return 2;
  return 1;
}
