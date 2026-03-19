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
