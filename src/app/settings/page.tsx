'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Loader2, CalendarClock, Lock, Unlock, RefreshCw, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  "Makan",
  "Bensin / Mobilitas",
  "Makan (Sahur/Buka)",
  "Kos",
  "Hiburan",
  "Kebutuhan Lab / Magang",
  "Bulanan",
  "SPay",
  "Belanja Dapur",
  "Penyesuaian",
  "Scheduled Settlement",
  "Titipan / Jastip",
  "Lainnya"
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tanggalGajian, setTanggalGajian] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [localCode, setLocalCode] = useState('');

  // Sync state
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLimit, setSyncLimit] = useState(10);
  const [syncLoading, setSyncLoading] = useState(false);
  const [fetchedRows, setFetchedRows] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);

  // Load secretCode and credentials on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secretCode') || '';
      setLocalCode(saved);
      setSyncEmail(localStorage.getItem('syncEmail') || '');
      setSyncPassword(localStorage.getItem('syncPassword') || '');
    }
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalCode(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('secretCode', val);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('key', 'tanggal_gajian').single();
        if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
        if (data && data.value) {
          setTanggalGajian(data.value);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggalGajian) return;
    
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const { data: existing } = await supabase.from('settings').select('*').eq('key', 'tanggal_gajian').single();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: tanggalGajian, tipe_data: 'date' })
          .eq('key', 'tanggal_gajian');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([{ key: 'tanggal_gajian', value: tanggalGajian, tipe_data: 'date' }]);
        if (error) throw error;
      }

      setSuccessMsg('✅ Tanggal gajian berhasil diperbarui!');
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Gagal memperbarui pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchSync = async () => {
    if (!syncEmail || !syncPassword) {
      setErrorMsg('⚠️ Isi email dan password Gmail terlebih dahulu!');
      return;
    }
    setSyncLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    setFetchedRows([]);

    // Save credentials to localStorage for convenience
    if (typeof window !== 'undefined') {
      localStorage.setItem('syncEmail', syncEmail);
      localStorage.setItem('syncPassword', syncPassword);
    }

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: syncEmail,
          pass: syncPassword,
          limit: syncLimit
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Gagal sinkronisasi');
      }
      
      const rows = data.data || [];
      setFetchedRows(rows);
      setSelectedIndices(rows.map((_: any, i: number) => i)); // select all by default
      
      if (rows.length === 0) {
        setSuccessMsg('Tidak ada transaksi baru yang ditemukan.');
      } else {
        setSuccessMsg(`✅ Ditemukan ${rows.length} data transaksi!`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`❌ Gagal menarik data: ${e.message || 'Error tidak diketahui'}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedIndices.length === 0) return;
    setImporting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const rowsToImport = fetchedRows.filter((_, idx) => selectedIndices.includes(idx));
      
      // Fetch existing transactions to avoid duplicate insertions
      const { data: existingTx, error: fetchErr } = await supabase
        .from('transaksi')
        .select('*');
        
      if (fetchErr) throw fetchErr;
      
      const newRows = [];
      let skippedCount = 0;
      
      for (const row of rowsToImport) {
        const isDup = existingTx.some(tx => 
          tx.nominal === row.nominal && 
          tx.tanggal === row.tanggal && 
          (tx.catatan || '').toLowerCase().includes((row.catatan || '').toLowerCase().slice(0, 15))
        );
        
        if (!isDup) {
          newRows.push({
            tanggal: row.tanggal,
            tipe: row.tipe,
            kategori: row.kategori,
            nominal: row.nominal,
            catatan: row.catatan,
            status: row.status,
            tenggat_waktu: '',
            tanggal_bayar: row.tanggal_bayar,
            sumber: 'Bank',
            titipan: 0
          });
        } else {
          skippedCount++;
        }
      }

      if (newRows.length > 0) {
        const { error } = await supabase.from('transaksi').insert(newRows);
        if (error) throw error;
        
        setSuccessMsg(`✅ Berhasil mengimpor ${newRows.length} transaksi!${skippedCount > 0 ? ` (Melewati ${skippedCount} data terduplikat)` : ''}`);
      } else {
        setSuccessMsg(`ℹ️ Semua transaksi (${skippedCount}) yang dipilih sudah terdaftar di database (terduplikat).`);
      }
      
      setFetchedRows([]);
      setSelectedIndices([]);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`❌ Gagal menyimpan data: ${e.message || 'Error tidak diketahui'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleToggleRow = (idx: number) => {
    setSelectedIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleToggleAll = () => {
    if (selectedIndices.length === fetchedRows.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(fetchedRows.map((_, i) => i));
    }
  };

  const handleUpdateRow = (idx: number, field: string, value: any) => {
    setFetchedRows(prev => 
      prev.map((row, i) => i === idx ? { ...row, [field]: value } : row)
    );
  };

  if (loading) return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat pengaturan...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      <div className="flex items-center gap-2 mb-8">
        <Settings className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">Pengaturan Sistem</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="glass-card p-6 border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-emerald-400" /> Siklus Gajian
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Tanggal ini akan digunakan sebagai acuan untuk menghitung sisa hari dan pembagian limit jajan harian Anda.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            
            {successMsg && <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 p-3 rounded">{successMsg}</div>}
            {errorMsg && <div className="text-xs font-bold text-rose-400 bg-rose-500/10 p-3 rounded">{errorMsg}</div>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Target Tanggal Gajian Berikutnya</label>
              <input
                type="date"
                value={tanggalGajian}
                onChange={e => setTanggalGajian(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2 rounded-lg text-sm transition-all flex justify-center items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Pengaturan
            </button>
          </form>
        </div>

        {/* Mode Admin settings card */}
        <div className="glass-card p-6 border-slate-700/50 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-emerald-400" /> Mode Admin
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Masukkan kode akses untuk mengaktifkan fitur tambahan.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Password</label>
                <input
                  type="password"
                  placeholder="Masukkan password..."
                  value={localCode}
                  onChange={handleCodeChange}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm w-full"
                />
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 text-xs font-medium flex items-center gap-2 transition-all">
                {localCode === 'naufal' ? (
                  <>
                    <Unlock className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span className="text-rose-400 font-bold">🔓 Mode Admin Aktif</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">🔒 Mode User Aktif</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Disguised Sync Card */}
      <div className="glass-card p-6 border-slate-700/50 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" /> Integrasi Layanan Data
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Hubungkan akun eksternal Anda untuk melakukan sinkronisasi log transaksi secara otomatis.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Email Akun</label>
              <input
                type="email"
                placeholder="user@gmail.com"
                value={syncEmail}
                onChange={e => setSyncEmail(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Kode Otorisasi (App Password)</label>
              <input
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={syncPassword}
                onChange={e => setSyncPassword(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Batas Penarikan (1 - 50)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={syncLimit}
                onChange={e => setSyncLimit(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-[10px] text-slate-400 italic">
              *Catatan: Pastikan protokol IMAP aktif pada akun Anda dan gunakan kode sandi aplikasi (App Password).
            </p>
            <button
              onClick={handleFetchSync}
              disabled={syncLoading}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-6 py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-slate-700"
            >
              {syncLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Menghubungkan...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  Hubungkan & Sinkronisasi
                </>
              )}
            </button>
          </div>
        </div>

        {/* Fetch result preview table */}
        {fetchedRows.length > 0 && (
          <div className="border-t border-slate-800/80 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-sm font-bold text-white">📋 Preview Transaksi Hasil Sinkronisasi</h3>
              <p className="text-xs text-slate-400">Pilih dan sesuaikan data sebelum disimpan ke database</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
              <table className="w-full text-left border-collapse text-xs text-slate-300">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIndices.length === fetchedRows.length}
                        onChange={handleToggleAll}
                        className="rounded bg-slate-950 border-slate-850 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                      />
                    </th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Nominal (Rp)</th>
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fetchedRows.map((row, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    return (
                      <tr key={idx} className={`hover:bg-slate-800/20 transition-colors ${isSelected ? 'bg-slate-800/10' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(idx)}
                            className="rounded bg-slate-950 border-slate-850 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={row.tanggal}
                            onChange={e => handleUpdateRow(idx, 'tanggal', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs w-[110px] focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={row.tipe}
                            onChange={e => handleUpdateRow(idx, 'tipe', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Pengeluaran">Pengeluaran</option>
                            <option value="Pemasukan">Pemasukan</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={row.kategori}
                            onChange={e => handleUpdateRow(idx, 'kategori', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={row.nominal}
                            onChange={e => handleUpdateRow(idx, 'nominal', Number(e.target.value))}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs w-[100px] font-semibold focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.catatan}
                            onChange={e => handleUpdateRow(idx, 'catatan', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs w-full max-w-[400px] focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setFetchedRows([])}
                className="px-4 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleImport}
                disabled={importing || selectedIndices.length === 0}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    Mengimpor data...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Simpan ({selectedIndices.length}) Transaksi Pilihan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
