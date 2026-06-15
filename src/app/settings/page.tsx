'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Loader2, CalendarClock, Lock, Unlock, Database, Shuffle, Tags } from 'lucide-react';
import { BASE_CATEGORIES } from '@/config/categories';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tanggalGajian, setTanggalGajian] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [localCode, setLocalCode] = useState('');

  // Excluded categories settings states
  const [excludeCategories, setExcludeCategories] = useState<string[]>([
    "Transfer Aset",
    "Scheduled Settlement",
    "Penyesuaian",
    "Menabung",
    "Piutang",
    "Piutang Kembali"
  ]);
  const [excludeSuccessMsg, setExcludeSuccessMsg] = useState('');
  const [excludeErrorMsg, setExcludeErrorMsg] = useState('');
  const [savingExclude, setSavingExclude] = useState(false);

  // Category Budgets settings states
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState('');
  const [budgetErrorMsg, setBudgetErrorMsg] = useState('');
  const [savingBudgets, setSavingBudgets] = useState(false);

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

        const { data: excludeData, error: excludeError } = await supabase
          .from('settings')
          .select('*')
          .eq('key', 'exclude_categories')
          .single();
        if (excludeError && excludeError.code !== 'PGRST116') throw excludeError;
        if (excludeData && excludeData.value) {
          try {
            setExcludeCategories(JSON.parse(excludeData.value));
          } catch (e) {
            console.error('Failed to parse excludeCategories:', e);
          }
        }

        const { data: budgetData, error: budgetError } = await supabase
          .from('settings')
          .select('*')
          .eq('key', 'category_budgets')
          .single();
        if (budgetError && budgetError.code !== 'PGRST116') throw budgetError;
        if (budgetData && budgetData.value) {
          try {
            setCategoryBudgets(JSON.parse(budgetData.value));
          } catch (e) {
            console.error('Failed to parse categoryBudgets:', e);
          }
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

  const handleSaveExcludeCategories = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExclude(true);
    setExcludeSuccessMsg('');
    setExcludeErrorMsg('');

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'exclude_categories')
        .single();

      const stringifiedValue = JSON.stringify(excludeCategories);

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: stringifiedValue, tipe_data: 'json' })
          .eq('key', 'exclude_categories');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([{ key: 'exclude_categories', value: stringifiedValue, tipe_data: 'json' }]);
        if (error) throw error;
      }

      setExcludeSuccessMsg('✅ Filter kategori berhasil diperbarui!');
    } catch (e: any) {
      console.error(e);
      setExcludeErrorMsg('Gagal memperbarui filter kategori.');
    } finally {
      setSavingExclude(false);
    }
  };

  const handleSaveCategoryBudgets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBudgets(true);
    setBudgetSuccessMsg('');
    setBudgetErrorMsg('');

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'category_budgets')
        .single();

      // Clean empty/zero budgets
      const cleanedBudgets = Object.entries(categoryBudgets).reduce((acc, [cat, val]) => {
        if (val > 0) acc[cat] = val;
        return acc;
      }, {} as Record<string, number>);

      const stringifiedValue = JSON.stringify(cleanedBudgets);

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: stringifiedValue, tipe_data: 'json' })
          .eq('key', 'category_budgets');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([{ key: 'category_budgets', value: stringifiedValue, tipe_data: 'json' }]);
        if (error) throw error;
      }

      setBudgetSuccessMsg('✅ Anggaran kategori berhasil diperbarui!');
    } catch (e: any) {
      console.error(e);
      setBudgetErrorMsg('Gagal memperbarui anggaran kategori.');
    } finally {
      setSavingBudgets(false);
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

        {/* Filter Kategori Operational */}
        <div className="glass-card p-6 border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Shuffle className="w-5 h-5 text-emerald-400" /> Filter Kategori Operational
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Pilih kategori pengeluaran yang ingin **dikecualikan** dari perhitungan limit harian dan charts di halaman Analytics (misal transfer aset, pinjaman, tabungan).
          </p>

          <form onSubmit={handleSaveExcludeCategories} className="space-y-4">
            {excludeSuccessMsg && <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 p-3 rounded">{excludeSuccessMsg}</div>}
            {excludeErrorMsg && <div className="text-xs font-bold text-rose-400 bg-rose-500/10 p-3 rounded">{excludeErrorMsg}</div>}

            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-2 border border-slate-800 rounded-lg p-3 bg-slate-950/40 text-xs font-medium">
              {BASE_CATEGORIES.map(cat => {
                const checked = excludeCategories.includes(cat);
                return (
                  <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer text-slate-300 hover:text-white transition">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExcludeCategories([...excludeCategories, cat]);
                        } else {
                          setExcludeCategories(excludeCategories.filter(c => c !== cat));
                        }
                      }}
                      className="rounded border-slate-750 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>{cat}</span>
                  </label>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={savingExclude}
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2 rounded-lg text-sm transition-all flex justify-center items-center gap-2"
            >
              {savingExclude ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Filter Kategori
            </button>
          </form>
        </div>

        {/* Anggaran Kategori (Category Budgeting) */}
        <div className="glass-card p-6 border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Tags className="w-5 h-5 text-emerald-400" /> Anggaran Bulanan Kategori
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Atur limit pengeluaran bulanan untuk masing-masing kategori. Isi `0` atau kosongkan untuk menonaktifkan budget pada kategori tersebut.
          </p>

          <form onSubmit={handleSaveCategoryBudgets} className="space-y-4">
            {budgetSuccessMsg && <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 p-3 rounded">{budgetSuccessMsg}</div>}
            {budgetErrorMsg && <div className="text-xs font-bold text-rose-400 bg-rose-500/10 p-3 rounded">{budgetErrorMsg}</div>}

            <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto pr-2 border border-slate-800 rounded-lg p-3 bg-slate-950/40 text-xs">
              {BASE_CATEGORIES.filter(c => c !== "Transfer Aset" && c !== "Scheduled Settlement" && c !== "Penyesuaian" && c !== "Piutang" && c !== "Piutang Kembali").map(cat => {
                const currentVal = categoryBudgets[cat] || '';
                return (
                  <div key={cat} className="flex justify-between items-center gap-4">
                    <span className="text-slate-300 font-medium truncate">{cat}</span>
                    <div className="relative flex-shrink-0 w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">Rp</span>
                      <input
                        type="number"
                        placeholder="Unlimited"
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value));
                          setCategoryBudgets({
                            ...categoryBudgets,
                            [cat]: val
                          });
                        }}
                        className="bg-slate-900 border border-slate-750 rounded px-2 py-1 pl-8 text-right text-white focus:outline-none focus:border-emerald-500 text-xs w-full font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={savingBudgets}
              className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold py-2 rounded-lg text-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
            >
              {savingBudgets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Anggaran Bulanan
            </button>
          </form>
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
