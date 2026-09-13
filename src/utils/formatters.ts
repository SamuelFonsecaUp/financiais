// Format cents to Brazilian Real (e.g. 2590 -> "R$ 25,90")
export function formatCurrency(cents: number, showSign = false): string {
  const isNegative = cents < 0;
  const absValue = Math.abs(cents) / 100;
  const formatted = absValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isNegative) {
    return `- ${formatted}`;
  }
  if (showSign && cents > 0) {
    return `+ ${formatted}`;
  }
  return formatted;
}

// Convert user string input like "1.250,50" or "25,90" into INTEGER cents
export function parseCurrencyInputToCents(val: string): number {
  if (!val) return 0;
  // Remove spaces and non-numeric chars except comma and dot
  const clean = val.replace(/[^\d,\.-]/g, '');
  // Normalize: if contains comma, replace dots (thousand separators) and replace comma with dot
  let normalized = clean;
  if (clean.includes(',')) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  }
  const floatVal = parseFloat(normalized);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

// Format ISO date (YYYY-MM-DD) to Brazilian date (DD/MM/YYYY)
export function formatDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Format month key (YYYY-MM) to Portuguese month name and year (e.g. "2026-09" -> "Setembro de 2026")
export function formatMonthName(monthKey: string): string {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${monthNames[mIndex] || month} de ${year}`;
}

// Get current date formatted as YYYY-MM-DD
export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Get current month formatted as YYYY-MM
export function getCurrentMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}
