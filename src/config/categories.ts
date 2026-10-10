// Source of truth for categories in the application
export const BASE_CATEGORIES = [
  "Gaji",
  "Bonus / THR",
  "Side Income / Freelance",
  "Rejeki / Hadiah",
  "Makan",
  "Bensin / Mobilitas",
  "Ninis",
  "Kos",
  "Hiburan",
  "Kebutuhan Lab / Magang",
  "Bulanan",
  "SPay",
  "Belanja Dapur",
  "Penyesuaian",
  "Scheduled Settlement",
  "Titipan / Jastip",
  "Piutang",
  "Piutang Kembali",
  "Investasi"
];

// Specific categories for Income (Pemasukan)
export const PEMASUKAN_CATEGORIES = [
  "Gaji",
  "Bonus / THR",
  "Side Income / Freelance",
  "Rejeki / Hadiah",
  "Penyesuaian",
  "Titipan / Jastip",
  "Piutang Kembali",
  "Investasi",
  "Lainnya (Ketik Manual...)"
];

// Specific categories for Expense (Pengeluaran)
export const PENGELUARAN_CATEGORIES = [
  "Makan",
  "Bensin / Mobilitas",
  "Ninis",
  "Kos",
  "Hiburan",
  "Kebutuhan Lab / Magang",
  "Bulanan",
  "SPay",
  "Belanja Dapur",
  "Penyesuaian",
  "Scheduled Settlement",
  "Titipan / Jastip",
  "Piutang",
  "Investasi",
  "Lainnya (Ketik Manual...)"
];

// Categories counted towards daily spending limit
export const JAJAN_CATEGORIES = [
  "Makan",
  "Bensin / Mobilitas",
  "Ninis"
];

// General dropdown options (fallback)
export const KATEGORI_OPTIONS = [
  ...BASE_CATEGORIES,
  "Lainnya (Ketik Manual...)"
];

// Dropdown options for History and Filter pages
export const KATEGORI_HISTORY_OPTIONS = [
  ...BASE_CATEGORIES,
  "Lainnya"
];

// Dropdown options for Gmail Sync page
export const KATEGORI_SYNC_OPTIONS = [
  ...BASE_CATEGORIES.filter(c => c !== "Piutang" && c !== "Piutang Kembali"),
  "Lainnya"
];
