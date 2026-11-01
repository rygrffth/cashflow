'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { lockPrivacy, isPrivacyUnlocked, getActiveAccessCode } from '@/lib/authPrivacy';
import { ShieldAlert, Lock, Check } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes inactivity
const TAB_HIDDEN_TIMEOUT_MS = 60 * 1000; // 1 minute backgrounded

export default function AutoLockManager() {
  const [unlocked, setUnlocked] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEscapePressRef = useRef<number>(0);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const triggerLock = useCallback((reason: string) => {
    lockPrivacy();
    setUnlocked(false);
    showToast(reason);
  }, []);

  // Update unlocked status
  const checkStatus = useCallback(() => {
    setUnlocked(isPrivacyUnlocked(getActiveAccessCode()));
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!unlocked) return;

    inactivityTimerRef.current = setTimeout(() => {
      triggerLock('🔒 Privasi dikunci otomatis (tidak aktif 5 menit)');
    }, INACTIVITY_TIMEOUT_MS);
  }, [unlocked, triggerLock]);

  // Handle privacy state change & storage events
  useEffect(() => {
    checkStatus();

    const handlePrivacyChange = () => {
      checkStatus();
    };

    window.addEventListener('privacy-state-changed', handlePrivacyChange);
    window.addEventListener('storage', handlePrivacyChange);

    return () => {
      window.removeEventListener('privacy-state-changed', handlePrivacyChange);
      window.removeEventListener('storage', handlePrivacyChange);
    };
  }, [checkStatus]);

  // Setup Activity & Keyboard Listeners
  useEffect(() => {
    if (!unlocked) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    resetInactivityTimer();

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Alt + L -> Instant Panic Lock
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        triggerLock('🛡️ Panic Lock: Privasi langsung dikunci!');
        return;
      }

      // 2. Double Escape within 450ms -> Panic Lock
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscapePressRef.current < 450) {
          triggerLock('🛡️ Panic Lock: Privasi langsung dikunci!');
          lastEscapePressRef.current = 0;
        } else {
          lastEscapePressRef.current = now;
        }
      }

      resetInactivityTimer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab minimized or screen locked
        backgroundTimerRef.current = setTimeout(() => {
          triggerLock('🔒 Privasi dikunci otomatis saat tab ditinggalkan');
        }, TAB_HIDDEN_TIMEOUT_MS);
      } else {
        if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
        resetInactivityTimer();
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [unlocked, resetInactivityTimer, triggerLock]);

  return (
    <>
      {/* Toast Alert for Auto/Panic Lock */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top duration-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Panic Button (Only active when data is unlocked) */}
      {unlocked && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={() => triggerLock('🛡️ Privasi berhasil dikunci')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-rose-950/80 text-rose-400 border border-rose-500/30 hover:border-rose-500/60 rounded-full shadow-lg backdrop-blur-md text-xs font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer group"
            title="Klik untuk langsung mengunci privasi (Atau tekan Esc 2x)"
          >
            <Lock className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">Kunci Cepat</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-rose-500/20 rounded border border-rose-500/30 text-rose-300">
              Esc x2
            </kbd>
          </button>
        </div>
      )}
    </>
  );
}
