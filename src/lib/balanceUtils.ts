/**
 * Centralized Balance & Financial Calculations
 * Ensures Dashboard, Analytics, and Portfolio modules produce 100% consistent numbers.
 */

export interface TransactionRecord {
  id?: number;
  tanggal?: string;
  tipe?: 'Pemasukan' | 'Pengeluaran' | string;
  kategori?: string;
  nominal?: number | string;
  sumber?: 'Bank' | 'Cash' | string;
  status?: string;
  titipan?: number | string;
  tabungan_id?: number | null;
  [key: string]: any;
}

export interface ComputedBalances {
  saldoBank: number;
  uangCash: number;
  totalAset: number;
  saldoOp: number;
  totalTabungan: number;
  totalInvestasi: number;
}

export function computeFinancialBalances(
  transactions: TransactionRecord[],
  totalTabungan: number = 0,
  totalInvestasi: number = 0
): ComputedBalances {
  let inBank = 0;
  let outBank = 0;
  let inCash = 0;
  let outCash = 0;

  for (const t of transactions) {
    const nom = Number(t.nominal) || 0;
    const isPendingSettlement = t.kategori === 'Scheduled Settlement' && t.status === 'Pending';
    
    // Ignore pending settlement from balance impact until cleared
    if (isPendingSettlement) continue;

    if (t.tipe === 'Pemasukan') {
      if (t.sumber === 'Bank') inBank += nom;
      else if (t.sumber === 'Cash') inCash += nom;
    } else if (t.tipe === 'Pengeluaran') {
      if (t.sumber === 'Bank') outBank += nom;
      else if (t.sumber === 'Cash') outCash += nom;
    }
  }

  const saldoBank = inBank - outBank;
  const uangCash = inCash - outCash;

  // Dana Operasional: Dana likuid siap pakai (Bank + Cash)
  const saldoOp = saldoBank + uangCash;

  // Total Aset: Saldo Likuid + Tabungan Terkumpul + Nilai Portofolio Investasi
  const totalAset = saldoBank + uangCash + totalTabungan + totalInvestasi;

  return {
    saldoBank,
    uangCash,
    totalAset,
    saldoOp,
    totalTabungan,
    totalInvestasi
  };
}
