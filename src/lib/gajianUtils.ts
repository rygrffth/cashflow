/**
 * Utility for robust Payday (Siklus Gajian) calculation.
 * 
 * Rules:
 * 1. User can store either a full date string "YYYY-MM-DD" OR a day number "1"-"31".
 * 2. If the user picked a future date (targetDate >= today), use that explicit date.
 * 3. If that date has ALREADY passed (targetDate < today), do NOT get stuck at 1 day.
 *    Instead, extract the payday day-of-month and roll forward to the next cycle:
 *    - Check if that day-of-month is still ahead in the current month.
 *    - If today already passed that day in the current month, roll to next month.
 *    - Automatically clamp to the last day of month (e.g. Feb 28, Apr 30).
 * 4. User can still freely change/edit this payday date in Settings anytime!
 */

export interface GajianCalculationResult {
  targetDateStr: string; // e.g. "2026-10-25"
  daysRemaining: number; // e.g. 15 (minimum 1 on payday itself)
  targetDateFormatted: string; // e.g. "25 Okt 2026"
  isPastRolledOver: boolean; // true if auto-rolled forward because past date
  dayOfMonth: number; // e.g. 25
}

export function calculateGajianCycle(
  storedValue: string | null | undefined,
  currentDateStr?: string
): GajianCalculationResult {
  // 1. Get today's WIB date string (YYYY-MM-DD)
  let todayStr = currentDateStr;
  if (!todayStr) {
    const now = new Date();
    // WIB offset UTC+7 hours
    const wibTime = new Date(now.getTime() + 3600000 * 7);
    todayStr = wibTime.toISOString().split('T')[0];
  }

  const [currentYear, currentMonth] = todayStr.split('-').map(Number);

  // Default fallback if not set
  if (!storedValue || !storedValue.trim()) {
    return {
      targetDateStr: todayStr,
      daysRemaining: 1,
      targetDateFormatted: 'Belum diatur',
      isPastRolledOver: false,
      dayOfMonth: 25,
    };
  }

  const cleanVal = storedValue.trim();
  let paydayDay = 25; // default fallback day
  let explicitFutureDate: string | null = null;

  if (cleanVal.includes('-')) {
    // ISO format: YYYY-MM-DD
    const parts = cleanVal.split('-');
    if (parts.length === 3) {
      const parsedDay = parseInt(parts[2], 10);
      if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
        paydayDay = parsedDay;
      }
      // If the explicit date is today or in the future, honor it directly!
      if (cleanVal >= todayStr) {
        explicitFutureDate = cleanVal;
      }
    }
  } else {
    // Just a number string (e.g. "25")
    const parsedDay = parseInt(cleanVal, 10);
    if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
      paydayDay = parsedDay;
    }
  }

  let finalTargetStr = '';
  let isRolledOver = false;

  if (explicitFutureDate) {
    // Target is explicitly chosen in the future or today
    finalTargetStr = explicitFutureDate;
  } else {
    // The stored date was in the past! Roll forward automatically.
    isRolledOver = true;

    // Check Candidate 1: In the CURRENT month (currentYear, currentMonth)
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    const clampedDayCurrent = Math.min(paydayDay, daysInCurrentMonth);
    const candidateThisMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(clampedDayCurrent).padStart(2, '0')}`;

    if (candidateThisMonthStr >= todayStr) {
      // Day is still ahead or is today in current month
      finalTargetStr = candidateThisMonthStr;
    } else {
      // Day has passed in current month, target NEXT month
      let nextYear = currentYear;
      let nextMonth = currentMonth + 1; // 1-13
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      const clampedDayNext = Math.min(paydayDay, daysInNextMonth);
      finalTargetStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedDayNext).padStart(2, '0')}`;
    }
  }

  // Calculate days difference
  const tDate = new Date(todayStr + 'T00:00:00');
  const gDate = new Date(finalTargetStr + 'T00:00:00');
  const diffMs = gDate.getTime() - tDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));
  // If today is payday, diffDays is 0, so days remaining is 1 (today is the last day of cycle)
  const daysRemaining = Math.max(diffDays, 1);

  // Indonesian date formatter
  const [tY, tM, tD] = finalTargetStr.split('-').map(Number);
  const monthNamesId = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const targetDateFormatted = `${tD} ${monthNamesId[tM - 1]} ${tY}`;

  return {
    targetDateStr: finalTargetStr,
    daysRemaining,
    targetDateFormatted,
    isPastRolledOver: isRolledOver,
    dayOfMonth: paydayDay,
  };
}

export interface PaydayCycleRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  formattedLabel: string; // e.g. "25 Okt - 24 Nov 2026"
  paydayDay: number;
}

/**
 * Calculates the exact Start and End dates for a Payday Cycle.
 * E.g. If payday is on the 25th, on 1 Nov 2026 the active cycle is 25 Oct 2026 - 24 Nov 2026.
 * Supports cycleOffset: 0 = current cycle, 1 = 1 cycle ago, 2 = 2 cycles ago, etc.
 */
export function getPaydayCycleRange(
  storedValue: string | null | undefined,
  currentDateStr?: string,
  cycleOffset: number = 0
): PaydayCycleRange {
  // 1. Get reference date
  let todayStr = currentDateStr;
  if (!todayStr) {
    const now = new Date();
    const wibTime = new Date(now.getTime() + 3600000 * 7);
    todayStr = wibTime.toISOString().split('T')[0];
  }

  const [refYear, refMonth, refDay] = todayStr.split('-').map(Number);

  // 2. Parse payday day number
  let paydayDay = 25;
  if (storedValue && storedValue.trim()) {
    const cleanVal = storedValue.trim();
    if (cleanVal.includes('-')) {
      const parts = cleanVal.split('-');
      if (parts.length === 3) {
        const p = parseInt(parts[2], 10);
        if (!isNaN(p) && p >= 1 && p <= 31) paydayDay = p;
      }
    } else {
      const p = parseInt(cleanVal, 10);
      if (!isNaN(p) && p >= 1 && p <= 31) paydayDay = p;
    }
  }

  const monthNamesId = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  // If payday is day 1, cycle is always calendar month
  if (paydayDay === 1) {
    let targetYear = refYear;
    let targetMonth = refMonth - cycleOffset;
    while (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const label = `1 - ${daysInMonth} ${monthNamesId[targetMonth - 1]} ${targetYear}`;
    return { startDate: startStr, endDate: endStr, formattedLabel: label, paydayDay };
  }

  // Base start month and year
  // If today is before payday, cycle started in previous month
  let baseStartYear = refYear;
  let baseStartMonth = refDay < paydayDay ? refMonth - 1 : refMonth;
  if (baseStartMonth < 1) {
    baseStartMonth += 12;
    baseStartYear -= 1;
  }

  // Apply cycleOffset
  let startYear = baseStartYear;
  let startMonth = baseStartMonth - cycleOffset;
  while (startMonth < 1) {
    startMonth += 12;
    startYear -= 1;
  }

  // End month is 1 month after start month
  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }

  // Clamp days
  const daysInStartMonth = new Date(startYear, startMonth, 0).getDate();
  const clampedStartDay = Math.min(paydayDay, daysInStartMonth);

  // End = day before the next cycle's (clamped) start, so cycles never overlap or leave gaps
  const daysInEndMonth = new Date(endYear, endMonth, 0).getDate();
  const nextStartDay = Math.min(paydayDay, daysInEndMonth);
  const clampedEndDay = nextStartDay - 1 >= 1 ? nextStartDay - 1 : daysInEndMonth;

  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(clampedStartDay).padStart(2, '0')}`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(clampedEndDay).padStart(2, '0')}`;

  const formattedLabel = `${clampedStartDay} ${monthNamesId[startMonth - 1]} - ${clampedEndDay} ${monthNamesId[endMonth - 1]} ${endYear}`;

  return {
    startDate,
    endDate,
    formattedLabel,
    paydayDay
  };
}
