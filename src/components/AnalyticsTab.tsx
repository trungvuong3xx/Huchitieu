import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, FilterX } from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND } from '../utils/formatters';

export const AnalyticsTab: React.FC = () => {
  const { selectedMonthYear, shiftMonth } = useAppStore();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'CATEGORY' | 'CASHFLOW'>('CATEGORY');

  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
  const allTransactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []) || [];

  const monthTransactions = React.useMemo(
    () => allTransactions.filter((t) => t.date.startsWith(selectedMonthYear)),
    [allTransactions, selectedMonthYear]
  );

  const categoryBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    let totalExp = 0;

    for (const tx of monthTransactions) {
      if (tx.type !== 'EXPENSE') continue;
      map[tx.category_id] = (map[tx.category_id] || 0) + tx.amount;
      totalExp += tx.amount;
    }

    return Object.entries(map)
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name || 'Khác',
          icon: cat?.icon || '💸',
          color: cat?.color || '#64748b',
          amount,
          pct: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions, categories]);

  const totalMonthExpense = categoryBreakdown.reduce((acc, i) => acc + i.amount, 0);

  const weeklyCashflow = React.useMemo(() => {
    const weeks = [
      { label: 'Tuần 1 (1-7)', Thu: 0, Chi: 0 },
      { label: 'Tuần 2 (8-14)', Thu: 0, Chi: 0 },
      { label: 'Tuần 3 (15-21)', Thu: 0, Chi: 0 },
      { label: 'Tuần 4 (22+)', Thu: 0, Chi: 0 },
    ];

    for (const tx of monthTransactions) {
      const day = parseInt(tx.date.split('-')[2], 10) || 1;
      const idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      if (tx.type === 'INCOME') weeks[idx].Thu += tx.amount;
      if (tx.type === 'EXPENSE') weeks[idx].Chi += tx.amount;
    }
    return weeks;
  }, [monthTransactions]);

  const drilldownTransactions = React.useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'EXPENSE')
      .filter((tx) => (selectedCategoryFilter ? tx.category_id === selectedCategoryFilter : true))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions, selectedCategoryFilter]);

  const [yearStr, monthStr] = selectedMonthYear.split('-');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-10 items-start">
      {/* Cột Trái (7/12): Biểu đồ trực quan */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Báo Cáo Phân Tích</h2>
            <p className="text-sm text-slate-400">Chạm vào danh mục để lọc chi tiết từng khoản</p>
          </div>
          <div className="flex items-center bg-slate-800 rounded-2xl p-1.5 border border-slate-700">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 text-sm font-bold text-slate-200">
              Thg {parseInt(monthStr, 10)}/{yearStr}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2 Tab Biểu đồ tối giản */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setChartMode('CATEGORY')}
            className={`py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
              chartMode === 'CATEGORY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍩 Theo Danh Mục
          </button>
          <button
            type="button"
            onClick={() => setChartMode('CASHFLOW')}
            className={`py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
              chartMode === 'CASHFLOW' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Thu vs Chi Theo Tuần
          </button>
        </div>

        {chartMode === 'CATEGORY' && (
          <div>
            {categoryBreakdown.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500">Chưa có dữ liệu chi tiêu trong tháng này</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-5">
                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={95}
                        paddingAngle={3}
                        onClick={(entry) => {
                          setSelectedCategoryFilter((prev) => (prev === entry.id ? null : entry.id));
                        }}
                      >
                        {categoryBreakdown.map((item) => (
                          <Cell
                            key={item.id}
                            fill={item.color}
                            opacity={!selectedCategoryFilter || selectedCategoryFilter === item.id ? 1 : 0.3}
                            className="cursor-pointer outline-none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => formatVND(val)}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '13px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-400">Tổng Chi</span>
                    <span className="text-lg font-extrabold text-white">{formatCompactVND(totalMonthExpense)}</span>
                  </div>
                </div>

                {/* Chú thích Danh mục */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {categoryBreakdown.map((item) => {
                    const isSelected = selectedCategoryFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(isSelected ? null : item.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/50'
                            : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-bold text-slate-200 truncate">
                            {item.icon} {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-extrabold text-white">{formatCompactVND(item.amount)}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                            {item.pct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {chartMode === 'CASHFLOW' && (
          <div className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCashflow}>
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatCompactVND(v)} />
                <Tooltip
                  formatter={(val: number) => formatVND(val)}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="Thu" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Chi" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cột Phải (5/12): Danh sách các khoản chi lớn nhất */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-300">
            {selectedCategoryFilter
              ? `Chi tiết: ${categories.find((c) => c.id === selectedCategoryFilter)?.name}`
              : 'Các khoản chi lớn nhất tháng'}
          </h3>
          {selectedCategoryFilter && (
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter(null)}
              className="flex items-center gap-1 text-xs sm:text-sm text-emerald-400 hover:underline cursor-pointer"
            >
              <FilterX className="w-4 h-4" /> Bỏ lọc
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/60">
          {drilldownTransactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Chưa có khoản chi nào</div>
          ) : (
            drilldownTransactions.slice(0, 12).map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const member = members.find((m) => m.id === tx.member_id);
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{cat?.icon || '💸'}</span>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-bold text-slate-200 truncate">{tx.note || cat?.name}</div>
                      <div className="text-xs text-slate-400">
                        {tx.date} {member ? `• ${member.avatar} ${member.name}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-rose-400 shrink-0 ml-2">
                    -{formatVND(tx.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
