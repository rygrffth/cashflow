'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Calendar, Tag, CreditCard, PenTool, CheckCircle, Loader2 } from 'lucide-react';

interface FormProps {
  saldoBank: number;
  uangCash: number;
  onSuccess: () => void;
}

const KATEGORI_OPTIONS = [
  "Makan (Sahur/Buka)",
  "Bensin / Mobilitas",
  "Bukber / Hiburan",
  "Kebutuhan Lab / Magang",
  "Scheduled Settlement",
  "Lainnya (Ketik Manual...)"
];

export default function TransactionForm({ saldoBank, uangCash, onSuccess }: FormProps) {
  // Loading & Feedback States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form States
  const [tanggal, setTanggal] = useState(() => {
    // Default to today (WIB equivalent: Local timezone date)
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISODate = new Date(today.getTime() - offset).toISOString().split('T')[0];
    return localISODate;
  });
  const [tipe, setTipe] = useState<'Pengeluaran' | 'Pemasukan'>('Pengeluaran');
  const [sumber, setSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [kategori, setKategori] = useState(KATEGORI_OPTIONS[0]);
  const [customKategori, setCustomKategori] = useState('');
  const [nominal, setNominal] = useState<number | ''>('');
  const [catatan, setCatatan] = useState('');

  // Scheduled Settlement States
  const [status, setStatus] = useState<'Cleared' | 'Pending'>('Cleared');
  const [tenggatWaktu, setTenggatWaktu] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const parsedNominal = Number(nominal);

    // 1. Validation
    if (!parsedNominal || parsedNominal <= 0) {
      setErrorMsg('⚠️ Nominal harus lebih dari 0!');
      return;
    }

    const finalKategori = kategori === "Lainnya (Ketik Manual...)" ? customKategori.trim() : kategori;
    if (kategori === "Lainnya (Ketik Manual...)" && !finalKategori) {
      setErrorMsg('⚠️ Silakan isi nama kategori baru!');
      return;
    }

    if (finalKategori === "Scheduled Settlement" && status === "Pending" && !tenggatWaktu) {
      setErrorMsg('⚠️ Isi tanggal jatuh tempo untuk pending settlement!');
      return;
    }

    // Balance check for expenses
    if (tipe === 'Pengeluaran') {
      if (sumber === 'Bank' && parsedNominal > saldoBank) {
        setErrorMsg(`❌ Saldo bank tidak cukup! (Sisa: Rp ${saldoBank.toLocaleString('id-ID')})`);
        return;
      }
      if (sumber === 'Cash' && parsedNominal > uangCash) {
        setErrorMsg(`❌ Saldo cash tidak cukup! (Sisa: Rp ${uangCash.toLocaleString('id-ID')})`);
        return;
      }
    }

    setLoading(true);

    try {
      // Build transaction object mirroring Python `save_to_cloud` format exactly
      const tglBayar = finalKategori === "Scheduled Settlement" && status === "Pending" ? "" : tanggal;
      const transObj = {
        Tanggal: tanggal,
        Tipe: tipe,
        Kategori: finalKategori,
        Nominal: parsedNominal,
        Catatan: catatan,
        Status: status,
        Tenggat_Waktu: finalKategori === "Scheduled Settlement" ? tenggatWaktu : "",
        Tanggal_Bayar: tglBayar,
        Sumber: sumber
      };

      // Insert directly into Supabase 'transaksi' table
      const { error } = await supabase
        .from('transaksi')
        .insert([transObj]);

      if (error) throw error;

      // Success
      setSuccessMsg('✅ Transaksi berhasil disimpan ke Supabase!');
      
      // Reset input fields
      setNominal('');
      setCatatan('');
      setCustomKategori('');
      setTenggatWaktu('');
      setStatus('Cleared');
      
      // Call parent refresh
      onSuccess();
    } catch (e: any) {
      console.error('Database write error:', e);
      setErrorMsg(`❌ Gagal menyimpan data: ${e.message || 'Error tidak diketahui'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 border-slate-700/40 space-y-5">
      <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
        <PlusCircle className="w-5 h-5" /> Catat Transaksi Baru
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* Row 1: Tanggal & Tipe */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Tanggal
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>📊</span> Tipe Transaksi
            </label>
            <select
              value={tipe}
              onChange={(e) => setTipe(e.target.value as 'Pengeluaran' | 'Pemasukan')}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Pemasukan">Pemasukan</option>
            </select>
          </div>
        </div>

        {/* Row 2: Sumber Dana & Kategori */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Sumber Dana
            </label>
            <select
              value={sumber}
              onChange={(e) => setSumber(e.target.value as 'Bank' | 'Cash')}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              <option value="Bank">Bank</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Kategori
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              {KATEGORI_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic: Custom Category Input */}
        {kategori === "Lainnya (Ketik Manual...)" && (
          <div className="flex flex-col gap-1.5 p-3 bg-slate-900/40 rounded-lg border border-slate-800/80">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5" /> Nama Kategori Baru
            </label>
            <input
              type="text"
              placeholder="Contoh: Beli Buku, Servis Motor"
              value={customKategori}
              onChange={(e) => setCustomKategori(e.target.value)}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              required
            />
          </div>
        )}

        {/* Dynamic: Scheduled Settlement Sub-form */}
        {kategori === "Scheduled Settlement" && (
          <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/80 space-y-3">
            <p className="text-[11px] text-slate-400">
              📌 Dana pending tidak memotong saldo hingga status diset &quot;Cleared&quot;.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Cleared' | 'Pending')}
                  className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs h-[30px]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Cleared">Cleared</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400">Jatuh Tempo</label>
                <input
                  type="date"
                  value={tenggatWaktu}
                  min={tanggal}
                  onChange={(e) => setTenggatWaktu(e.target.value)}
                  className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs h-[30px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Nominal & Catatan */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400">💰 Nominal (Rp)</label>
          <input
            type="number"
            placeholder="Nominal transaksi..."
            value={nominal}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : Number(e.target.value);
              setNominal(val);
            }}
            className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm font-bold"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400">📝 Catatan</label>
          <input
            type="text"
            placeholder="Contoh: Makan siang nasi padang"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Menyimpan Transaksi...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Simpan Transaksi
            </>
          )}
        </button>
      </form>
    </div>
  );
}
