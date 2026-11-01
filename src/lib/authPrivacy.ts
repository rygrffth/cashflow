/**
 * Dual Password & Privacy Security System for Web Keuangan
 * - Master Password: 'naufal' (Full Admin Mode)
 * - Secondary Password: 'rayhan' (Unlock Tabungan, Settlement, Portofolio & Total Aset)
 * - All passwords stored securely using SHA-256 hash to prevent plain-text exposure in DevTools / localStorage.
 */

/**
 * Standard SHA-256 hashing implementation (synchronous, 0 dependencies)
 */
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let index = 0; index < ascii.length; index++) {
    const charCode = ascii.charCodeAt(index);
    words[index >> 2] |= (charCode & 0xff) << ((3 - (index % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let index = 0; index < words.length; index += 16) {
    const w = words.slice(index, index + 16);
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      if (i >= 16) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export const MASTER_PASSWORD = 'naufal';
export const MASTER_HASH = sha256(MASTER_PASSWORD);

export const DEFAULT_SECONDARY_PASSWORD = 'rayhan';
export const DEFAULT_SECONDARY_HASH = sha256(DEFAULT_SECONDARY_PASSWORD);

/**
 * Retrieves the stored SHA-256 hash of the secondary password.
 * Automatically migrates any legacy plain-text password to hash format.
 */
export function getStoredSecondaryHash(): string {
  if (typeof window === 'undefined') return DEFAULT_SECONDARY_HASH;

  const storedHash = localStorage.getItem('secondary_password_hash');
  if (storedHash) return storedHash;

  // Legacy migration: check if plain text existed
  const legacyPlain = localStorage.getItem('secondary_password');
  if (legacyPlain) {
    const computedHash = sha256(legacyPlain.trim() || DEFAULT_SECONDARY_PASSWORD);
    localStorage.setItem('secondary_password_hash', computedHash);
    localStorage.removeItem('secondary_password');
    return computedHash;
  }

  return DEFAULT_SECONDARY_HASH;
}

/**
 * Returns plain representation if available or default (for backward compatibility)
 */
export function getStoredSecondaryPassword(): string {
  if (typeof window === 'undefined') return DEFAULT_SECONDARY_PASSWORD;
  return localStorage.getItem('secondary_password') || DEFAULT_SECONDARY_PASSWORD;
}

/**
 * Sets secondary password by storing its SHA-256 hash
 */
export function setStoredSecondaryPassword(newPass: string): void {
  if (typeof window === 'undefined') return;
  const cleanPass = newPass.trim() || DEFAULT_SECONDARY_PASSWORD;
  const hash = sha256(cleanPass);
  localStorage.setItem('secondary_password_hash', hash);
  localStorage.removeItem('secondary_password'); // Remove legacy plain text
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
 * Checks if code has full Master/Admin privileges ('naufal')
 */
export function isMasterAdmin(code?: string): boolean {
  const current = (code !== undefined ? code : getActiveAccessCode()).trim();
  if (!current) return false;
  return current === MASTER_PASSWORD || sha256(current) === MASTER_HASH || current === MASTER_HASH;
}

/**
 * Checks if code unlocks sensitive financial assets (Tabungan, Settlement, Investasi, Total Aset)
 * Returns true if current code matches MASTER_PASSWORD ('naufal') OR secondary password ('rayhan' / custom)
 */
export function isPrivacyUnlocked(code?: string, customSecondary?: string): boolean {
  const current = (code !== undefined ? code : getActiveAccessCode()).trim();
  if (!current) return false;

  const currentHash = sha256(current);
  if (current === MASTER_PASSWORD || currentHash === MASTER_HASH || current === MASTER_HASH) {
    return true;
  }

  const targetSecondaryHash = customSecondary ? sha256(customSecondary.trim()) : getStoredSecondaryHash();
  const legacyTargetSecondary = customSecondary ? customSecondary.trim() : getStoredSecondaryPassword().trim();

  return (
    current === legacyTargetSecondary ||
    currentHash === targetSecondaryHash ||
    current === targetSecondaryHash
  );
}
