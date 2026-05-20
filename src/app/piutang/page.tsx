'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { HandCoins, RefreshCw, CheckCircle, Clock, PlusCircle, Calendar, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function PiutangPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [piutangData, setPiutangData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Piutang Form States
  const [nama, setNama] = useState('');
  const [nominal, setNominal] = useState<number | ''>('');
  const [sumber, setSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [tenggat, setTenggat] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const offset = nextWeek.getTimezoneOffset() * 60000;
    return new Date(nextWeek.getTime() - offset).toISOString().split('T')[0];
  });
  const [catatan, setCatatan] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Pelunasan modal/inline state
  const [lunasTarget, setLunasTarget] = useState<any | null>(null);
  const [sumberKembali, setSumberKembali] = useState<'Bank' | 'Cash'>('Bank');

  const fetchPiutang = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');

    try {
      // Table piutang does not have a "tanggal" column, order by created_at instead
      const { data, error } = await supabase.from('piutang').select('*').order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Tabel piutang belum dibuat di Supabase.');
        }
        throw error;
      }
      setPiutangData(data || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Gagal mengambil data piutang.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPiutang();
  }, [fetchPiutang]);

  const handleAddPiutang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama || !nominal || Number(nominal) <= 0) {
      setFormError('⚠️ Isi nama peminjam dan nominal > 0');
      return;
    }

    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const todayStr = new Date(today.getTime() - offset).toISOString().split('T')[0];
      const parsedNominal = Number(nominal);

      // 1. Insert to 'piutang' table (Lowercase keys, omit non-existent 'tanggal' and 'sumber' columns)
      const newPiutangObj = {
        nama: nama,
        nominal: parsedNominal,
        catatan: catatan,
        status: 'Belum Lunas',
        tenggat: tenggat,
        tanggal_lunas: null
      };

      const { error: piutangErr } = await supabase
        .from('piutang')
        .insert([newPiutangObj]);

      if (piutangErr) throw piutangErr;

      // 2. Insert transaction log to 'transaksi' (lowercase keys, including 'sumber')
      const txnObj = {
        tanggal: todayStr,
        tipe: 'Pengeluaran',
        kategori: 'Piutang',
        nominal: parsedNominal,
        catatan: `Piutang ke ${nama}: ${catatan}`.trim(),
        status: 'Cleared',
        tenggat_waktu: '',
        tanggal_bayar: todayStr,
        sumber: sumber
      };

      const { error: txnErr } = await supabase
        .from('transaksi')
        .insert([txnObj]);

      if (txnErr) throw txnErr;

      setFormSuccess(`✅ Piutang ke ${nama} berhasil dicatat!`);
      setNama('');
      setNominal('');
      setCatatan('');
      fetchPiutang(true);
    } catch (err: any) {
      console.error(err);
      setFormError(`❌ Error: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleLunas = async () => {
    if (!lunasTarget) return;

    try {
      const today = new Date();
      const offset = today.getTimezoneOffset() * 60000;
      const todayStr = new Date(today.getTime() - offset).toISOString().split('T')[0];

      // 1. Update piutang status to Lunas (Omit 'sumber' since it doesn't exist in piutang table)
      const { error: piutangErr } = await supabase
        .from('piutang')
        .update({
          status: 'Lunas',
          tanggal_lunas: todayStr
        })
        .eq('id', lunasTarget.id);

      if (piutangErr) throw piutangErr;

      // 2. Insert to transaksi as Pemasukan (lowercase keys, including destination 'sumber')
      const txnObj = {
        tanggal: todayStr,
        tipe: 'Pemasukan',
        kategori: 'Piutang Kembali',
        nominal: Number(lunasTarget.nominal || lunasTarget.Nominal),
        catatan: `Pelunasan Piutang: ${lunasTarget.nama || lunasTarget.Nama}`.trim(),
        status: 'Cleared',
        tenggat_waktu: '',
        tanggal_bayar: todayStr,
        sumber: sumberKembali
      };

      const { error: txnErr } = await supabase
        .from('transaksi')
        .insert([txnObj]);

      if (txnErr) throw txnErr;

      alert(`✅ Berhasil mencatat pelunasan piutang ke ${sumberKembali}!`);
      setLunasTarget(null);
      fetchPiutang(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal melunasi: ${err.message}`);
    }
  };

  const handleExtend = async (id: number, currentTenggat: string) => {
    try {
      const current = new Date(currentTenggat);
      current.setDate(current.getDate() + 7);
      const newTenggat = current.toISOString().split('T')[0];

      const { error } = await supabase
        .from('piutang')
        .update({ tenggat: newTenggat })
        .eq('id', id);

      if (error) throw error;
      fetchPiutang(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal memperpanjang tenggat: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus piutang ini secara permanen? (Tindakan ini tidak mencatat log transaksi)')) return;
    
    try {
      const { error } = await supabase.from('piutang').delete().eq('id', id);
      if (error) throw error;
      fetchPiutang(true);
    } catch (err: any) {
      console.error(err);
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  // Safe checks for lowercase/uppercase key fallbacks
  const activePiutang = piutangData.filter(p => (p.status || p.Status) === 'Belum Lunas');
  const historyPiutang = piutangData.filter(p => (p.status || p.Status) === 'Lunas');
  const totalActive = activePiutang.reduce((s, i) => s + Number(i.nominal || i.Nominal || 0), 0);

  // Check deadline
  const isOverdue = (tenggatStr: string) => {
    if (!tenggatStr) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(tenggatStr);
    return due < today;
  };

  const overdueCount = activePiutang.filter(p => isOverdue(p.tenggat || p.Tenggat)).length;

  if (loading) return <div className="text-center text-emerald-400 py-20 animate-pulse">Memuat daftar piutang...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-emerald-400" /> Tracker Piutang (Pinjaman ke Orang)
          </h1>
          <p className="text-sm text-slate-400">Daftar uang Anda yang dipinjam atau dipegang orang lain.</p>
        </div>
        
        <button
          onClick={() => fetchPiutang(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {errorMsg ? (
        <div className="glass-card p-6 border-rose-500/50 bg-rose-500/10">
          <h3 className="text-rose-400 font-bold mb-2">⚠️ Error Data Piutang</h3>
          <p className="text-sm text-slate-300">{errorMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {overdueCount > 0 && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-400 text-xs font-bold animate-pulse">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>💸 Perhatian! Ada {overdueCount} piutang aktif yang telah melewati batas waktu (deadline)!</span>
              </div>
            )}

            {/* Active Piutang */}
            <div className="glass-card p-5 border-slate-700/50">
              <h3 className="font-bold text-lg text-emerald-400 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Piutang Aktif (Belum Lunas)
              </h3>
              
              <div className="space-y-3">
                {activePiutang.length > 0 ? (
                  activePiutang.map(p => {
                    const pTenggat = p.tenggat || p.Tenggat || '';
                    const pNama = p.nama || p.Nama || '';
                    const pNominal = p.nominal || p.Nominal || 0;
                    const pCatatan = p.catatan || p.Catatan || '';
                    const pTanggal = p.created_at ? p.created_at.split('T')[0] : (p.tanggal || p.Tanggal || '');
                    const overdue = isOverdue(pTenggat);
                    return (
                      <div key={p.id} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div>
                          <p className="font-bold text-slate-100 flex items-center gap-2">
                            {pNama}
                            {overdue && <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[8px] rounded uppercase font-black">Overdue</span>}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Dicatat: {pTanggal} • Deadline: <span className={overdue ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>{pTenggat}</span>
                          </p>
                          {pCatatan && <p className="text-[10px] text-slate-500 italic mt-1">&ldquo;{pCatatan}&rdquo;</p>}
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                          <p className="font-black text-amber-400">Rp {Number(pNominal).toLocaleString('id-ID')}</p>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => setLunasTarget(p)}
                              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-extrabold rounded transition"
                            >
                              Lunas
                            </button>
                            <button 
                              onClick={() => handleExtend(p.id, pTenggat)}
                              title="Perpanjang 7 hari"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded transition"
                            >
                              ⏳+
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded transition"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 italic py-4 text-center">Tidak ada piutang aktif.</p>
                )}
              </div>
            </div>

            {/* History Piutang */}
            <div className="glass-card p-5 border-slate-700/50">
              <h3 className="font-bold text-lg text-slate-300 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Riwayat Lunas
              </h3>
              
              <div className="space-y-3">
                {historyPiutang.length > 0 ? (
                  historyPiutang.slice(0, 10).map(p => {
                    const pNama = p.nama || p.Nama || '';
                    const pTanggalLunas = p.tanggal_lunas || p.Tanggal_Lunas || '';
                    const pSumber = p.sumber || p.Sumber || 'Bank/Cash';
                    const pNominal = p.nominal || p.Nominal || 0;
                    return (
                      <div key={p.id} className="p-3 bg-slate-900/30 rounded-xl border border-slate-800 flex justify-between items-center opacity-70">
                        <div>
                          <p className="font-bold text-slate-300 line-through">{pNama}</p>
                          <p className="text-[10px] text-slate-500">Lunas pada: {pTanggalLunas} (Masuk ke {pSumber})</p>
                        </div>
                        <p className="font-bold text-emerald-400/70">Rp {Number(pNominal).toLocaleString('id-ID')}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 italic py-4 text-center">Belum ada riwayat lunas.</p>
                )}
              </div>
            </div>
            
          </div>

          <div className="space-y-4">
            
            {/* Summary */}
            <div className="glass-card p-5 border-amber-500/30 bg-slate-900/10">
              <h3 className="text-sm font-bold text-amber-400 mb-2">Total Piutang</h3>
              <p className="text-3xl font-black text-white">Rp {totalActive.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-400 mt-2">
                Dana ini tidak dihitung dalam Saldo Cash atau Saldo Bank Anda sampai ditandai Lunas.
              </p>
            </div>

            {/* Add New Piutang Form */}
            <div className="glass-card p-5 border-slate-700/50 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" /> Catat Piutang Baru
              </h3>

              {formError && <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded">{formError}</div>}
              {formSuccess && <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded">{formSuccess}</div>}

              <form onSubmit={handleAddPiutang} className="space-y-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Nama Peminjam</label>
                  <input
                    type="text"
                    placeholder="Nama orang..."
                    value={nama}
                    onChange={e => setNama(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Nominal (Rp)</label>
                  <input
                    type="number"
                    placeholder="Nominal..."
                    value={nominal}
                    onChange={e => setNominal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-400">Sumber Dana</label>
                    <select
                      value={sumber}
                      onChange={e => setSumber(e.target.value as 'Bank' | 'Cash')}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none"
                    >
                      <option value="Bank">Bank</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-400">Deadline</label>
                    <input
                      type="date"
                      value={tenggat}
                      onChange={e => setTenggat(e.target.value)}
                      onClick={(e) => (e.target as any).showPicker()}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-[10px] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400">Catatan / Jaminan</label>
                  <textarea
                    placeholder="Catatan opsional..."
                    value={catatan}
                    onChange={e => setCatatan(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs min-h-[50px] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition mt-2 disabled:opacity-50 cursor-pointer text-xs"
                >
                  {formLoading ? 'Menyimpan...' : '💾 Simpan Piutang'}
                </button>
              </form>
            </div>
            
          </div>
          
        </div>
      )}

      {/* Pelunasan Dialog Modal Overlay */}
      {lunasTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card p-6 max-w-sm w-full border-slate-700/50 space-y-4">
            <h3 className="font-bold text-lg text-emerald-400">💰 Konfirmasi Pelunasan</h3>
            <p className="text-xs text-slate-300">
              Piutang dari <strong>{lunasTarget.nama || lunasTarget.Nama}</strong> senilai <strong>Rp {Number(lunasTarget.nominal || lunasTarget.Nominal || 0).toLocaleString('id-ID')}</strong> akan ditandai Lunas.
            </p>

            <div className="flex flex-col gap-1 text-xs">
              <label className="text-[10px] font-semibold text-slate-400">Masuk ke Rekening Mana?</label>
              <select
                value={sumberKembali}
                onChange={e => setSumberKembali(e.target.value as 'Bank' | 'Cash')}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none"
              >
                <option value="Bank">Bank / ATM</option>
                <option value="Cash">Uang Cash</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setLunasTarget(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
              >
                Batal
              </button>
              <button
                onClick={handleLunas}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
