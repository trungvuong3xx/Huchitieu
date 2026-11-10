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

  // 1. Tính tổng Thu nhập tháng để phân bổ tự động vào 6 Chiếc Hũ (JARS)
  const totalMonthIncome = React.useMemo(() => {
    const inc = monthTransactions.filter((t) => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    return inc > 0 ? inc : 25_000_000; // Mặc định tham chiếu 25tr nếu đầu tháng chưa nhập lương
  }, [monthTransactions]);

  // 2. Thống kê tình hình sử dụng 6 Chiếc Hũ
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

  // 3. Thống kê Hạn mức theo từng Danh mục (Category Budgets)
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
    <div className="space-y-4 pb-24">
      {/* Phần 1: Phương pháp 6 Chiếc Hũ Tài Chính Gia Đình */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-white">🏺 6 Chiếc Hũ Tài Chính Gia Đình</h2>
            <p className="text-xs text-slate-400">
              Tính trên tổng thu nhập tháng: <strong className="text-emerald-400">{formatVND(totalMonthIncome)}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {jarsSummary.map((jar) => {
            const isOver = jar.pct >= 90;
            const isWarn = jar.pct >= 70 && jar.pct < 90;
            return (
              <div
                key={jar.code}
                className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base">{jar.icon}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
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
                  <div className="text-xs font-bold text-slate-100 mt-1.5">{jar.name}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-1">{jar.desc}</div>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-baseline justify-between text-[11px] mb-1">
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

      {/* Phần 2: Hạn mức Chi tiêu theo từng Danh mục (Đặt trần & Cảnh báo) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-white">🎯 Trần Chi Tiêu Theo Danh Mục ({selectedMonthYear})</h3>
          <p className="text-xs text-slate-400">
            Đổi màu cảnh báo: <span className="text-emerald-400">Xanh (&lt;70%)</span> →{' '}
            <span className="text-amber-400">Vàng (70-90%)</span> → <span className="text-rose-400">Đỏ (&gt;90%)</span>
          </p>
        </div>

        <div className="space-y-3">
          {categoryBudgetList.map(({ cat, budgetId, limit, spent, pct }) => {
            const isEditing = editingCatId === cat.id;
            const barColor =
              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';

            return (
              <div key={cat.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{cat.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Đã chi: <strong className="text-slate-200">{formatVND(spent)}</strong> /{' '}
                        {limit > 0 ? formatVND(limit) : 'Chưa đặt hạn mức'}
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
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Đặt trần
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAmountStr}
                        onChange={(e) => setEditAmountStr(e.target.value)}
                        className="w-28 bg-slate-800 border border-emerald-500 rounded-xl px-2 py-1 text-xs font-bold text-white focus:outline-none"
                        placeholder="VD: 5000000"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveBudget(cat.id, budgetId)}
                        className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {limit > 0 && (
                  <div className="mt-2.5">
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1">
                      {pct >= 90 ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Cảnh báo: Sắp hoặc đã vượt trần ngân sách!
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Trong tầm kiểm soát ({pct}%)
                        </span>
                      )}
                      <span className="text-slate-400">
                        {limit - spent >= 0
                          ? `Còn được tiêu: ${formatVND(limit - spent)}`
                          : `Vượt hạn mức: ${formatVND(spent - limit)}`}
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
