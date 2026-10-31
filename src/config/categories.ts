// Source of truth for categories in the application
export const BASE_CATEGORIES = [
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
  "Investasi",
  "Gaji",
  "Menabung",
  "Tarik Tabungan"
];

// Categories counted towards daily spending limit
export const JAJAN_CATEGORIES = [
  "Makan",
  "Bensin / Mobilitas",
  "Ninis"
];

// Dropdown options for Transaction Input Form
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

// Robust Normalizer Helpers (Enforce case-insensitivity & whitespace trimming)
export const normalizeCategory = (cat?: string | null): string => {
  return (cat || '').trim().toLowerCase();
};

export const isTransferAset = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'transfer aset';
};

export const isScheduledSettlement = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'scheduled settlement';
};

export const isPiutang = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'piutang';
};

export const isPiutangKembali = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'piutang kembali';
};

export const isMenabung = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'menabung';
};

export const isTarikTabungan = (cat?: string | null): boolean => {
  return normalizeCategory(cat) === 'tarik tabungan';
};
