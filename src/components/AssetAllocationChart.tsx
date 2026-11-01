'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as ChartPieIcon, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

interface AssetAllocationChartProps {
  saldoBank: number;
  uangCash: number;
  tabungan: number;
  investasi: number;
  piutang: number;
  isUnlocked: boolean;
  className?: string;
}

interface AssetItem {
  name: string;
  nominal: number;
  color: string;
  icon: string;
}

export default function AssetAllocationChart({
  saldoBank,
  uangCash,
  tabungan,
  investasi,
  piutang,
  isUnlocked,
  className = ''
}: AssetAllocationChartProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const rawItems: AssetItem[] = [
    { name: 'Bank / Rekening', nominal: Math.max(0, saldoBank), color: '#10b981', icon: '🏦' },
    { name: 'Uang Cash', nominal: Math.max(0, uangCash), color: '#14b8a6', icon: '💵' },
    { name: 'Tabungan', nominal: Math.max(0, tabungan), color: '#f59e0b', icon: '💰' },
    { name: 'Portofolio Investasi', nominal: Math.max(0, investasi), color: '#6366f1', icon: '📈' },
    { name: 'Piutang Aktif', nominal: Math.max(0, piutang), color: '#ec4899', icon: '🤝' },
  ];

  const totalSum = rawItems.reduce((acc, curr) => acc + curr.nominal, 0);

  // Filter items with value > 0 for the pie chart
  const chartData = rawItems.filter(item => item.nominal > 0);

  const formatIDR = (val: number) => {
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as AssetItem;
      const pct = totalSum > 0 ? ((data.nominal / totalSum) * 100).toFixed(1) : '0';
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span>{data.icon}</span> {data.name}
          </p>
          <p className="text-emerald-400 font-semibold font-mono">
            {isUnlocked ? formatIDR(data.nominal) : 'Rp ••••••••'}
          </p>
          <p className="text-[11px] text-slate-400">
            Alokasi: <span className="text-white font-bold">{pct}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`glass-card p-5 border-slate-800/80 transition-all ${className}`}>
      {/* Header with Collapse Toggle */}
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ChartPieIcon className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Distribusi & Alokasi Kekayaan
            </h3>
            <p className="text-[11px] text-slate-400">
              Diversifikasi aset likuid, tabungan, investasi & piutang
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition"
          aria-label="Toggle Alokasi"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          {totalSum <= 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Belum ada data saldo aset yang tercatat.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Donut Chart Visual */}
              <div className="md:col-span-5 relative flex items-center justify-center min-h-[190px]">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie
                      data={chartData}
                      dataKey="nominal"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                          className="transition-opacity duration-200 cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Badge inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Total Aset
                  </span>
                  <span className="text-xs font-black text-white mt-0.5">
                    {isUnlocked ? formatIDR(totalSum) : 'Rp ••••••••'}
                  </span>
                </div>
              </div>

              {/* Legend & Breakdown List */}
              <div className="md:col-span-7 space-y-2">
                {rawItems.map((item, idx) => {
                  const pct = totalSum > 0 ? ((item.nominal / totalSum) * 100) : 0;
                  const isHovered = activeIndex !== null && chartData[activeIndex]?.name === item.name;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => {
                        const targetIdx = chartData.findIndex(c => c.name === item.name);
                        if (targetIdx !== -1) setActiveIndex(targetIdx);
                      }}
                      onMouseLeave={() => setActiveIndex(null)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                        isHovered
                          ? 'bg-slate-800/90 border-slate-600 scale-[1.01]'
                          : 'bg-slate-900/50 border-slate-800/60 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-slate-300 font-medium text-[11px] sm:text-xs">
                          {item.icon} {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-slate-200 text-xs font-semibold">
                          {isUnlocked ? formatIDR(item.nominal) : 'Rp ••••••••'}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono min-w-[42px] text-right"
                          style={{ color: item.color, backgroundColor: `${item.color}15` }}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
