export function formatCurrency(amount, currency = 'cad') {
  const suffix = (currency ?? 'cad').toUpperCase();
  return `$${Number(amount).toFixed(2)} ${suffix}`;
}
