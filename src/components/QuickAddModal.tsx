import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Delete, Check, ArrowRightLeft, Calendar, FileText, Users, Sparkles } from 'lucide-react';
import { db, FAMILY_MEMBERS, BENEFICIARIES } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, getTodayLocalISO, generateId } from '../utils/formatters';
import { syncWithGoogleSheets } from '../services/syncEngine';
import type { TransactionType, BeneficiaryId } from '../types';

export const QuickAddModal: React.FC = () => {
  const { isQuickAddOpen, closeQuickAdd, currentMember, showToast } = useAppStore();

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray(), []) || [];

  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [expression, setExpression] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('cat_groceries');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('w_wife_cash');
  const [toWalletId, setToWalletId] = useState<string>('w_shared_bank');
  const [beneficiary, setBeneficiary] = useState<BeneficiaryId>('FAMILY');
  const [isShared, setIsShared] = useState<boolean>(true);
  const [date, setDate] = useState<string>(getTodayLocalISO());
  const [note, setNote] = useState<string>('');
  const [autoSaveOnCategoryTap, setAutoSaveOnCategoryTap] = useState<boolean>(false);

  // Tự động chọn ví mặc định theo người đang cầm máy
  useEffect(() => {
    if (!isQuickAddOpen) return;
    setDate(getTodayLocalISO());
    setExpression('');
    setNote('');

    const preferredWallet = wallets.find((w) => w.owner_id === currentMember) || wallets[0];
    if (preferredWallet) {
      setSelectedWalletId(preferredWallet.id);
    }

    const firstCat = categories.find((c) => c.type === (txType === 'INCOME' ? 'INCOME' : 'EXPENSE'));
    if (firstCat) {
      setSelectedCategoryId(firstCat.id);
    }
  }, [isQuickAddOpen, currentMember, wallets.length]);

  const evaluateAmount = (expr: string): number => {
    if (!expr) return 0;
    try {
      const sanitized = expr.replace(/[^0-9+\-]/g, '');
      if (!sanitized) return 0;
      const parts = sanitized.split(/([+\-])/).filter(Boolean);
      let total = 0;
      let currentOp = '+';
      for (const token of parts) {
        if (token === '+' || token === '-') {
          currentOp = token;
        } else {
          const val = parseInt(token, 10) || 0;
          total = currentOp === '+' ? total + val : total - val;
        }
      }
      return Math.max(0, Math.round(total));
    } catch {
      return 0;
    }
  };

  const calculatedAmount = evaluateAmount(expression);

  const handleKeyPress = (key: string) => {
    if (key === 'CLEAR') {
      setExpression('');
      return;
    }
    if (key === 'BACKSPACE') {
      setExpression((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '+' || key === '-') {
      if (!expression || /[+\-]$/.test(expression)) return;
      setExpression((prev) => prev + key);
      return;
    }
    if (expression.length >= 15) return;
    setExpression((prev) => prev + key);
  };

  const handleSave = async (overrideCatId?: string) => {
    const finalAmount = calculatedAmount;
    if (finalAmount <= 0) {
      showToast('⚠️ Vui lòng nhập số tiền lớn hơn 0đ');
      return;
    }

    if (txType === 'TRANSFER' && selectedWalletId === toWalletId) {
      showToast('⚠️ Ví nguồn và Ví đích phải khác nhau!');
      return;
    }

    const catId = txType === 'TRANSFER' ? 'TRANSFER' : overrideCatId || selectedCategoryId;
    const nowISO = new Date().toISOString();
    const newTxId = generateId('tx');

    await db.transactions.add({
      id: newTxId,
      date,
      type: txType,
      amount: finalAmount,
      wallet_id: selectedWalletId,
      to_wallet_id: txType === 'TRANSFER' ? toWalletId : undefined,
      category_id: catId,
      member_id: currentMember,
      beneficiary,
      is_shared: isShared,
      note: note.trim(),
      is_deleted: false,
      sync_status: 'PENDING',
      created_at: nowISO,
      updated_at: nowISO,
    });

    const catObj = categories.find((c) => c.id === catId);
    const label = txType === 'TRANSFER' ? 'Chuyển ví' : catObj?.name || 'Giao dịch';
    showToast(`✅ Đã lưu ${formatVND(finalAmount)} • ${label}`, newTxId);
    closeQuickAdd();

    syncWithGoogleSheets().catch(() => {});
  };

  // Hỗ trợ gõ bàn phím cứng trên máy tính (PC Keyboard: 0-9, +, -, Backspace, Enter, Escape)
  useEffect(() => {
    if (!isQuickAddOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('BACKSPACE');
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleKeyPress('CLEAR');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeQuickAdd();
      } else if (e.key.toLowerCase() === 'k') {
        // Phím tắt 'k' trên PC = thêm '000'
        e.preventDefault();
        handleKeyPress('000');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQuickAddOpen, expression, calculatedAmount, selectedCategoryId, selectedWalletId, toWalletId, beneficiary, isShared, date, note, txType]);

  if (!isQuickAddOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === (txType === 'INCOME' ? 'INCOME' : 'EXPENSE'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-xs animate-fadeIn p-0 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeQuickAdd();
      }}
    >
      <div className="w-full max-w-md md:max-w-4xl bg-slate-900 border-t md:border border-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] md:max-h-[88vh]">
        {/* Header: Chuyển đổi Chi tiêu / Thu nhập / Chuyển khoản */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-3.5 pb-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex bg-slate-800/90 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setTxType('EXPENSE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                txType === 'EXPENSE' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chi tiêu (-)
            </button>
            <button
              type="button"
              onClick={() => setTxType('INCOME')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                txType === 'INCOME' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thu nhập (+)
            </button>
            <button
              type="button"
              onClick={() => setTxType('TRANSFER')}
              className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                txType === 'TRANSFER' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Chuyển ví
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block text-xs text-slate-500">
              💡 Mẹo PC: Gõ phím số trực tiếp, bấm phím <kbd className="px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded">K</kbd> để thêm <code>.000</code>, <kbd className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 rounded">Enter</kbd> để Lưu
            </span>
            <button
              type="button"
              onClick={closeQuickAdd}
              className="p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Mobile dọc | Desktop chia 2 cột ngang rộng rãi */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto md:overflow-hidden">
          {/* Cột Trái trên PC: Chọn Danh mục & Tuỳ chọn Gia đình */}
          <div className="md:col-span-7 flex flex-col justify-between md:border-r border-slate-800/80 p-4 md:p-6 overflow-y-auto">
            <div>
              {txType !== 'TRANSFER' ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Chọn danh mục ({filteredCategories.length})
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSaveOnCategoryTap}
                        onChange={(e) => setAutoSaveOnCategoryTap(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0"
                      />
                      <Sparkles className="w-3.5 h-3.5" /> Chạm danh mục là Lưu ngay
                    </label>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-5 gap-2 md:gap-2.5">
                    {filteredCategories.map((cat) => {
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            if (autoSaveOnCategoryTap && calculatedAmount > 0) {
                              handleSave(cat.id);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 md:p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-white scale-[1.03] shadow-md'
                              : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-xl md:text-2xl mb-1">{cat.icon}</span>
                          <span className="text-[10px] md:text-xs font-medium leading-tight line-clamp-1 text-center">
                            {cat.name.split('/')[0].trim()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-3 py-2">
                  <div className="text-xs md:text-sm text-slate-400 font-medium">
                    Chuyển tiền giữa các Ví trong gia đình:
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Từ Ví nguồn:</div>
                      <select
                        value={selectedWalletId}
                        onChange={(e) => setSelectedWalletId(e.target.value)}
                        className="w-full bg-transparent text-xs md:text-sm font-semibold text-white focus:outline-none"
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id} className="bg-slate-900">
                            {w.icon} {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-800/70 p-3 rounded-2xl border border-blue-500/40">
                      <div className="text-xs text-blue-300 mb-1">Sang Ví đích:</div>
                      <select
                        value={toWalletId}
                        onChange={(e) => setToWalletId(e.target.value)}
                        className="w-full bg-transparent text-xs md:text-sm font-semibold text-white focus:outline-none"
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id} className="bg-slate-900">
                            {w.icon} {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Thanh Tuỳ chọn Gia Đình: Chọn Ví, Chi cho ai, Quỹ Chung/Riêng, Ngày & Ghi chú */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {txType !== 'TRANSFER' && (
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs font-medium px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id} className="bg-slate-900">
                        {w.icon} {w.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center bg-slate-800 rounded-xl px-2.5 py-1.5 border border-slate-700">
                  <Users className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                  <select
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value as BeneficiaryId)}
                    className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none"
                  >
                    {BENEFICIARIES.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900">
                        Cho: {b.icon} {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsShared(!isShared)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    isShared
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {isShared ? '🏡 Quỹ Chung' : '🔒 Chi Riêng'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800/70 border border-slate-800 rounded-xl px-3 py-2 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 focus:outline-none w-28"
                  />
                </div>

                <div className="flex items-center flex-1 bg-slate-800/70 border border-slate-800 rounded-xl px-3 py-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú thêm (Enter để lưu)..."
                    className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cột Phải trên PC: Màn hình Số tiền + Bàn phím Numpad */}
          <div className="md:col-span-5 flex flex-col justify-between bg-slate-950/70">
            {/* Màn hình hiển thị Số tiền */}
            <div className="px-5 py-4 flex flex-col items-end justify-center border-b border-slate-800/60">
              <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <span>Người ghi:</span>
                  <strong className="text-slate-200">
                    {FAMILY_MEMBERS.find((m) => m.id === currentMember)?.avatar}{' '}
                    {FAMILY_MEMBERS.find((m) => m.id === currentMember)?.name}
                  </strong>
                </span>
                {/[+\-]/.test(expression) && (
                  <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    Phép tính: {expression}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 my-1">
                <span
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    txType === 'EXPENSE'
                      ? 'text-rose-400'
                      : txType === 'INCOME'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                  }`}
                >
                  {calculatedAmount > 0 ? formatVND(calculatedAmount, false) : '0'}
                </span>
                <span className="text-lg font-semibold text-slate-500">₫</span>
              </div>

              {calculatedAmount > 0 && calculatedAmount < 1000 && (
                <div className="flex flex-wrap gap-1.5 mt-2 w-full justify-end">
                  {[
                    calculatedAmount * 1000,
                    calculatedAmount * 10000,
                    calculatedAmount * 100000,
                  ].map((suggested) => (
                    <button
                      key={suggested}
                      type="button"
                      onClick={() => setExpression(String(suggested))}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition cursor-pointer"
                    >
                      ⚡ {formatVND(suggested)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bàn phím số Custom (Numpad 3 Giây) */}
            <div className="grid grid-cols-4 gap-2 p-3 md:p-4 bg-slate-950">
              {['7', '8', '9', 'BACKSPACE', '4', '5', '6', '+', '1', '2', '3', '-', '000', '0', 'CLEAR'].map(
                (key) => {
                  if (key === 'BACKSPACE') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('BACKSPACE')}
                        className="h-12 md:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 transition cursor-pointer"
                      >
                        <Delete className="w-5 h-5" />
                      </button>
                    );
                  }
                  if (key === 'CLEAR') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('CLEAR')}
                        className="h-12 md:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-xs font-bold text-rose-400 transition cursor-pointer"
                      >
                        XÓA
                      </button>
                    );
                  }
                  if (key === '000') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('000')}
                        className="h-12 md:h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 text-base font-extrabold text-amber-300 transition cursor-pointer"
                      >
                        .000
                      </button>
                    );
                  }
                  if (key === '+' || key === '-') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress(key)}
                        className="h-12 md:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-xl font-bold text-emerald-400 transition cursor-pointer"
                      >
                        {key}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyPress(key)}
                      className="h-12 md:h-14 rounded-2xl bg-slate-900 border border-slate-800/90 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white transition cursor-pointer"
                    >
                      {key}
                    </button>
                  );
                }
              )}

              <button
                type="button"
                onClick={() => handleSave()}
                className="h-12 md:h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 flex items-center justify-center gap-1 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[2.5]" /> LƯU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
