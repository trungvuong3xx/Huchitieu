import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, Edit3, Save } from 'lucide-react';
import { db, SIX_JARS_INFO } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND, generateId } from '../utils/formatters';
import { syncWithGoogleSheets } from '../services/syncEngine';
import type { JarCode } from '../types';

export const BudgetsTab: React.FC = () => {
  const { selectedMonthYear, showToast } = useAppStore();
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editAmountStr, setEditAmountStr] = useState<string>('');

  const categories = useLiveQuery(() => db.categories.filter((c) => c.type === 'EXPENSE').toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.where('month_year').equals(selectedMonthYear).toArray(), [selectedMonthYear]) || [];
  const transactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []) || [];

  const monthTransactions = React.useMemo(
    () => transactions.filter((t) => t.date.startsWith(selectedMonthYear)),
    [transactions, selectedMonthYear]
  );

  const totalMonthIncome = React.useMemo(() => {
    return monthTransactions.filter((t) => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  }, [monthTransactions]);

  const jarsSummary = React.useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const spentByJar: Record<JarCode, number> = {
      NEC: 0,
      LTSS: 0,
      EDUC: 0,
      FFA: 0,
      PLAY: 0,
      GIVE: 0,
    };

    for (const tx of monthTransactions) {
      if (tx.type !== 'EXPENSE') continue;
      const cat = catMap.get(tx.category_id);
      const jar = cat?.jar_code || 'NEC';
      spentByJar[jar] = (spentByJar[jar] || 0) + tx.amount;
    }

    return (Object.keys(SIX_JARS_INFO) as JarCode[]).map((code) => {
      const info = SIX_JARS_INFO[code];
      const recommendedLimit = Math.round((totalMonthIncome * info.defaultPct) / 100);
      const spent = spentByJar[code] || 0;
      const pct = recommendedLimit > 0 ? Math.round((spent / recommendedLimit) * 100) : 0;
      return {
        code,
        ...info,
        recommendedLimit,
        spent,
        pct,
      };
    });
  }, [categories, monthTransactions, totalMonthIncome]);

  const categoryBudgetList = React.useMemo(() => {
    const spentByCat: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (tx.type === 'EXPENSE') {
        spentByCat[tx.category_id] = (spentByCat[tx.category_id] || 0) + tx.amount;
      }
    }

    return categories.map((cat) => {
      const budgetObj = budgets.find((b) => b.category_id === cat.id);
      const limit = budgetObj?.amount_limit || 0;
      const spent = spentByCat[cat.id] || 0;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return {
        cat,
        budgetId: budgetObj?.id,
        limit,
        spent,
        pct,
      };
    });
  }, [categories, budgets, monthTransactions]);

  const handleSaveBudget = async (catId: string, existingBudgetId?: string) => {
    const numericLimit = parseInt(editAmountStr.replace(/\D/g, ''), 10) || 0;
    const nowISO = new Date().toISOString();

    await db.budgets.put({
      id: existingBudgetId || generateId('b'),
      month_year: selectedMonthYear,
      category_id: catId,
      amount_limit: numericLimit,
      alert_threshold: 80,
      updated_at: nowISO,
    });

    setEditingCatId(null);
    showToast(`✅ Đã cập nhật hạn mức ${formatVND(numericLimit)}`);
    syncWithGoogleSheets().catch(() => {});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-24 lg:pb-10 items-start">
      {/* Phần 1 (5/12 trên Desktop): Phương pháp 6 Chiếc Hũ Tài Chính Gia Đình */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">🏺 6 Chiếc Hũ Tài Chính Gia Đình</h2>
            <p className="text-xs text-slate-400">
              Tính trên tổng thu nhập tháng: <strong className="text-emerald-400">{formatVND(totalMonthIncome)}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          {jarsSummary.map((jar) => {
            const isOver = jar.pct >= 90;
            const isWarn = jar.pct >= 70 && jar.pct < 90;
            return (
              <div
                key={jar.code}
                className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{jar.icon}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOver
                          ? 'bg-rose-500/20 text-rose-400'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {jar.pct}%
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-100 mt-1.5">{jar.name}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{jar.desc}</div>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-bold text-white">{formatCompactVND(jar.spent)}</span>
                    <span className="text-slate-400">/ {formatCompactVND(jar.recommendedLimit)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? 'bg-rose-500' : isWarn ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, jar.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phần 2 (7/12 trên Desktop): Hạn mức Chi tiêu theo từng Danh mục */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-white">🎯 Trần Chi Tiêu Theo Danh Mục ({selectedMonthYear})</h3>
          <p className="text-xs text-slate-400">
            Đổi màu cảnh báo: <span className="text-emerald-400">Xanh (&lt;70%)</span> →{' '}
            <span className="text-amber-400">Vàng (70-90%)</span> → <span className="text-rose-400">Đỏ (&gt;90%)</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryBudgetList.map(({ cat, budgetId, limit, spent, pct }) => {
            const isEditing = editingCatId === cat.id;
            const barColor =
              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';

            return (
              <div key={cat.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">{cat.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Đã chi: <strong className="text-slate-200">{formatCompactVND(spent)}</strong> /{' '}
                        {limit > 0 ? formatCompactVND(limit) : 'Chưa đặt'}
                      </div>
                    </div>
                  </div>

                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setEditAmountStr(limit > 0 ? String(limit) : '3000000');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Đặt trần
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAmountStr}
                        onChange={(e) => setEditAmountStr(e.target.value)}
                        className="w-24 bg-slate-800 border border-emerald-500 rounded-xl px-2 py-1 text-xs font-bold text-white focus:outline-none"
                        placeholder="5000000"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveBudget(cat.id, budgetId)}
                        className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {limit > 0 && (
                  <div className="mt-3">
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1.5">
                      {pct >= 90 ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Vượt/Sắp vượt ({pct}%)
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> An toàn ({pct}%)
                        </span>
                      )}
                      <span className="text-slate-400">
                        {limit - spent >= 0
                          ? `Còn: ${formatCompactVND(limit - spent)}`
                          : `Vượt: ${formatCompactVND(spent - limit)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
