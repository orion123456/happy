const WILDBERRIES_HOSTS = new Set(['wildberries.ru', 'www.wildberries.ru']);

export function normalizeWildberriesUrl(url: string): string {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return '';
  }

  try {
    const normalizedUrl = new URL(trimmedUrl);
    normalizedUrl.hash = '';
    return normalizedUrl.toString();
  } catch {
    return trimmedUrl;
  }
}

export function isWildberriesUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(normalizeWildberriesUrl(url));
    return WILDBERRIES_HOSTS.has(parsedUrl.hostname);
  } catch {
    return false;
  }
}

export function extractWildberriesProductId(url: string): string | null {
  const normalizedUrl = normalizeWildberriesUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  const catalogMatch = normalizedUrl.match(/\/catalog\/(\d+)/i);

  if (catalogMatch) {
    return catalogMatch[1];
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const queryProductId = parsedUrl.searchParams.get('nm');

    if (queryProductId && /^\d+$/.test(queryProductId)) {
      return queryProductId;
    }
  } catch {
    return null;
  }

  return null;
}

export function formatGiftPrice(price: number | null, currency: string | null): string | null {
  if (price === null || !Number.isFinite(price)) {
    return null;
  }

  const resolvedCurrency = currency?.trim() || 'RUB';

  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price.toLocaleString('ru-RU')} ${resolvedCurrency}`;
  }
}
