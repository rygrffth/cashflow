'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Loader2, CalendarClock, Lock, Unlock, Database, Shuffle } from 'lucide-react';
import { BASE_CATEGORIES } from '@/config/categories';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tanggalGajian, setTanggalGajian] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [localCode, setLocalCode] = useState('');

  // Category Migration States
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [sourceCategory, setSourceCategory] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [migrateSuccess, setMigrateSuccess] = useState('');
  const [migrateError, setMigrateError] = useState('');

  const handleMigrate = async () => {
    if (!sourceCategory || !targetCategory) {
      alert('Pilih kategori asal dan kategori tujuan!');
      return;
    }
    if (sourceCategory === targetCategory) {
      alert('Kategori asal dan kategori tujuan tidak boleh sama!');
      return;
    }
    
    // Fetch count of affected transactions
    const { count: txCount, error: countErr } = await supabase
      .from('transaksi')
      .select('*', { count: 'exact', head: true })
      .eq('kategori', sourceCategory);
      
    if (countErr) {
      alert('Gagal menghitung transaksi: ' + countErr.message);
      return;
    }
    
    if (!txCount || txCount === 0) {
      alert(`Tidak ada transaksi dengan kategori "${sourceCategory}"`);
      return;
    }
    
    const confirmOk = confirm(`Apakah Anda yakin ingin memindahkan ${txCount} transaksi dari "${sourceCategory}" ke "${targetCategory}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmOk) return;
    
    setMigrating(true);
    setMigrateSuccess('');
    setMigrateError('');
    
    try {
      const { error: updateErr } = await supabase
        .from('transaksi')
        .update({ kategori: targetCategory })
        .eq('kategori', sourceCategory);
        
      if (updateErr) throw updateErr;
      
      setMigrateSuccess(`✅ Berhasil memindahkan ${txCount} transaksi dari "${sourceCategory}" ke "${targetCategory}"!`);
      
      // Refresh list
      const updatedCats = existingCategories.filter(c => c !== sourceCategory);
      if (!updatedCats.includes(targetCategory)) {
        updatedCats.push(targetCategory);
      }
      setExistingCategories(updatedCats.sort());
      setSourceCategory('');
    } catch (e: any) {
      console.error(e);
      setMigrateError(`Gagal melakukan migrasi: ${e.message || 'Error tidak diketahui'}`);
    } finally {
      setMigrating(false);
    }
  };

  // Load secretCode on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('secretCode') || '';
      setLocalCode(saved);
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

    async function fetchDistinctCategories() {
      try {
        const { data, error } = await supabase.from('transaksi').select('kategori');
        if (error) throw error;
        if (data) {
          const cats = Array.from(new Set(data.map((t: any) => t.kategori).filter(Boolean))) as string[];
          setExistingCategories(cats.sort());
        }
      } catch (e) {
        console.error('Error fetching distinct categories:', e);
      }
    }

    fetchSettings();
    fetchDistinctCategories();
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
                onClick={(e) => (e.target as any).showPicker()}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
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

      {/* Full-width card for Category Migration */}
      <div className="glass-card p-6 border-slate-700/50 mt-6">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
          <Database className="w-5 h-5 text-amber-400" /> Migrasi Kategori Transaksi
        </h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Pindahkan semua transaksi dari kategori lama ke kategori baru secara masal untuk merapikan histori data keuangan Anda.
        </p>

        {migrateSuccess && <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 p-3 rounded mb-4">{migrateSuccess}</div>}
        {migrateError && <div className="text-xs font-bold text-rose-400 bg-rose-500/10 p-3 rounded mb-4">{migrateError}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Kategori Asal (Lama di Database)</label>
            <select
              value={sourceCategory}
              onChange={e => setSourceCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              <option value="">-- Pilih Kategori Asal --</option>
              {existingCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Kategori Tujuan (Baru)</label>
            <select
              value={targetCategory}
              onChange={e => setTargetCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              <option value="">-- Pilih Kategori Tujuan --</option>
              {BASE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleMigrate}
            disabled={migrating || !sourceCategory || !targetCategory}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-6 py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer border border-slate-700"
          >
            {migrating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                Memindahkan...
              </>
            ) : (
              <>
                <Shuffle className="w-4 h-4 text-amber-400" />
                Migrasikan Kategori
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
