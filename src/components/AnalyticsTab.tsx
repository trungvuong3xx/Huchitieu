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
import { ChevronLeft, ChevronRight, FilterX, Calendar, ArrowRightLeft } from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND, formatFriendlyDate, getTodayLocalISO } from '../utils/formatters';

export const AnalyticsTab: React.FC = () => {
  const { selectedMonthYear, shiftMonth } = useAppStore();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'CATEGORY' | 'DAILY' | 'CASHFLOW'>('CATEGORY');

  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || [];
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
  const allTransactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []) || [];

  const monthTransactions = React.useMemo(
    () => allTransactions.filter((t) => t.date.startsWith(selectedMonthYear)),
    [allTransactions, selectedMonthYear]
  );

  // 1. Thống kê theo Danh mục
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

  // 2. Thống kê theo Từng Ngày trong tháng (Biểu đồ ngày & Lịch ngày)
  const dailySummary = React.useMemo(() => {
    const [year, month] = selectedMonthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dayMap: Record<string, { date: string; dayLabel: string; Thu: number; Chi: number; count: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonthYear}-${String(d).padStart(2, '0')}`;
      dayMap[dateStr] = {
        date: dateStr,
        dayLabel: `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
        Thu: 0,
        Chi: 0,
        count: 0,
      };
    }

    for (const tx of monthTransactions) {
      if (!dayMap[tx.date]) continue;
      dayMap[tx.date].count += 1;
      if (tx.type === 'INCOME') dayMap[tx.date].Thu += tx.amount;
      if (tx.type === 'EXPENSE') dayMap[tx.date].Chi += tx.amount;
    }

    return Object.values(dayMap);
  }, [monthTransactions, selectedMonthYear]);

  // Những ngày có phát sinh giao dịch (Sắp xếp từ ngày mới nhất -> cũ nhất)
  const activeDaysDesc = React.useMemo(() => {
    return [...dailySummary].filter((d) => d.count > 0).sort((a, b) => b.date.localeCompare(a.date));
  }, [dailySummary]);

  // 3. Thống kê theo 4 Tuần
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

  // 4. Danh sách giao dịch chi tiết bên phải (Lọc theo Ngày đang chọn hoặc Danh mục đang chọn)
  const filteredTransactions = React.useMemo(() => {
    return monthTransactions
      .filter((tx) => (selectedDateFilter ? tx.date === selectedDateFilter : true))
      .filter((tx) => (selectedCategoryFilter ? tx.category_id === selectedCategoryFilter : true))
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [monthTransactions, selectedDateFilter, selectedCategoryFilter]);

  const [yearStr, monthStr] = selectedMonthYear.split('-');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-10 items-start">
      {/* Cột Trái (7/12): Biểu đồ & Thống kê theo Ngày / Danh mục / Tuần */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Báo Cáo Phân Tích</h2>
            <p className="text-sm text-slate-400">Xem cơ cấu danh mục hoặc tra cứu lịch sử thu chi từng ngày</p>
          </div>
          <div className="flex items-center bg-slate-800 rounded-2xl p-1.5 border border-slate-700">
            <button
              type="button"
              onClick={() => {
                shiftMonth(-1);
                setSelectedDateFilter(null);
              }}
              className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 text-sm font-bold text-slate-200">
              Thg {parseInt(monthStr, 10)}/{yearStr}
            </span>
            <button
              type="button"
              onClick={() => {
                shiftMonth(1);
                setSelectedDateFilter(null);
              }}
              className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3 Chế độ Báo cáo: Theo Danh Mục | Theo Ngày | Theo Tuần */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setChartMode('CATEGORY')}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              chartMode === 'CATEGORY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍩 Theo Danh Mục
          </button>
          <button
            type="button"
            onClick={() => setChartMode('DAILY')}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              chartMode === 'DAILY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📅 Lịch Sử Theo Ngày
          </button>
          <button
            type="button"
            onClick={() => setChartMode('CASHFLOW')}
            className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              chartMode === 'CASHFLOW' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Theo Tuần
          </button>
        </div>

        {/* CHẾ ĐỘ 1: THEO DANH MỤC */}
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

        {/* CHẾ ĐỘ 2: LỊCH SỬ THEO NGÀY (Chọn ngày cụ thể + Biểu đồ biến động từng ngày + Bảng tổng hợp ngày) */}
        {chartMode === 'DAILY' && (
          <div className="space-y-5">
            {/* Bộ chọn ngày nhanh */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-slate-200">Chọn ngày cần xem:</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDateFilter || getTodayLocalISO()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDateFilter(val || null);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                />
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 cursor-pointer"
                  >
                    Xem cả tháng
                  </button>
                )}
              </div>
            </div>

            {/* Biểu đồ cột theo các ngày có giao dịch */}
            {activeDaysDesc.length > 0 ? (
              <>
                <div className="h-56 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...activeDaysDesc].reverse()}
                      onClick={(state) => {
                        if (state?.activePayload?.[0]?.payload?.date) {
                          const clickedDate = state.activePayload[0].payload.date;
                          setSelectedDateFilter((prev) => (prev === clickedDate ? null : clickedDate));
                        }
                      }}
                    >
                      <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={12} />
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
                      <Bar dataKey="Thu" fill="#10b981" radius={[6, 6, 0, 0]} className="cursor-pointer" />
                      <Bar dataKey="Chi" fill="#f43f5e" radius={[6, 6, 0, 0]} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Danh sách tổng kết từng ngày trong tháng (Bấm vào ngày nào lọc ngay bên phải) */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Các ngày có giao dịch trong tháng ({activeDaysDesc.length} ngày) — Bấm để xem chi tiết:
                  </div>
                  {activeDaysDesc.map((day) => {
                    const isSelected = selectedDateFilter === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDateFilter(isSelected ? null : day.date)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-100 capitalize">
                            {formatFriendlyDate(day.date)}
                          </div>
                          <div className="text-xs text-slate-400">{day.count} giao dịch</div>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-extrabold">
                          {day.Thu > 0 && <span className="text-emerald-400">+{formatVND(day.Thu)}</span>}
                          {day.Chi > 0 && <span className="text-rose-400">-{formatVND(day.Chi)}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                Chưa có ngày nào phát sinh giao dịch trong tháng này
              </div>
            )}
          </div>
        )}

        {/* CHẾ ĐỘ 3: THEO TUẦN */}
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

      {/* Cột Phải (5/12): Danh sách lịch sử giao dịch theo Ngày / Danh mục đang chọn */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-200">
              {selectedDateFilter
                ? `Lịch sử: ${formatFriendlyDate(selectedDateFilter)}`
                : selectedCategoryFilter
                ? `Danh mục: ${categories.find((c) => c.id === selectedCategoryFilter)?.name}`
                : `Lịch sử giao dịch (${filteredTransactions.length})`}
            </h3>
          </div>

          {(selectedCategoryFilter || selectedDateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter(null);
                setSelectedDateFilter(null);
              }}
              className="flex items-center gap-1 text-xs sm:text-sm text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              <FilterX className="w-4 h-4" /> Bỏ lọc
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[540px] overflow-y-auto pr-1">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Không có giao dịch nào trong {selectedDateFilter ? `ngày ${selectedDateFilter}` : 'mục này'}
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              const wallet = wallets.find((w) => w.id === tx.wallet_id);
              const toWallet = wallets.find((w) => w.id === tx.to_wallet_id);
              const member = members.find((m) => m.id === tx.member_id);
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">
                      {tx.type === 'TRANSFER' ? <ArrowRightLeft className="w-5 h-5 text-blue-400" /> : cat?.icon || '💸'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-bold text-slate-200 truncate">
                        {tx.type === 'TRANSFER'
                          ? `Chuyển: ${wallet?.name || 'Ví'} → ${toWallet?.name || 'Ví'}`
                          : tx.note || cat?.name || 'Giao dịch'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatFriendlyDate(tx.date)}
                        {cat && tx.note ? ` • ${cat.name}` : ''}
                        {member ? ` • ${member.avatar} ${member.name}` : ''}
                        {wallet ? ` • ${wallet.name}` : ''}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-sm sm:text-base font-extrabold shrink-0 ml-2 ${
                      tx.type === 'EXPENSE'
                        ? 'text-rose-400'
                        : tx.type === 'INCOME'
                        ? 'text-emerald-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {tx.type === 'EXPENSE' ? '-' : tx.type === 'INCOME' ? '+' : ''}
                    {formatVND(tx.amount)}
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
