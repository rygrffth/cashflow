'use client';

import React, { useState } from 'react';
import { Lock, Unlock, X, ShieldCheck } from 'lucide-react';
import { isPrivacyUnlocked, isMasterAdmin, setActiveAccessCode, getStoredSecondaryPassword } from '@/lib/authPrivacy';

interface PrivacyUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (isMaster: boolean) => void;
  title?: string;
}

export default function PrivacyUnlockModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Buka Kunci Data Sensitif'
}: PrivacyUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMsg('⚠️ Masukkan password terlebih dahulu.');
      return;
    }

    const secondary = getStoredSecondaryPassword();
    if (isPrivacyUnlocked(trimmed, secondary)) {
      setActiveAccessCode(trimmed);
      const isMaster = isMasterAdmin(trimmed);
      onSuccess(isMaster);
      setPassword('');
      onClose();
    } else {
      setErrorMsg('❌ Password salah. Gunakan password utama (naufal) atau password kedua (rayhan).');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="glass-card max-w-sm w-full p-6 border-slate-700 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" /> {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Masukkan <b>Password Utama</b> (<code>naufal</code>) atau <b>Password Tambahan</b> (<code>rayhan</code>) untuk melihat data nominal rahasia.
        </p>

        {errorMsg && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            autoFocus
            placeholder="Ketik password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-1/2 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" /> Buka Kunci
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
