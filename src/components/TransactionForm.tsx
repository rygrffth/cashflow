'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Calendar, Tag, CreditCard, PenTool, CheckCircle, Loader2, ChevronDown, ChevronUp, BookmarkPlus, RotateCcw, X as CloseIcon } from 'lucide-react';
import { KATEGORI_OPTIONS } from '@/config/categories';
import CurrencyInput from '@/components/CurrencyInput';

interface FormProps {
  saldoBank: number;
  uangCash: number;
  onSuccess: () => void;
  onClose?: () => void;
}

export default function TransactionForm({ saldoBank, uangCash, onSuccess, onClose }: FormProps) {
  // Loading & Feedback States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form States
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const localISODate = new Date(today.getTime() - offset).toISOString().split('T')[0];
    return localISODate;
  });
  const [tipe, setTipe] = useState<'Pengeluaran' | 'Pemasukan' | 'Transfer'>('Pengeluaran');
  const [sumber, setSumber] = useState<'Bank' | 'Cash'>('Bank');
  const [kategori, setKategori] = useState(KATEGORI_OPTIONS[0]);
  const [customKategori, setCustomKategori] = useState('');
  const [nominal, setNominal] = useState<string>('');
  const [catatan, setCatatan] = useState('');

  // Tabungan Sync States
  const [tabunganList, setTabunganList] = useState<any[]>([]);
  const [selectedTabunganId, setSelectedTabunganId] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('tabungan').select('id, nama, nominal_terkumpul, target_nominal, status').then(({ data }) => {
      if (data) setTabunganList(data);
    });
  }, []);

  // Scheduled Settlement States
  const [status, setStatus] = useState<'Cleared' | 'Pending'>('Cleared');
  const [tenggatWaktu, setTenggatWaktu] = useState('');

  // Jastip / Titipan States
  const [showJastip, setShowJastip] = useState(false);
  const [titBank, setTitBank] = useState<string>('');
  const [titCash, setTitCash] = useState<string>('');
  const [titLunas, setTitLunas] = useState(true);

  // Quick Preset Management
  const DEFAULT_PRESETS = [
    { label: '🍛 Makan 25k', tipe: 'Pengeluaran', kat: 'Makan', nom: '25000', note: 'Makan siang' },
    { label: '☕ Kopi 20k', tipe: 'Pengeluaran', kat: 'Makan', nom: '20000', note: 'Kopi / Cemilan' },
    { label: '⛽ Bensin 30k', tipe: 'Pengeluaran', kat: 'Bensin / Mobilitas', nom: '30000', note: 'Bensin' },
    { label: '🛒 Mart 50k', tipe: 'Pengeluaran', kat: 'Belanja Dapur', nom: '50000', note: 'Minimarket' },
    { label: '🅿️ Parkir 2k', tipe: 'Pengeluaran', kat: 'Bensin / Mobilitas', nom: '2000', note: 'Parkir' }
  ];

  const [presets, setPresets] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom_quick_presets');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return DEFAULT_PRESETS;
  });

  const [isEditingPresets, setIsEditingPresets] = useState(false);

  const handleSaveCurrentAsPreset = () => {
    const pNom = Number(nominal);
    if (!pNom || pNom <= 0) {
      alert('Isi nominal terlebih dahulu untuk disimpan sebagai pintasan!');
      return;
    }
    const noteText = catatan.trim() || kategori;
    const shortNom = pNom >= 1000 ? `${Math.round(pNom / 1000)}k` : String(pNom);
    const newPreset = {
      label: `⭐ ${noteText.slice(0, 10)} ${shortNom}`,
      tipe: tipe,
      kat: kategori === 'Lainnya (Ketik Manual...)' ? customKategori : kategori,
      nom: String(pNom),
      note: catatan.trim() || noteText
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_quick_presets', JSON.stringify(updated));
    }
    setSuccessMsg('⭐ Pintasan baru berhasil disimpan!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeletePreset = (index: number) => {
    const updated = presets.filter((_, idx) => idx !== index);
    setPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom_quick_presets', JSON.stringify(updated));
    }
  };

  const handleResetPresets = () => {
    setPresets(DEFAULT_PRESETS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('custom_quick_presets');
    }
    setIsEditingPresets(false);
  };

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

    // Balance check for expenses or transfers
    if (tipe === 'Pengeluaran' || tipe === 'Transfer') {
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
      if (tipe === 'Transfer') {
        const tujuan = sumber === 'Bank' ? 'Cash' : 'Bank';
        const finalCatatan = catatan.trim() || 'Transfer Aset';

        const outboundTx = {
          tanggal: tanggal,
          tipe: 'Pengeluaran',
          kategori: 'Transfer Aset',
          nominal: parsedNominal,
          catatan: `[Transfer Ke ${tujuan}] ${finalCatatan}`.trim(),
          status: 'Cleared',
          tenggat_waktu: '',
          tanggal_bayar: tanggal,
          sumber: sumber,
          titipan: 0
        };

        const inboundTx = {
          tanggal: tanggal,
          tipe: 'Pemasukan',
          kategori: 'Transfer Aset',
          nominal: parsedNominal,
          catatan: `[Transfer Dari ${sumber}] ${finalCatatan}`.trim(),
          status: 'Cleared',
          tenggat_waktu: '',
          tanggal_bayar: tanggal,
          sumber: tujuan,
          titipan: 0
        };

        const { error } = await supabase.from('transaksi').insert([outboundTx, inboundTx]);
        if (error) throw error;

        setSuccessMsg('✅ Transfer aset berhasil dicatat!');
        setNominal('');
        setCatatan('');
        if (onSuccess) onSuccess();
        return;
      }

      // 2. Compute Jastip / Titipan values
      const tBankAmt = Number(titBank || 0);
      const tCashAmt = Number(titCash || 0);
      const totalTitipan = tBankAmt + tCashAmt;

      let finalCatatan = catatan.trim();
      let parts: string[] = [];
      if (tBankAmt > 0) parts.push(`Bank: Rp ${tBankAmt.toLocaleString('id-ID')}`);
      if (tCashAmt > 0) parts.push(`Cash: Rp ${tCashAmt.toLocaleString('id-ID')}`);

      if (totalTitipan > 0) {
        const titDetail = parts.join(', ');
        finalCatatan = `${finalCatatan} (Titipan: ${titDetail}${titLunas ? ' - LUNAS' : ''})`.trim();
      }

      const tglBayar = finalKategori === "Scheduled Settlement" && status === "Pending" ? "" : tanggal;

      // Primary transaction object
      const primaryTx = {
        tanggal: tanggal,
        tipe: tipe,
        kategori: finalKategori,
        nominal: parsedNominal,
        catatan: finalCatatan,
        status: status,
        tenggat_waktu: finalKategori === "Scheduled Settlement" ? tenggatWaktu : "",
        tanggal_bayar: tglBayar,
        sumber: sumber,
        titipan: totalTitipan,
        tabungan_id: (finalKategori === 'Menabung' || finalKategori === 'Tarik Tabungan') ? selectedTabunganId : null
      };

      const transactionsToInsert: any[] = [primaryTx];

      // Auto-insert Pemasukan receipts if jastip is immediately reimbursed (titLunas is checked)
      if (totalTitipan > 0 && titLunas) {
        if (tBankAmt > 0) {
          transactionsToInsert.push({
            tanggal: tanggal,
            tipe: 'Pemasukan',
            kategori: 'Titipan / Jastip',
            nominal: tBankAmt,
            catatan: `Penerimaan Talangan (Bank): ${catatan || finalKategori}`.trim(),
            status: 'Cleared',
            tenggat_waktu: '',
            tanggal_bayar: tanggal,
            sumber: 'Bank',
            titipan: 0
          });
        }
        if (tCashAmt > 0) {
          transactionsToInsert.push({
            tanggal: tanggal,
            tipe: 'Pemasukan',
            kategori: 'Titipan / Jastip',
            nominal: tCashAmt,
            catatan: `Penerimaan Talangan (Cash): ${catatan || finalKategori}`.trim(),
            status: 'Cleared',
            tenggat_waktu: '',
            tanggal_bayar: tanggal,
            sumber: 'Cash',
            titipan: 0
          });
        }
      }

      // Insert directly into Supabase 'transaksi' table
      const { error } = await supabase
        .from('transaksi')
        .insert(transactionsToInsert);

      if (error) throw error;

      // Sync tabungan target balance if linked
      if (selectedTabunganId && (finalKategori === 'Menabung' || finalKategori === 'Tarik Tabungan')) {
        try {
          const { data: targetTabungan } = await supabase
            .from('tabungan')
            .select('*')
            .eq('id', selectedTabunganId)
            .single();

          if (targetTabungan) {
            const curTerkumpul = Number(targetTabungan.nominal_terkumpul) || 0;
            const isSetor = finalKategori === 'Menabung' || tipe === 'Pengeluaran';
            const newTerkumpul = isSetor ? curTerkumpul + parsedNominal : Math.max(0, curTerkumpul - parsedNominal);
            const newStatus = newTerkumpul >= Number(targetTabungan.target_nominal) ? 'Selesai' : 'Aktif';

            await supabase.from('tabungan').update({
              nominal_terkumpul: newTerkumpul,
              status: newStatus
            }).eq('id', selectedTabunganId);
          }
        } catch (syncErr) {
          console.warn('Tabungan sync error on transaction submit:', syncErr);
        }
      }

      // Success
      setSuccessMsg('✅ Transaksi berhasil disimpan ke Supabase!');

      // Reset input fields
      setNominal('');
      setCatatan('');
      setCustomKategori('');
      setSelectedTabunganId(null);
      setTenggatWaktu('');
      setStatus('Cleared');
      setTitBank('');
      setTitCash('');
      setTitLunas(true);
      setShowJastip(false);

      // Call parent refresh
      onSuccess();
    } catch (e: any) {
      console.error('Database write error:', e);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setErrorMsg('❌ Koneksi internet terputus. Silakan hubungkan kembali internet Anda.');
      } else if (e.name === 'AbortError' || (e.message && e.message.toLowerCase().includes('timeout'))) {
        setErrorMsg('⏱️ Koneksi ke database lambat atau time out. Silakan coba lagi.');
      } else {
        setErrorMsg(`❌ Gagal menyimpan data: ${e.message || 'Error tidak diketahui'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentTotalJastip = Number(titBank || 0) + Number(titCash || 0);

  return (
    <div className="glass-card p-6 border-slate-700/40 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
          <PlusCircle className="w-5 h-5" /> Catat Transaksi Baru
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
            title="Tutup Form"
          >
            ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Favorite Presets (1-Tap Fill & Custom Management) */}
        {tipe !== 'Transfer' && (
          <div className="space-y-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                ⚡ Pintasan Cepat (1-Tap):
              </span>
              <div className="flex items-center gap-1.5">
                {nominal && Number(nominal) > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsPreset}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition cursor-pointer"
                    title="Simpan form saat ini sebagai tombol pintasan"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>+ Simpan Pintasan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingPresets(!isEditingPresets)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                >
                  {isEditingPresets ? 'Selesai' : 'Kelola'}
                </button>
                {isEditingPresets && (
                  <button
                    type="button"
                    onClick={handleResetPresets}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 hover:text-rose-300 rounded hover:bg-rose-500/10 transition cursor-pointer"
                    title="Kembalikan ke default"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <div key={idx} className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setTipe(p.tipe as any);
                      setKategori(p.kat);
                      setNominal(p.nom);
                      setCatatan(p.note);
                      if (p.sumber) setSumber(p.sumber);
                    }}
                    className="px-2.5 py-1 bg-slate-800/90 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 rounded-lg text-[11px] font-medium transition cursor-pointer active:scale-95 shadow-sm"
                  >
                    {p.label}
                  </button>
                  {isEditingPresets && (
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(idx)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] shadow cursor-pointer hover:bg-rose-600"
                      title="Hapus pintasan ini"
                    >
                      <CloseIcon className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
              onClick={(e) => (e.target as any).showPicker()}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>📊</span> Tipe Transaksi
            </label>
            <select
              value={tipe}
              onChange={(e) => {
                const newTipe = e.target.value as 'Pengeluaran' | 'Pemasukan' | 'Transfer';
                setTipe(newTipe);
                if (newTipe === 'Transfer') {
                  setKategori('Transfer Aset');
                }
              }}
              className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
            >
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Pemasukan">Pemasukan</option>
              <option value="Transfer">Transfer (Bank ↔ Cash)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Sumber Dana & Kategori */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> {tipe === 'Transfer' ? 'Dari Sumber' : 'Sumber Dana'}
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

          {tipe === 'Transfer' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Ke Sumber
              </label>
              <input
                type="text"
                value={sumber === 'Bank' ? 'Cash' : 'Bank'}
                disabled
                className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm h-[38px] font-semibold cursor-not-allowed opacity-80"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Kategori
              </label>
              <select
                value={kategori}
                onChange={(e) => {
                  const newKat = e.target.value;
                  setKategori(newKat);
                  if (newKat === 'Gaji' || newKat === 'Tarik Tabungan') {
                    setTipe('Pemasukan');
                  } else if (newKat === 'Menabung') {
                    setTipe('Pengeluaran');
                  }
                }}
                className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm h-[38px]"
              >
                {KATEGORI_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dynamic: Target Tabungan Selector */}
        {(kategori === "Menabung" || kategori === "Tarik Tabungan") && (
          <div className="flex flex-col gap-1.5 p-3 bg-emerald-950/20 rounded-lg border border-emerald-500/30 animate-fadeIn">
            <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <span>🎯</span> Target Tabungan Tujuan
            </label>
            <select
              value={selectedTabunganId || ''}
              onChange={(e) => setSelectedTabunganId(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs h-[38px]"
            >
              <option value="">Pilih Target Tabungan (Opsional)...</option>
              {tabunganList.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.nama} (Terkumpul: Rp {Number(tab.nominal_terkumpul).toLocaleString('id-ID')} / Rp {Number(tab.target_nominal).toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </div>
        )}

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
                  onClick={(e) => (e.target as any).showPicker()}
                  className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs h-[30px] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Nominal & Catatan */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 font-bold">💰 Nominal (Rp)</label>
          <CurrencyInput
            placeholder="0"
            value={nominal}
            onChangeValue={(val) => setNominal(val)}
            className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm font-bold w-full"
            required
          />
          {/* Quick Increment Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-slate-400 mr-0.5">Tambah:</span>
            {[
              { label: '+10rb', val: 10000 },
              { label: '+20rb', val: 20000 },
              { label: '+50rb', val: 50000 },
              { label: '+100rb', val: 100000 },
              { label: '+500rb', val: 500000 }
            ].map((chip) => (
              <button
                key={chip.val}
                type="button"
                onClick={() => {
                  const curr = Number(nominal) || 0;
                  setNominal(String(curr + chip.val));
                }}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded text-[10px] font-semibold transition active:scale-95 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
            {nominal && Number(nominal) > 0 ? (
              <button
                type="button"
                onClick={() => setNominal('')}
                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-semibold transition active:scale-95 cursor-pointer ml-auto"
                title="Hapus nominal"
              >
                Reset (C)
              </button>
            ) : null}
          </div>
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

        {/* Jastip / Titipan Expander */}
        {tipe !== 'Transfer' && (
          <div className="border border-slate-700/40 rounded-lg overflow-hidden bg-slate-950/20 text-xs">
            <button
              type="button"
              onClick={() => setShowJastip(!showJastip)}
              className="w-full px-3 py-2 bg-slate-900/60 flex justify-between items-center text-slate-300 font-semibold focus:outline-none hover:text-white"
            >
              <span>💸 Ada Titipan / Talangan Orang? (Jastip v2)</span>
              {showJastip ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showJastip && (
              <div className="p-3.5 space-y-3 border-t border-slate-800/80 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Nominal Talangan Bank (Rp)</label>
                    <CurrencyInput
                      placeholder="0"
                      value={titBank}
                      onChangeValue={(val) => setTitBank(val)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 w-full text-xs font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Nominal Talangan Cash (Rp)</label>
                    <CurrencyInput
                      placeholder="0"
                      value={titCash}
                      onChangeValue={(val) => setTitCash(val)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-emerald-500 w-full text-xs font-bold"
                    />
                  </div>
                </div>

                {currentTotalJastip > 0 && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="titLunas"
                        checked={titLunas}
                        onChange={(e) => setTitLunas(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700 rounded"
                      />
                      <label htmlFor="titLunas" className="text-[11px] text-slate-300 font-bold select-none cursor-pointer">
                        💰 Uang Talangan SUDAH DITERIMA langsung?
                      </label>
                    </div>

                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] leading-relaxed">
                      💡 Web akan otomatis mencatat log Pemasukan jastip senilai Rp {currentTotalJastip.toLocaleString('id-ID')} agar saldo Bank/Cash Anda kembali seimbang.
                    </div>

                    <div className="text-[10px] text-slate-400 italic">
                      Limit harian Anda hanya akan terpotong Rp {Math.max(0, (Number(nominal) || 0) - currentTotalJastip).toLocaleString('id-ID')}.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
