'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    // Initial check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Do not render anything if online and not in reconnected flash state
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 border transition-all duration-300 animate-fadeIn pointer-events-auto">
      {!isOnline ? (
        <div className="flex items-center gap-2 text-rose-300 bg-rose-950/80 border border-rose-500/40 px-3.5 py-1.5 rounded-full shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Anda sedang offline (Data membaca dari cache lokal)</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3.5 py-1.5 rounded-full shadow-lg">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span>Koneksi pulih (Online kembali)</span>
        </div>
      )}
    </div>
  );
}
