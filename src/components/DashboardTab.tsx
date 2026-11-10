import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { db, FAMILY_MEMBERS, BENEFICIARIES } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, formatCompactVND, formatFriendlyDate, getTodayLocalISO, generateId } from '../utils/formatters';
import { syncWithGoogleSheets } from '../services/syncEngine';
import type { QuickPreset, Transaction } from '../types';

export const DashboardTab: React.FC = () => {
  const {
    selectedMonthYear,
    shiftMonth,
    currentMember,
    filterMember,
    setFilterMember,
    filterSharedOnly,
    setFilterSharedOnly,
    showToast,
  } = useAppStore();

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const presets = useLiveQuery(() => db.presets.toArray(), []) || [];
  const allTransactions = useLiveQuery(() => db.transactions.filter((t) => !t.is_deleted).toArray(), []) || [];

  // 1. Tính số dư thực tế của từng Ví:
  // initial_balance + INCOME - EXPENSE - TRANSFER_OUT + TRANSFER_IN
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

  // 2. Lọc giao dịch theo Tháng đang chọn & Bộ lọc Gia đình
  const monthTransactions = React.useMemo(() => {
    return allTransactions
      .filter((tx) => tx.date.startsWith(selectedMonthYear))
      .filter((tx) => (filterMember === 'ALL' ? true : tx.member_id === filterMember))
      .filter((tx) => {
        if (filterSharedOnly === 'SHARED') return tx.is_shared;
        if (filterSharedOnly === 'PERSONAL') return !tx.is_shared;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [allTransactions, selectedMonthYear, filterMember, filterSharedOnly]);

  // 3. Tính Tổng Thu & Tổng Chi trong tháng (Tuyệt đối loại trừ TRANSFER để không ảo số liệu)
  const { monthIncome, monthExpense } = React.useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of monthTransactions) {
      if (tx.type === 'INCOME') inc += tx.amount;
      if (tx.type === 'EXPENSE') exp += tx.amount;
    }
    return { monthIncome: inc, monthExpense: exp };
  }, [monthTransactions]);

  // 4. Gom nhóm giao dịch theo từng ngày (YYYY-MM-DD)
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

  // Xử lý bấm 1-Chạm (One-Tap Preset) lưu ngay trong 0.5 giây
  const handleQuickPresetTap = async (preset: QuickPreset) => {
    const nowISO = new Date().toISOString();
    const newTxId = generateId('tx');
    const preferredWallet = wallets.find((w) => w.owner_id === currentMember)?.id || preset.wallet_id;

    await db.transactions.add({
      id: newTxId,
      date: getTodayLocalISO(),
      type: 'EXPENSE',
      amount: preset.amount,
      wallet_id: preferredWallet,
      category_id: preset.category_id,
      member_id: currentMember,
      beneficiary: preset.beneficiary,
      is_shared: preset.beneficiary === 'FAMILY' || preset.beneficiary === 'KIDS',
      note: `${preset.title} (1-Chạm)`,
      is_deleted: false,
      sync_status: 'PENDING',
      created_at: nowISO,
      updated_at: nowISO,
    });

    showToast(`⚡ Đã ghi nhanh: ${preset.title} (-${formatVND(preset.amount)})`, newTxId);
    syncWithGoogleSheets().catch(() => {});
  };

  // Xóa mềm giao dịch (Soft Delete)
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
    <div className="space-y-4 pb-24">
      {/* Thẻ Tổng Tài Sản & Danh Sách Ví Gia Đình */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 rounded-3xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng số dư các ví gia đình</p>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-0.5">{formatVND(totalNetWorth)}</h2>
          </div>

          {/* Bộ chuyển tháng */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-200">
              Thg {parseInt(monthStr, 10)}/{yearStr}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Các thẻ Ví ngang */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {wallets.map((w) => {
            const bal = walletBalances[w.id] || 0;
            return (
              <div
                key={w.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{w.icon}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {FAMILY_MEMBERS.find((m) => m.id === w.owner_id)?.name}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-[11px] text-slate-400 truncate">{w.name}</div>
                  <div className={`text-xs font-bold mt-0.5 ${bal < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                    {formatCompactVND(bal)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Thống kê Thu / Chi / Còn dư trong tháng */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Thu tháng {parseInt(monthStr, 10)}
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">+{formatCompactVND(monthIncome)}</div>
          </div>
          <div className="border-x border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-rose-400" /> Chi tháng {parseInt(monthStr, 10)}
            </div>
            <div className="text-sm font-bold text-rose-400 mt-0.5">-{formatCompactVND(monthExpense)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Thặng dư tháng</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                monthIncome - monthExpense >= 0 ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {monthIncome - monthExpense >= 0 ? '+' : ''}
              {formatCompactVND(monthIncome - monthExpense)}
            </div>
          </div>
        </div>
      </div>

      {/* Thanh Nút Bấm "1-Chạm" (One-Tap Presets - USP cho Gia đình) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>NHẬP 1-CHẠM (Chạm là lưu ngay!)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Đang ghi bởi: {FAMILY_MEMBERS.find((m) => m.id === currentMember)?.avatar}{' '}
            {FAMILY_MEMBERS.find((m) => m.id === currentMember)?.name}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleQuickPresetTap(preset)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-emerald-500/20 border border-slate-700/80 hover:border-emerald-500/50 active:scale-95 transition shrink-0"
            >
              <span className="text-lg">{preset.icon}</span>
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-100 leading-tight">{preset.title}</div>
                <div className="text-[10px] font-bold text-emerald-400">{formatCompactVND(preset.amount)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bộ lọc Nhanh Gia Đình: Tất cả / Vợ / Chồng & Quỹ Chung / Chi Riêng */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
          {(['ALL', 'WIFE', 'HUSBAND'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMember(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterMember === m ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'ALL' ? '👨‍👩‍👧 Tất cả' : m === 'WIFE' ? '👩🏻 Vợ chi' : '👨🏻 Chồng chi'}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
          {(['ALL', 'SHARED', 'PERSONAL'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterSharedOnly(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterSharedOnly === mode
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'ALL' ? 'Mọi quỹ' : mode === 'SHARED' ? '🏡 Chung' : '🔒 Riêng'}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách Lịch sử Giao dịch theo Ngày */}
      {groupedByDate.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-8 text-center">
          <div className="text-4xl mb-2">📝</div>
          <div className="text-sm font-semibold text-slate-300">Chưa có giao dịch nào trong kỳ này</div>
          <div className="text-xs text-slate-500 mt-1">
            Hãy bấm nút <strong className="text-emerald-400">+</strong> ở giữa đáy màn hình hoặc các nút{' '}
            <strong className="text-amber-400">1-Chạm</strong> để ghi chi tiêu trong 3 giây!
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Header của Ngày */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/50 border-b border-slate-800/80">
                <span className="text-xs font-bold text-slate-300 capitalize">{formatFriendlyDate(group.date)}</span>
                <div className="flex items-center gap-3 text-xs font-semibold">
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
                  const member = FAMILY_MEMBERS.find((m) => m.id === tx.member_id);
                  const ben = BENEFICIARIES.find((b) => b.id === tx.beneficiary);

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-3.5 py-3 hover:bg-slate-800/30 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-700/60">
                          {tx.type === 'TRANSFER' ? <ArrowRightLeft className="w-5 h-5 text-blue-400" /> : cat?.icon || '💸'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-100 truncate">
                              {tx.type === 'TRANSFER'
                                ? `Chuyển: ${wallet?.name} → ${toWallet?.name}`
                                : cat?.name || 'Giao dịch'}
                            </span>
                            {!tx.is_shared && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/15 text-amber-300 rounded">
                                Riêng
                              </span>
                            )}
                          </div>

                          {tx.note && <div className="text-xs text-slate-400 truncate mt-0.5">{tx.note}</div>}

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            <span className="text-slate-400 font-medium">
                              {member?.avatar} {member?.name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <Users className="w-2.5 h-2.5" /> Cho {ben?.label}
                            </span>
                            <span>•</span>
                            <span>{wallet?.name}</span>
                            {tx.sync_status === 'SYNCED' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-400 inline" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={`text-sm font-extrabold ${
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
                          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
  );
};
