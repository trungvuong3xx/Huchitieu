import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X,
  Delete,
  Check,
  ArrowRightLeft,
  Calendar,
  FileText,
  Sparkles,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { formatVND, getTodayLocalISO, generateId } from '../utils/formatters';
import { syncWithGoogleSheets } from '../services/syncEngine';
import type { TransactionType, JarCode } from '../types';

const QUICK_CATEGORY_ICONS = [
  '🛒', '🍜', '☕', '👶🏻', '⚡', '🛵', '🛍️', '💊', '🧧', '🍕',
  '💎', '🏠', '📚', '✈️', '⚽', '🐶', '💰', '💵', '🎉', '📈'
];

export const QuickAddModal: React.FC = () => {
  const { isQuickAddOpen, closeQuickAdd, currentMember, setCurrentMember, showToast } = useAppStore();

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray(), []) || [];
  const members = useLiveQuery(() => db.members.toArray(), []) || [];

  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [expression, setExpression] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('cat_groceries');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayLocalISO());
  const [note, setNote] = useState<string>('');
  const [autoSaveOnCategoryTap, setAutoSaveOnCategoryTap] = useState<boolean>(false);

  // Chế độ Thêm / Xóa danh mục nhanh
  const [isManageCatMode, setIsManageCatMode] = useState<boolean>(false);
  const [isAddingCat, setIsAddingCat] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatIcon, setNewCatIcon] = useState<string>('🛒');
  const [newCatJar, setNewCatJar] = useState<JarCode>('NEC');

  const handleSwitchTxType = (type: TransactionType) => {
    setTxType(type);
    if (type !== 'TRANSFER') {
      const targetCat = categories.find((c) => c.type === (type === 'INCOME' ? 'INCOME' : 'EXPENSE'));
      if (targetCat) {
        setSelectedCategoryId(targetCat.id);
      }
    }
  };

  useEffect(() => {
    if (!isQuickAddOpen) return;
    setDate(getTodayLocalISO());
    setExpression('');
    setNote('');
    setIsManageCatMode(false);
    setIsAddingCat(false);

    const preferredWallet = wallets.find((w) => w.owner_id === currentMember) || wallets[0];
    if (preferredWallet) {
      setSelectedWalletId(preferredWallet.id);
      const secondWallet = wallets.find((w) => w.id !== preferredWallet.id) || preferredWallet;
      setToWalletId(secondWallet.id);
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
    if (key === '000') {
      if (!expression || /[+\-]$/.test(expression) || expression === '0') return;
      if (expression.length >= 13) return;
      setExpression((prev) => prev + '000');
      return;
    }
    if (key === '0') {
      if (expression === '0') return;
      if (/[+\-]0$/.test(expression)) return;
      if (expression.length >= 15) return;
      setExpression((prev) => prev + '0');
      return;
    }
    if (expression === '0') {
      setExpression(key);
      return;
    }
    if (expression.length >= 15) return;
    setExpression((prev) => prev + key);
  };

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newId = generateId('cat');
    const targetType = txType === 'INCOME' ? 'INCOME' : 'EXPENSE';
    await db.categories.add({
      id: newId,
      name: newCatName.trim(),
      type: targetType,
      jar_code: newCatJar,
      icon: newCatIcon,
      color: targetType === 'INCOME' ? '#10b981' : '#3b82f6',
      sort_order: categories.length + 1,
      is_active: true,
    });
    setSelectedCategoryId(newId);
    setNewCatName('');
    setIsAddingCat(false);
    showToast(`✅ Đã thêm danh mục "${newCatName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleQuickDeleteCategory = async (catId: string, catName: string) => {
    await db.categories.delete(catId);
    showToast(`🗑️ Đã xóa danh mục "${catName}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleSave = async (overrideCatId?: string) => {
    if (wallets.length === 0) {
      showToast('⚠️ Vui lòng tạo ít nhất 1 nguồn tiền trong Cài Đặt trước!');
      return;
    }

    const finalAmount = calculatedAmount;
    if (finalAmount <= 0) {
      showToast('⚠️ Vui lòng nhập số tiền lớn hơn 0đ');
      return;
    }

    const effectiveWalletId = selectedWalletId || wallets[0]?.id || '';
    if (!effectiveWalletId) {
      showToast('⚠️ Vui lòng chọn nguồn tiền!');
      return;
    }

    if (txType === 'TRANSFER') {
      const effectiveToId = toWalletId || wallets.find((w) => w.id !== effectiveWalletId)?.id || '';
      if (!effectiveToId || effectiveWalletId === effectiveToId) {
        showToast('⚠️ Nguồn tiền chuyển đi và nhận về phải khác nhau!');
        return;
      }
    }

    const catId = txType === 'TRANSFER' ? 'TRANSFER' : overrideCatId || selectedCategoryId;
    const nowISO = new Date().toISOString();
    const newTxId = generateId('tx');

    await db.transactions.add({
      id: newTxId,
      date,
      type: txType,
      amount: finalAmount,
      wallet_id: effectiveWalletId,
      to_wallet_id: txType === 'TRANSFER' ? toWalletId : undefined,
      category_id: catId,
      member_id: currentMember || members[0]?.id || '',
      beneficiary: 'FAMILY',
      is_shared: true,
      note: note.trim(),
      is_deleted: false,
      sync_status: 'PENDING',
      created_at: nowISO,
      updated_at: nowISO,
    });

    const catObj = categories.find((c) => c.id === catId);
    const label = txType === 'TRANSFER' ? 'Chuyển nguồn tiền' : catObj?.name || 'Giao dịch';
    showToast(`✅ Đã lưu ${formatVND(finalAmount)} • ${label}`, newTxId);
    closeQuickAdd();

    syncWithGoogleSheets().catch(() => {});
  };

  useEffect(() => {
    if (!isQuickAddOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Enter' && !isAddingCat) {
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
        e.preventDefault();
        handleKeyPress('000');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQuickAddOpen, isAddingCat, expression, calculatedAmount, selectedCategoryId, selectedWalletId, toWalletId, date, note, txType]);

  if (!isQuickAddOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === (txType === 'INCOME' ? 'INCOME' : 'EXPENSE'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-xs animate-fadeIn p-0 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeQuickAdd();
      }}
    >
      <div className="w-full max-w-md md:max-w-4xl bg-slate-900 border-t md:border border-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh] animate-slideUp md:animate-fadeIn">
        {/* Mobile Pull Handle Bar */}
        <div className="md:hidden pt-2 pb-1 flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-700/80" />
        </div>

        {/* Header: Chuyển đổi Loại Giao Dịch + Nút Đóng (Touch target >= 44x44px) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex bg-slate-800/90 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => handleSwitchTxType('EXPENSE')}
              className={`h-11 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                txType === 'EXPENSE'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chi tiêu (-)
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTxType('INCOME')}
              className={`h-11 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                txType === 'INCOME'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thu nhập (+)
            </button>

            {wallets.length >= 2 && (
              <button
                type="button"
                onClick={() => handleSwitchTxType('TRANSFER')}
                className={`h-11 min-h-[44px] px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  txType === 'TRANSFER'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" /> Chuyển ví
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={closeQuickAdd}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition cursor-pointer"
            title="Đóng"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Mobile dọc | Desktop chia 2 cột ngang */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto md:overflow-hidden">
          {/* CỘT TRÁI: Chọn Danh mục & Tuỳ chọn bổ sung */}
          <div className="md:col-span-7 flex flex-col justify-between md:border-r border-slate-800/80 p-4 sm:p-5 overflow-y-auto">
            <div>
              {txType !== 'TRANSFER' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400">
                        Chọn danh mục ({filteredCategories.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManageCatMode(!isManageCatMode);
                          setIsAddingCat(false);
                        }}
                        className={`h-9 min-h-[36px] px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                          isManageCatMode
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-slate-800/90 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        {isManageCatMode ? 'Xong' : 'Sửa / Xóa'}
                      </button>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs sm:text-sm text-emerald-400 cursor-pointer select-none py-1">
                      <input
                        type="checkbox"
                        checked={autoSaveOnCategoryTap}
                        onChange={(e) => setAutoSaveOnCategoryTap(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 w-4 h-4"
                      />
                      <Sparkles className="w-3.5 h-3.5" /> Chạm là Lưu ngay
                    </label>
                  </div>

                  {/* Lưới danh mục - Touch target min 44x44px */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-2.5">
                    {filteredCategories.map((cat) => {
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <div key={cat.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              if (isManageCatMode) {
                                handleQuickDeleteCategory(cat.id, cat.name);
                                return;
                              }
                              setSelectedCategoryId(cat.id);
                              if (autoSaveOnCategoryTap && calculatedAmount > 0) {
                                handleSave(cat.id);
                              }
                            }}
                            className={`w-full min-h-[64px] flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                              isManageCatMode
                                ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20'
                                : isSelected
                                ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                                : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className="text-2xl mb-1">{cat.icon}</span>
                            <span className="text-xs font-semibold leading-tight line-clamp-1 text-center">
                              {cat.name}
                            </span>
                          </button>

                          {isManageCatMode && (
                            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md pointer-events-none">
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Nút "+ Thêm mục" */}
                    <button
                      type="button"
                      onClick={() => setIsAddingCat(!isAddingCat)}
                      className="min-h-[64px] flex flex-col items-center justify-center p-2.5 rounded-2xl border border-dashed border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 transition cursor-pointer active:scale-95"
                    >
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-xs font-bold">Thêm mục</span>
                    </button>
                  </div>

                  {/* Form nhỏ thêm danh mục */}
                  {isAddingCat && (
                    <form
                      onSubmit={handleQuickAddCategory}
                      className="mt-3 p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 space-y-2.5 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>Tạo danh mục {txType === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'} mới:</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingCat(false)}
                          className="text-slate-400 hover:text-white text-xs"
                        >
                          Đóng
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={newCatIcon}
                          onChange={(e) => setNewCatIcon(e.target.value)}
                          className="h-11 min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-2.5 text-lg"
                        >
                          {QUICK_CATEGORY_ICONS.map((ic) => (
                            <option key={ic} value={ic}>
                              {ic}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="Tên danh mục..."
                          className="h-11 min-h-[44px] flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 text-xs sm:text-sm text-white focus:outline-none"
                          autoFocus
                        />
                        {txType === 'EXPENSE' && (
                          <select
                            value={newCatJar}
                            onChange={(e) => setNewCatJar(e.target.value as JarCode)}
                            className="h-11 min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-2.5 text-xs text-slate-200"
                            title="Thuộc Hũ tài chính nào"
                          >
                            <option value="NEC">🏠 Thiết yếu</option>
                            <option value="EDUC">📚 Giáo dục</option>
                            <option value="PLAY">🎉 Hưởng thụ</option>
                            <option value="FFA">📈 Đầu tư</option>
                            <option value="LTSS">💎 Tiết kiệm</option>
                            <option value="GIVE">🎁 Cho đi</option>
                          </select>
                        )}
                        <button
                          type="submit"
                          className="h-11 min-h-[44px] px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shrink-0 active:scale-95"
                        >
                          Tạo
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="space-y-3 py-2">
                  <div className="text-sm text-slate-400 font-medium">Chuyển giữa các nguồn tiền:</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Từ nguồn tiền:</div>
                      <select
                        value={selectedWalletId}
                        onChange={(e) => setSelectedWalletId(e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none"
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id} className="bg-slate-900">
                            {w.icon} {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-2xl border border-blue-500/40">
                      <div className="text-xs text-blue-300 mb-1">Sang nguồn tiền:</div>
                      <select
                        value={toWalletId}
                        onChange={(e) => setToWalletId(e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none"
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

            {/* Hàng điều khiển bổ sung: Chọn nguồn tiền + Chọn người + Ngày & Ghi chú */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
              {(wallets.length > 0 || members.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {txType !== 'TRANSFER' && wallets.length > 0 && (
                    <select
                      value={selectedWalletId}
                      onChange={(e) => setSelectedWalletId(e.target.value)}
                      className="h-11 min-h-[44px] bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold px-3 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id} className="bg-slate-900">
                          {w.icon} {w.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {members.length > 0 && (
                    <select
                      value={currentMember}
                      onChange={(e) => setCurrentMember(e.target.value)}
                      className="h-11 min-h-[44px] bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold px-3 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900">
                          {m.avatar} {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="h-11 min-h-[44px] flex items-center bg-slate-800 border border-slate-700 rounded-xl px-3 shrink-0">
                  <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-none w-32 cursor-pointer"
                  />
                </div>

                <div className="h-11 min-h-[44px] flex items-center flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3">
                  <FileText className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú (Enter để lưu)..."
                    className="bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Màn hình Số tiền Lớn + Bàn phím số Numpad công thái học */}
          <div className="md:col-span-5 flex flex-col justify-between bg-slate-950/70 border-t md:border-t-0 border-slate-800/80">
            {/* Hiển thị số tiền to bản */}
            <div className="px-5 py-3 sm:py-4 flex flex-col items-end justify-center border-b border-slate-800/80">
              {/[+\-]/.test(expression) && (
                <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded mb-1">
                  Phép tính: {expression}
                </span>
              )}

              <div className="flex items-baseline gap-1.5 my-0.5">
                <span
                  className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums ${
                    txType === 'EXPENSE'
                      ? 'text-rose-400'
                      : txType === 'INCOME'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                  }`}
                >
                  {calculatedAmount > 0 ? formatVND(calculatedAmount, false) : '0'}
                </span>
                <span className="text-xl font-bold text-slate-400">₫</span>
              </div>

              {/* Gợi ý số nghìn */}
              {calculatedAmount > 0 && calculatedAmount < 1000 && (
                <div className="flex flex-wrap gap-1.5 mt-2 w-full justify-end">
                  {[calculatedAmount * 1000, calculatedAmount * 10000, calculatedAmount * 100000].map(
                    (suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => setExpression(String(suggested))}
                        className="h-9 px-3 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold hover:bg-emerald-500/25 active:scale-95 transition cursor-pointer"
                      >
                        ⚡ {formatVND(suggested)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Bàn phím số Thumb Zone (Mỗi nút min-h-[52px], to rõ, tactile press) */}
            <div className="grid grid-cols-4 gap-2 p-3 sm:p-4 bg-slate-950">
              {['7', '8', '9', 'BACKSPACE', '4', '5', '6', '+', '1', '2', '3', '-', '000', '0', 'CLEAR'].map(
                (key) => {
                  if (key === 'BACKSPACE') {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeyPress('BACKSPACE')}
                        className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 transition cursor-pointer shadow-xs"
                        aria-label="Xóa 1 số"
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
                        className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-xs sm:text-sm font-extrabold text-rose-400 transition cursor-pointer shadow-xs"
                        aria-label="Xóa tất cả"
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
                        className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 text-base font-black text-amber-300 transition cursor-pointer shadow-xs"
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
                        className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-xl font-bold text-emerald-400 transition cursor-pointer shadow-xs"
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
                      className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 text-xl font-black text-white transition cursor-pointer shadow-xs"
                    >
                      {key}
                    </button>
                  );
                }
              )}

              {/* Nút LƯU chính - Accent Emerald nổi bật ngay góc ngón cái */}
              <button
                type="button"
                onClick={() => handleSave()}
                className="h-13 sm:h-14 min-h-[52px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 flex items-center justify-center gap-1.5 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                <Check className="w-6 h-6 stroke-[3]" /> LƯU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
