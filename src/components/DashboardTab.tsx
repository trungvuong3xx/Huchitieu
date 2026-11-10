import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Plus,
  Settings,
} from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND, formatFriendlyDate } from '../utils/formatters';
import { syncWithGoogleSheets } from '../services/syncEngine';
import type { Transaction } from '../types';

export const DashboardTab: React.FC = () => {
  const {
    selectedMonthYear,
    shiftMonth,
    filterMember,
    setFilterMember,
    openQuickAdd,
    setActiveTab,
    showToast,
  } = useAppStore();

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
  const allTransactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []) || [];

  // 1. Tính số dư thực tế của từng Nguồn tiền (Ví)
  const walletBalances = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of wallets) {
      map[w.id] = w.initial_balance;
    }
    for (const tx of allTransactions) {
      if (tx.type === 'INCOME') {
        map[tx.wallet_id] = (map[tx.wallet_id] || 0) + tx.amount;
      } else if (tx.type === 'EXPENSE') {
        map[tx.wallet_id] = (map[tx.wallet_id] || 0) - tx.amount;
      } else if (tx.type === 'TRANSFER') {
        map[tx.wallet_id] = (map[tx.wallet_id] || 0) - tx.amount;
        if (tx.to_wallet_id) {
          map[tx.to_wallet_id] = (map[tx.to_wallet_id] || 0) + tx.amount;
        }
      }
    }
    return map;
  }, [wallets, allTransactions]);

  const totalNetWorth = Object.values(walletBalances).reduce((acc, v) => acc + v, 0);

  // 2. Lọc giao dịch theo Tháng đang chọn & Thành viên
  const monthTransactions = React.useMemo(() => {
    return allTransactions
      .filter((tx) => tx.date.startsWith(selectedMonthYear))
      .filter((tx) => (filterMember === 'ALL' ? true : tx.member_id === filterMember))
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [allTransactions, selectedMonthYear, filterMember]);

  // 3. Tính Tổng Thu & Tổng Chi trong tháng
  const { monthIncome, monthExpense } = React.useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'INCOME') inc += tx.amount;
      if (tx.type === 'EXPENSE') exp += tx.amount;
    }
    return { monthIncome: inc, monthExpense: exp };
  }, [monthTransactions]);

  // 4. Gom nhóm giao dịch theo từng ngày
  const groupedByDate = React.useMemo(() => {
    const groups: { date: string; dayExpense: number; dayIncome: number; items: Transaction[] }[] = [];
    const map = new Map<string, { date: string; dayExpense: number; dayIncome: number; items: Transaction[] }>();

    for (const tx of monthTransactions) {
      if (!map.has(tx.date)) {
        const entry = { date: tx.date, dayExpense: 0, dayIncome: 0, items: [] };
        map.set(tx.date, entry);
        groups.push(entry);
      }
      const group = map.get(tx.date)!;
      group.items.push(tx);
      if (tx.type === 'EXPENSE') group.dayExpense += tx.amount;
      if (tx.type === 'INCOME') group.dayIncome += tx.amount;
    }
    return groups;
  }, [monthTransactions]);

  // Xóa mềm giao dịch
  const handleDeleteTx = async (tx: Transaction) => {
    await db.transactions.update(tx.id, {
      is_deleted: true,
      sync_status: 'PENDING',
      updated_at: new Date().toISOString(),
    });
    showToast(`🗑️ Đã xóa giao dịch ${formatVND(tx.amount)}`);
    syncWithGoogleSheets().catch(() => {});
  };

  const [yearStr, monthStr] = selectedMonthYear.split('-');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-10 items-start">
      {/* CỘT TRÁI (5/12 trên Desktop): Tổng Số Dư & Nguồn Tiền Tối Giản */}
      <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-md">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm text-slate-400 font-medium">Tổng số dư hiện tại</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
                {formatVND(totalNetWorth)}
              </h2>
            </div>

            {/* Bộ chuyển tháng */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-2xl p-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 text-sm font-bold text-slate-200">
                Thg {parseInt(monthStr, 10)}/{yearStr}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Danh sách Nguồn tiền (Chỉ hiện khi đã tạo trong Cài đặt) */}
          {wallets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {wallets.map((w) => {
                const bal = walletBalances[w.id] || 0;
                const owner = members.find((m) => m.id === w.owner_id);
                return (
                  <div
                    key={w.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{w.icon}</span>
                      {owner && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium truncate max-w-[80px]">
                          {owner.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs sm:text-sm text-slate-400 truncate font-medium" title={w.name}>
                        {w.name}
                      </div>
                      <div className={`text-base sm:text-lg font-extrabold mt-0.5 ${bal < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                        {formatCompactVND(bal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-5 p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-700 flex items-center justify-between">
              <div className="text-xs sm:text-sm text-slate-400">
                Chưa có nguồn tiền/ví nào. Bạn có thể thêm trong Cài đặt.
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" /> Thiết lập
              </button>
            </div>
          )}

          {/* Thống kê Thu / Chi / Còn dư trong tháng (Chữ to, rõ ràng) */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-center">
            <div>
              <div className="text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-1 font-medium">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Tổng Thu
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-1">
                +{formatCompactVND(monthIncome)}
              </div>
            </div>
            <div className="border-x border-slate-800">
              <div className="text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-1 font-medium">
                <ArrowUpRight className="w-4 h-4 text-rose-400" /> Tổng Chi
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-rose-400 mt-1">
                -{formatCompactVND(monthExpense)}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-slate-400 font-medium">Còn Dư</div>
              <div
                className={`text-lg sm:text-xl font-extrabold mt-1 ${
                  monthIncome - monthExpense >= 0 ? 'text-sky-400' : 'text-amber-400'
                }`}
              >
                {monthIncome - monthExpense >= 0 ? '+' : ''}
                {formatCompactVND(monthIncome - monthExpense)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI (7/12 trên Desktop): Lịch Sử Giao Dịch Tối Giản */}
      <div className="lg:col-span-7 space-y-4">
        {/* Thanh công cụ Tối giản: Chỉ hiển thị lọc thành viên nếu đã tạo thành viên trong Cài đặt */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterMember('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                filterMember === 'ALL'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              Tất cả giao dịch
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFilterMember(m.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  filterMember === m.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {m.avatar} {m.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openQuickAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" /> Ghi Thu Chi
          </button>
        </div>

        {/* Danh sách Lịch sử Giao dịch theo Ngày */}
        {groupedByDate.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
            <div className="text-4xl mb-3">📝</div>
            <div className="text-base sm:text-lg font-bold text-slate-200">Chưa có giao dịch nào trong tháng này</div>
            <div className="text-sm text-slate-400 mt-1.5">
              Bấm nút <strong className="text-emerald-400">+ Ghi Thu Chi</strong> để bắt đầu ghi chép!
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <div
                key={group.date}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xs"
              >
                {/* Header của Ngày */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-800/60 border-b border-slate-800">
                  <span className="text-sm sm:text-base font-bold text-slate-200 capitalize">
                    {formatFriendlyDate(group.date)}
                  </span>
                  <div className="flex items-center gap-4 text-sm sm:text-base font-extrabold">
                    {group.dayIncome > 0 && <span className="text-emerald-400">+{formatVND(group.dayIncome)}</span>}
                    {group.dayExpense > 0 && <span className="text-rose-400">-{formatVND(group.dayExpense)}</span>}
                  </div>
                </div>

                {/* Các dòng giao dịch trong ngày */}
                <div className="divide-y divide-slate-800/60">
                  {group.items.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.category_id);
                    const wallet = wallets.find((w) => w.id === tx.wallet_id);
                    const toWallet = wallets.find((w) => w.id === tx.to_wallet_id);
                    const member = members.find((m) => m.id === tx.member_id);

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shrink-0 border border-slate-700/60">
                            {tx.type === 'TRANSFER' ? (
                              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                            ) : (
                              cat?.icon || '💸'
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-bold text-slate-100 truncate">
                              {tx.type === 'TRANSFER'
                                ? `Chuyển: ${wallet?.name || 'Ví'} → ${toWallet?.name || 'Ví'}`
                                : cat?.name || 'Giao dịch'}
                            </div>

                            {tx.note && (
                              <div className="text-xs sm:text-sm text-slate-300 truncate mt-0.5">{tx.note}</div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                              {member && (
                                <>
                                  <span className="font-semibold text-slate-300">
                                    {member.avatar} {member.name}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              {wallet && (
                                <>
                                  <span>{wallet.name}</span>
                                  <span>•</span>
                                </>
                              )}
                              {tx.sync_status === 'SYNCED' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-400 inline" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span
                            className={`text-base sm:text-lg font-extrabold ${
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

                          <button
                            type="button"
                            onClick={() => handleDeleteTx(tx)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Xóa giao dịch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
