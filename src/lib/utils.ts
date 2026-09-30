export function formatYearMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatDisplayDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(timestamp));
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Strip common tracking parameters
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith('utm_') || key === 'ref' || key === 'fbclid' || key === 'gclid') {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => url.searchParams.delete(key));
    // Remove hash
    url.hash = '';
    // Strip trailing slash if pathname ends with /
    let clean = url.toString();
    if (clean.endsWith('/') && url.pathname !== '/') {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim();
  }
}
