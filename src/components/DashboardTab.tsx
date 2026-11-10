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
  Wallet as WalletIcon,
  Sparkles,
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

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const members = useLiveQuery(() => db.members.toArray(), []);
  const allTransactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []);

  const isLoading = wallets === undefined || allTransactions === undefined;

  // 1. Tính số dư thực tế của từng Nguồn tiền (Ví) - Bảo vệ nghiêm ngặt chống ví rác/ví đã xóa
  const walletBalances = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (!wallets || !allTransactions) return map;

    for (const w of wallets) {
      map[w.id] = w.initial_balance;
    }
    for (const tx of allTransactions) {
      if (map[tx.wallet_id] !== undefined) {
        if (tx.type === 'INCOME') {
          map[tx.wallet_id] += tx.amount;
        } else if (tx.type === 'EXPENSE') {
          map[tx.wallet_id] -= tx.amount;
        } else if (tx.type === 'TRANSFER') {
          map[tx.wallet_id] -= tx.amount;
        }
      }
      if (tx.type === 'TRANSFER' && tx.to_wallet_id && map[tx.to_wallet_id] !== undefined) {
        map[tx.to_wallet_id] += tx.amount;
      }
    }
    return map;
  }, [wallets, allTransactions]);

  const totalNetWorth = Object.values(walletBalances).reduce((acc, v) => acc + v, 0);

  // 2. Lọc giao dịch theo Tháng đang chọn & Thành viên
  const monthTransactions = React.useMemo(() => {
    if (!allTransactions) return [];
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

  // SKELETON STATE KHI ĐANG TẢI DỮ LIỆU
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-10 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-64 skeleton-shimmer" />
        </div>
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl h-14 skeleton-shimmer" />
          <div className="bg-slate-900 border border-slate-800 rounded-3xl h-72 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-28 lg:pb-12 items-start">
      {/* CỘT TRÁI (5/12 trên Desktop): Thẻ KPI Tổng Thể, Nguồn Tiền & Chỉ Số Thu Chi */}
      <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
        {/* Thẻ Tổng Tài Sản & Bộ Điều Hướng Tháng */}
        <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900/95 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-sm">
          {/* Subtle Ambient Light effect */}
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header thẻ: Nhãn & Chuyển tháng */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-400">
                Tổng Số Dư Hiện Có
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
                {formatVND(totalNetWorth)}
              </h2>
            </div>

            {/* Bộ chuyển tháng với vùng chạm công thái học >= 44x44px */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-2xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-xl active:scale-95 transition-all cursor-pointer"
                title="Tháng trước"
                aria-label="Tháng trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="px-2.5 text-xs sm:text-sm font-bold text-slate-200 tabular-nums select-none whitespace-nowrap">
                {monthStr}/{yearStr}
              </span>

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-xl active:scale-95 transition-all cursor-pointer"
                title="Tháng sau"
                aria-label="Tháng sau"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Danh sách Nguồn tiền / Ví (Mobile cuộn ngang mượt mà, Desktop lưới 3 cột) */}
          {wallets && wallets.length > 0 ? (
            <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-1 mb-5 sm:grid sm:grid-cols-3 relative z-10">
              {wallets.map((w) => {
                const bal = walletBalances[w.id] || 0;
                const owner = members?.find((m) => m.id === w.owner_id);
                return (
                  <div
                    key={w.id}
                    className="group min-w-[135px] sm:min-w-0 flex-1 bg-slate-950/60 hover:bg-slate-800/50 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between transition-all shrink-0 sm:shrink"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl group-hover:scale-110 transition-transform">{w.icon}</span>
                      {owner && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-medium truncate max-w-[65px]">
                          {owner.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5">
                      <div className="text-xs text-slate-400 truncate font-medium" title={w.name}>
                        {w.name}
                      </div>
                      <div
                        className={`text-sm sm:text-base font-extrabold mt-0.5 tabular-nums ${
                          bal < 0 ? 'text-rose-400' : 'text-slate-100'
                        }`}
                      >
                        {formatCompactVND(bal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-5 p-3.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-700/80 flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <WalletIcon className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-400 truncate">
                  Chưa có nguồn tiền. Hãy tạo ví để quản lý!
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="h-11 min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shrink-0 active:scale-95 transition cursor-pointer"
              >
                <Settings className="w-4 h-4" /> Thiết lập
              </button>
            </div>
          )}

          {/* Dải Thống Kê 3 Chỉ Số Thu / Chi / Thặng Dư */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 text-center relative z-10">
            <div className="p-2 rounded-2xl bg-slate-950/40 border border-slate-800/40">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Tổng Thu</span>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-400 mt-1 tabular-nums truncate">
                +{formatCompactVND(monthIncome)}
              </div>
            </div>

            <div className="p-2 rounded-2xl bg-slate-950/40 border border-slate-800/40">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Tổng Chi</span>
              </div>
              <div className="text-base sm:text-lg font-black text-rose-400 mt-1 tabular-nums truncate">
                -{formatCompactVND(monthExpense)}
              </div>
            </div>

            <div className="p-2 rounded-2xl bg-slate-950/40 border border-slate-800/40">
              <div className="text-[11px] font-semibold text-slate-400">Còn Dư</div>
              <div
                className={`text-base sm:text-lg font-black mt-1 tabular-nums truncate ${
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

      {/* CỘT PHẢI (7/12 trên Desktop): Bộ Lọc Thao Tác & Danh Sách Lịch Sử Giao Dịch */}
      <div className="lg:col-span-7 space-y-4">
        {/* Thanh công cụ: Lọc thành viên & Nút Nhập Giao Dịch */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterMember('ALL')}
              className={`h-11 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center transition cursor-pointer active:scale-95 ${
                filterMember === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Tất cả
            </button>
            {members &&
              members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilterMember(m.id)}
                  className={`h-11 min-h-[44px] px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                    filterMember === m.id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{m.avatar}</span>
                  <span>{m.name}</span>
                </button>
              ))}
          </div>

          <button
            type="button"
            onClick={openQuickAdd}
            className="hidden sm:flex h-11 min-h-[44px] items-center gap-1.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition cursor-pointer ml-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" /> Ghi Thu Chi
          </button>
        </div>

        {/* Danh sách Lịch sử Giao dịch theo Ngày */}
        {groupedByDate.length === 0 ? (
          /* TRẠNG THÁI DANH SÁCH TRỐNG (EMPTY STATE CÔNG THÁI HỌC) */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl mb-3 shadow-inner">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">
              Chưa có khoản thu chi nào trong tháng {monthStr}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1 mb-5">
              Mọi khoản chi tiêu hay thu nhập bạn ghi chép sẽ được tự động đồng bộ và hiển thị chi tiết theo ngày tại đây.
            </p>
            <button
              type="button"
              onClick={openQuickAdd}
              className="h-12 min-h-[44px] px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2.8]" /> Ghi khoản đầu tiên ngay
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {groupedByDate.map((group) => (
              <div
                key={group.date}
                className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80"
              >
                {/* Header của Ngày */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-800/40 border-b border-slate-800/80">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 capitalize">
                    {formatFriendlyDate(group.date)}
                  </span>
                  <div className="flex items-center gap-3 text-xs sm:text-sm font-black tabular-nums">
                    {group.dayIncome > 0 && (
                      <span className="text-emerald-400">+{formatVND(group.dayIncome)}</span>
                    )}
                    {group.dayExpense > 0 && (
                      <span className="text-rose-400">-{formatVND(group.dayExpense)}</span>
                    )}
                  </div>
                </div>

                {/* Các dòng giao dịch trong ngày */}
                <div className="divide-y divide-slate-800/50">
                  {group.items.map((tx) => {
                    const cat = categories?.find((c) => c.id === tx.category_id);
                    const wallet = wallets?.find((w) => w.id === tx.wallet_id);
                    const toWallet = wallets?.find((w) => w.id === tx.to_wallet_id);
                    const member = members?.find((m) => m.id === tx.member_id);

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-slate-800/30 transition group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Icon 44px+ touch-friendly */}
                          <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-slate-800/90 flex items-center justify-center text-xl shrink-0 border border-slate-700/60 shadow-xs">
                            {tx.type === 'TRANSFER' ? (
                              <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                            ) : (
                              cat?.icon || '💸'
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-100 truncate">
                              {tx.type === 'TRANSFER'
                                ? `Chuyển: ${wallet?.name || 'Ví'} → ${toWallet?.name || 'Ví'}`
                                : cat?.name || 'Giao dịch'}
                            </div>

                            {tx.note && (
                              <div className="text-xs text-slate-300 truncate mt-0.5">{tx.note}</div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
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
                                  <span className="truncate max-w-[100px]">{wallet.name}</span>
                                  <span>•</span>
                                </>
                              )}
                              {tx.sync_status === 'SYNCED' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Đồng bộ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                                  <Clock className="w-3.5 h-3.5" /> Chờ gửi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Số tiền & Nút xóa với Touch Target chuẩn 44x44px */}
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span
                            className={`text-sm sm:text-base font-black tabular-nums ${
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
                            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition cursor-pointer"
                            title="Xóa giao dịch"
                            aria-label="Xóa giao dịch"
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
