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
import { db, BENEFICIARIES, FAMILY_MEMBERS } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND } from '../utils/formatters';

export const AnalyticsTab: React.FC = () => {
  const { selectedMonthYear, shiftMonth } = useAppStore();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'CATEGORY' | 'BENEFICIARY' | 'CASHFLOW'>('CATEGORY');

  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
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

  const beneficiaryBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (tx.type !== 'EXPENSE') continue;
      map[tx.beneficiary] = (map[tx.beneficiary] || 0) + tx.amount;
    }

    const palette: Record<string, string> = {
      FAMILY: '#10b981',
      KIDS: '#f59e0b',
      HUSBAND: '#3b82f6',
      WIFE: '#ec4899',
      PARENTS: '#a855f7',
    };

    return BENEFICIARIES.map((b) => {
      const amount = map[b.id] || 0;
      return {
        id: b.id,
        name: `${b.icon} ${b.label}`,
        amount,
        color: palette[b.id] || '#10b981',
        pct: totalMonthExpense > 0 ? Math.round((amount / totalMonthExpense) * 100) : 0,
      };
    }).filter((item) => item.amount > 0);
  }, [monthTransactions, totalMonthExpense]);

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-24 lg:pb-10 items-start">
      {/* Cột Trái (7/12 trên Desktop): Biểu đồ trực quan */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Báo Cáo Phân Tích Gia Đình</h2>
            <p className="text-xs text-slate-400">Chạm vào biểu đồ để lọc chi tiết từng khoản bên cạnh</p>
          </div>
          <div className="flex items-center bg-slate-800 rounded-2xl p-1 border border-slate-700">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-bold text-slate-200">
              Thg {parseInt(monthStr, 10)}/{yearStr}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Tab Biểu đồ (Hiện cả trên Mobile, trên PC sẽ hiện thêm cả biểu đồ Cột bên dưới) */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800/80 mb-4">
          <button
            type="button"
            onClick={() => setChartMode('CATEGORY')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              chartMode === 'CATEGORY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍩 Theo Danh Mục
          </button>
          <button
            type="button"
            onClick={() => setChartMode('BENEFICIARY')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              chartMode === 'BENEFICIARY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            👨‍👩‍👧 Chi Cho Ai?
          </button>
          <button
            type="button"
            onClick={() => setChartMode('CASHFLOW')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              chartMode === 'CASHFLOW' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Thu vs Chi
          </button>
        </div>

        {/* Khu vực hiển thị Biểu đồ */}
        {chartMode === 'CATEGORY' && (
          <div>
            {categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">Chưa có dữ liệu chi tiêu trong tháng này</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                <div className="h-60 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={90}
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
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] text-slate-400">Tổng Chi</span>
                    <span className="text-base font-extrabold text-white">{formatCompactVND(totalMonthExpense)}</span>
                  </div>
                </div>

                {/* Chú thích Danh mục */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {categoryBreakdown.map((item) => {
                    const isSelected = selectedCategoryFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(isSelected ? null : item.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/50'
                            : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-medium text-slate-200 truncate">
                            {item.icon} {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-bold text-white">{formatCompactVND(item.amount)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
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

        {chartMode === 'BENEFICIARY' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              Phân bổ chi tiêu theo đối tượng thụ hưởng (Biết rõ tháng này chi cho Con cái, Gia đình hay Cá nhân bao nhiêu %):
            </div>
            {beneficiaryBreakdown.map((b) => (
              <div key={b.id} className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                  <span className="font-bold text-slate-200">{b.name}</span>
                  <span className="font-extrabold text-white">
                    {formatVND(b.amount)} <span className="text-emerald-400">({b.pct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {chartMode === 'CASHFLOW' && (
          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCashflow}>
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => formatCompactVND(v)} />
                <Tooltip
                  formatter={(val: number) => formatVND(val)}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Thu" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Chi" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cột Phải (5/12 trên Desktop): Danh sách Drill-Down các khoản chi lớn nhất */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
            {selectedCategoryFilter
              ? `Chi tiết: ${categories.find((c) => c.id === selectedCategoryFilter)?.name}`
              : 'Top khoản chi lớn nhất tháng'}
          </h3>
          {selectedCategoryFilter && (
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter(null)}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:underline cursor-pointer"
            >
              <FilterX className="w-3.5 h-3.5" /> Bỏ lọc
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/60">
          {drilldownTransactions.slice(0, 12).map((tx) => {
            const cat = categories.find((c) => c.id === tx.category_id);
            const member = FAMILY_MEMBERS.find((m) => m.id === tx.member_id);
            return (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{cat?.icon || '💸'}</span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">{tx.note || cat?.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {tx.date} • {member?.avatar} {member?.name}
                    </div>
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-rose-400 shrink-0 ml-2">
                  -{formatVND(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
