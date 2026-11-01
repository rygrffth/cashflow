/**
 * Dual Password & Privacy Security System for Web Keuangan
 * - Master Password: 'naufal' (Full Admin Mode)
 * - Secondary Password: 'rayhan' (Unlock Tabungan, Settlement, Portofolio & Total Aset)
 * - Secondary password can be customized from Settings by entering the master password ('naufal').
 */

export const MASTER_PASSWORD = 'naufal';
export const DEFAULT_SECONDARY_PASSWORD = 'rayhan';

export function getStoredSecondaryPassword(): string {
  if (typeof window === 'undefined') return DEFAULT_SECONDARY_PASSWORD;
  return localStorage.getItem('secondary_password') || DEFAULT_SECONDARY_PASSWORD;
}

export function setStoredSecondaryPassword(newPass: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('secondary_password', newPass.trim() || DEFAULT_SECONDARY_PASSWORD);
}

export function getActiveAccessCode(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('secretCode') || '';
}

export function notifyPrivacyStateChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('privacy-state-changed'));
  }
}

export function setActiveAccessCode(code: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('secretCode', code.trim());
  notifyPrivacyStateChanged();
}

export function lockPrivacy(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('secretCode');
  notifyPrivacyStateChanged();
}

/**
 * Checks if code has full Master/Admin privileges
 */
export function isMasterAdmin(code?: string): boolean {
  const current = code !== undefined ? code : getActiveAccessCode();
  return (current || '').trim() === MASTER_PASSWORD;
}

/**
 * Checks if code unlocks sensitive financial assets (Tabungan, Settlement, Investasi, Total Aset)
 * Returns true if current code equals MASTER_PASSWORD ('naufal') OR secondary password ('rayhan' / custom)
 */
export function isPrivacyUnlocked(code?: string, customSecondary?: string): boolean {
  const current = (code !== undefined ? code : getActiveAccessCode()).trim();
  if (!current) return false;

  const validSecondary = (customSecondary || getStoredSecondaryPassword()).trim();
  return current === MASTER_PASSWORD || current === validSecondary;
}

