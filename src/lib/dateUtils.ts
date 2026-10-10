/**
 * Centralized Date & Timezone utilities for Web Keuangan
 * All operations are standardized to WIB (Waktu Indonesia Barat / UTC+7).
 */

/**
 * Returns YYYY-MM-DD string in WIB (UTC+7)
 */
export function getWIBDateString(d: Date = new Date()): string {
  // Add 7 hours to UTC
  const wibTime = new Date(d.getTime() + 3600000 * 7);
  return wibTime.toISOString().split('T')[0];
}

/**
 * Parses YYYY-MM-DD date safely without UTC day-shift
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr || !dateStr.includes('-')) {
    const today = getWIBDateString();
    const [year, month, day] = today.split('-').map(Number);
    return { year, month, day };
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Checks if a dateStr (YYYY-MM-DD) belongs to the given month and year (1-indexed month)
 */
export function isSameMonthYear(dateStr: string, year: number, month: number): boolean {
  if (!dateStr) return false;
  const p = parseDateParts(dateStr);
  return p.year === year && p.month === month;
}

/**
 * Format YYYY-MM-DD to readable Indonesian format: e.g. "10 Okt 2026"
 */
export function formatIndoDate(dateStr: string, withDayName: boolean = false): string {
  if (!dateStr) return '-';
  const { year, month, day } = parseDateParts(dateStr);
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  const mName = shortMonthNames[month - 1] || '';

  if (withDayName) {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
    const dayName = dayNames[d.getDay()] || '';
    return `${dayName}, ${day} ${mName} ${year}`;
  }

  return `${day} ${mName} ${year}`;
}
