import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Plus,
  Wallet as WalletIcon,
  ShieldCheck,
  Users,
  Trash2,
  Edit3,
  Save,
  X,
  LayoutGrid,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { syncWithGoogleSheets, exportBackupJSON, importBackupJSON } from '../services/syncEngine';
import { formatVND, generateId } from '../utils/formatters';
import type { WalletType, Wallet, Category, JarCode } from '../types';

const AVATAR_OPTIONS = ['👤', '👨🏻', '👩🏻', '👶🏻', '👵🏻', '🏡', '⭐'];
const CATEGORY_ICONS = [
  '🛒', '🍜', '☕', '👶🏻', '⚡', '🛵', '🛍️', '💊', '🧧', '🍕',
  '💎', '🏠', '📚', '✈️', '⚽', '🐶', '💰', '💵', '🎉', '📈',
];

type SectionKey = 'users' | 'wallets' | 'categories' | 'sync' | 'backup' | 'apk';

export const SettingsTab: React.FC = () => {
  const {
    currentMember,
    setCurrentMember,
    scriptUrl,
    setScriptUrl,
    isSyncing,
    lastSyncTime,
    showToast,
  } = useAppStore();

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.is_archived).toArray(), []) || [];
  const members = useLiveQuery(() => db.members.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort_order').toArray(), []) || [];
  const pendingCount = useLiveQuery(() => db.transactions.where('sync_status').equals('PENDING').count(), []) || 0;

  // Quản lý trạng thái đóng/mở của từng Box thả xuống (Accordion)
  // Mặc định mở box Người dùng & Nguồn tiền để tiện thiết lập, các mục khác thu gọn gọn gàng
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    users: true,
    wallets: true,
    categories: false,
    sync: false,
    backup: false,
    apk: false,
  });

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = () => {
    setOpenSections({
      users: true,
      wallets: true,
      categories: true,
      sync: true,
      backup: true,
      apk: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      users: false,
      wallets: false,
      categories: false,
      sync: false,
      backup: false,
      apk: false,
    });
  };

  // States cho Thành viên
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('👤');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');

  // States cho Nguồn tiền (Ví)
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [newWalletOwner, setNewWalletOwner] = useState<string>('');
  const [newWalletType, setNewWalletType] = useState<WalletType>('BANK');

  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editWName, setEditWName] = useState('');
  const [editWBal, setEditWBal] = useState('');
  const [editWType, setEditWType] = useState<WalletType>('BANK');
  const [editWOwner, setEditWOwner] = useState('');

  // States cho Danh mục (Categories)
  const [catFilterType, setCatFilterType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [newCatJar, setNewCatJar] = useState<JarCode>('NEC');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('🛒');
  const [editCatJar, setEditCatJar] = useState<JarCode>('NEC');

  // State cho Google Sheets URL
  const [urlInput, setUrlInput] = useState(scriptUrl);

  // --- XỬ LÝ THÀNH VIÊN ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const id = generateId('mem');
    await db.members.add({
      id,
      name: newMemberName.trim(),
      avatar: newMemberAvatar,
      color: '#10b981',
    });
    if (!currentMember) {
      setCurrentMember(id);
    }
    setNewMemberName('');
    showToast(`✅ Đã thêm người dùng "${newMemberName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleSaveEditMember = async (id: string) => {
    if (!editingMemberName.trim()) return;
    await db.members.update(id, { name: editingMemberName.trim() });
    setEditingMemberId(null);
    showToast('✅ Đã đổi tên thành công');
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleDeleteMember = async (id: string, name: string) => {
    await db.members.delete(id);
    if (currentMember === id) {
      const remaining = members.filter((m) => m.id !== id);
      setCurrentMember(remaining[0]?.id || '');
    }
    showToast(`🗑️ Đã xóa "${name}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  // --- XỬ LÝ NGUỒN TIỀN (VÍ) ---
  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const initBal = parseInt(newWalletBalance.replace(/[^0-9\-]/g, ''), 10) || 0;

    await db.wallets.add({
      id: generateId('w'),
      name: newWalletName.trim(),
      type: newWalletType,
      initial_balance: initBal,
      owner_id: newWalletOwner || '',
      icon: newWalletType === 'CASH' ? '💵' : newWalletType === 'BANK' ? '🏦' : '💳',
      color: '#10b981',
      is_archived: false,
      updated_at: new Date().toISOString(),
    });

    setNewWalletName('');
    setNewWalletBalance('');
    showToast(`✅ Đã thêm nguồn tiền "${newWalletName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const startEditWallet = (w: Wallet) => {
    setEditingWalletId(w.id);
    setEditWName(w.name);
    setEditWBal(String(w.initial_balance));
    setEditWType(w.type);
    setEditWOwner(w.owner_id);
  };

  const handleSaveEditWallet = async (id: string) => {
    if (!editWName.trim()) return;
    const initBal = parseInt(editWBal.replace(/[^0-9\-]/g, ''), 10) || 0;
    await db.wallets.update(id, {
      name: editWName.trim(),
      initial_balance: initBal,
      type: editWType,
      owner_id: editWOwner,
      icon: editWType === 'CASH' ? '💵' : editWType === 'BANK' ? '🏦' : '💳',
      updated_at: new Date().toISOString(),
    });
    setEditingWalletId(null);
    showToast(`✅ Đã cập nhật nguồn tiền "${editWName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleDeleteWallet = async (w: Wallet) => {
    await db.wallets.delete(w.id);
    showToast(`🗑️ Đã xóa nguồn tiền "${w.name}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  // --- XỬ LÝ DANH MỤC (CATEGORIES) ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await db.categories.add({
      id: generateId('cat'),
      name: newCatName.trim(),
      type: catFilterType,
      jar_code: newCatJar,
      icon: newCatIcon,
      color: catFilterType === 'INCOME' ? '#10b981' : '#3b82f6',
      sort_order: categories.length + 1,
      is_active: true,
    });
    setNewCatName('');
    showToast(`✅ Đã thêm danh mục "${newCatName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const startEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
    setEditCatJar(cat.jar_code);
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editCatName.trim()) return;
    await db.categories.update(id, {
      name: editCatName.trim(),
      icon: editCatIcon,
      jar_code: editCatJar,
    });
    setEditingCatId(null);
    showToast(`✅ Đã cập nhật danh mục "${editCatName.trim()}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  const handleDeleteCategory = async (cat: Category) => {
    await db.categories.delete(cat.id);
    showToast(`🗑️ Đã xóa danh mục "${cat.name}"`);
    syncWithGoogleSheets(true).catch(() => {});
  };

  // --- ĐỒNG BỘ & SAO LƯU ---
  const handleSaveUrlAndSync = async () => {
    setScriptUrl(urlInput);
    if (!urlInput.trim()) {
      showToast('ℹ️ Đã lưu chế độ Offline');
      return;
    }
    const res = await syncWithGoogleSheets(true);
    showToast(res.message);
  };

  const handleExportJSON = async () => {
    const json = await exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_HuChiTieu_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📦 Đã tải xuống file Backup (.JSON)');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importBackupJSON(text);
      showToast('✅ Đã khôi phục toàn bộ dữ liệu!');
    } catch (err) {
      showToast(`❌ Lỗi khôi phục: ${err instanceof Error ? err.message : 'File không hợp lệ'}`);
    }
  };

  const displayedCategories = categories.filter((c) => c.type === catFilterType);

  return (
    <div className="space-y-4 pb-28 lg:pb-12 max-w-5xl mx-auto">
      {/* Header trang Cài Đặt + Nút Mở / Thu gọn tất cả */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Cài Đặt & Quản Trị</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Bấm vào từng mục để mở rộng hoặc thu gọn tùy chọn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            Thu gọn hết
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-emerald-400 transition cursor-pointer"
          >
            Mở tất cả
          </button>
        </div>
      </div>

      {/* DANH SÁCH CÁC BOX THẢ XUỐNG (ACCORDION CARDS) */}
      <div className="space-y-3.5">
        {/* ========================================================= */}
        {/* 1. BOX: DANH SÁCH NGƯỜI DÙNG */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          {/* Header Box (Thanh bấm để thả xuống/thu gọn) */}
          <button
            type="button"
            onClick={() => toggleSection('users')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Danh Sách Người Dùng</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
                    {members.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Tên người sử dụng & người ghi chép mặc định
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.users ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {/* Nội dung bên trong khi thả xuống */}
          {openSections.users && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-4">
              <p className="text-xs sm:text-sm text-slate-400">
                Tự đặt tên người sử dụng (VD: Ba Thỏ, Mẹ Thỏ...). Bấm vào tên để chọn làm người đang thao tác trên thiết bị này.
              </p>

              {members.length > 0 && (
                <div className="space-y-2.5">
                  {members.map((m) => {
                    const isCurrent = currentMember === m.id;
                    const isEditing = editingMemberId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition ${
                          isCurrent
                            ? 'bg-emerald-500/15 border-emerald-500/50'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        {!isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentMember(m.id);
                                showToast(`Đang dùng với tên: ${m.avatar} ${m.name}`);
                              }}
                              className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                            >
                              <span className="text-2xl">{m.avatar}</span>
                              <div>
                                <div className="text-sm sm:text-base font-bold text-slate-100">{m.name}</div>
                                {isCurrent && (
                                  <span className="text-xs font-semibold text-emerald-400">
                                    ● Đang chọn trên máy này
                                  </span>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMemberId(m.id);
                                  setEditingMemberName(m.name);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Sửa tên"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m.id, m.name)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={editingMemberName}
                              onChange={(e) => setEditingMemberName(e.target.value)}
                              className="flex-1 bg-slate-800 border border-emerald-500 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditMember(m.id)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="p-2 rounded-xl bg-slate-800 text-slate-400 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddMember} className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                <select
                  value={newMemberAvatar}
                  onChange={(e) => setNewMemberAvatar(e.target.value)}
                  className="h-11 min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base"
                >
                  {AVATAR_OPTIONS.map((av) => (
                    <option key={av} value={av}>
                      {av}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Nhập tên mới (VD: Ba Thỏ, Mẹ Thỏ...)"
                  className="h-11 min-h-[44px] flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-sm text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-11 min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <Plus className="w-4 h-4 stroke-[2.8]" /> Thêm Tên
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. BOX: QUẢN LÝ NGUỒN TIỀN / VÍ */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          <button
            type="button"
            onClick={() => toggleSection('wallets')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Quản Lý Nguồn Tiền / Ví</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold shrink-0">
                    {wallets.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Tiền mặt, tài khoản ngân hàng, thẻ, ví điện tử
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.wallets ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {openSections.wallets && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-4">
              <p className="text-xs sm:text-sm text-slate-400">
                Tạo các nguồn tiền thực tế của bạn. Bạn có thể sửa tên, sửa số dư ban đầu hoặc xóa bất kỳ ví nào.
              </p>

              {wallets.length > 0 && (
                <div className="space-y-3">
                  {wallets.map((w) => {
                    const isEditing = editingWalletId === w.id;
                    const owner = members.find((m) => m.id === w.owner_id);

                    return (
                      <div
                        key={w.id}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800"
                      >
                        {!isEditing ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-2xl">{w.icon}</span>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-bold text-slate-100 truncate">{w.name}</div>
                                <div className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                  Số dư ban đầu: <strong className="text-emerald-400">{formatVND(w.initial_balance)}</strong>
                                  {owner ? ` • ${owner.name}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditWallet(w)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Sửa nguồn tiền"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWallet(w)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Xóa nguồn tiền"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <input
                                type="text"
                                value={editWName}
                                onChange={(e) => setEditWName(e.target.value)}
                                placeholder="Tên nguồn tiền"
                                className="h-11 bg-slate-800 border border-emerald-500 rounded-xl px-3 text-sm font-bold text-white focus:outline-none"
                              />
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editWBal}
                                onChange={(e) => setEditWBal(e.target.value)}
                                placeholder="Số dư đầu kỳ"
                                className="h-11 bg-slate-800 border border-emerald-500 rounded-xl px-3 text-sm font-bold text-white focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={editWType}
                                onChange={(e) => setEditWType(e.target.value as WalletType)}
                                className="h-11 bg-slate-800 border border-slate-700 rounded-xl px-3 text-xs sm:text-sm text-slate-200"
                              >
                                <option value="BANK">🏦 Ngân hàng</option>
                                <option value="CASH">💵 Tiền mặt</option>
                                <option value="EWALLET">💳 Ví điện tử</option>
                              </select>

                              <select
                                value={editWOwner}
                                onChange={(e) => setEditWOwner(e.target.value)}
                                className="h-11 bg-slate-800 border border-slate-700 rounded-xl px-3 text-xs sm:text-sm text-slate-200"
                              >
                                <option value="">-- Chung --</option>
                                {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.avatar} {m.name}
                              </option>
                            ))}
                              </select>

                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditWallet(w.id)}
                                  className="h-11 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <Save className="w-4 h-4" /> Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingWalletId(null)}
                                  className="h-11 px-3 rounded-xl bg-slate-800 text-slate-400 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddWallet} className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="text-xs sm:text-sm font-bold text-slate-200">Thêm nguồn tiền mới:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="Tên nguồn tiền (VD: Tiền mặt, Techcombank...)"
                    className="h-11 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-sm text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newWalletBalance}
                    onChange={(e) => setNewWalletBalance(e.target.value)}
                    placeholder="Số dư ban đầu (Mặc định: 0)"
                    className="h-11 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={newWalletType}
                    onChange={(e) => setNewWalletType(e.target.value as WalletType)}
                    className="h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-sm text-slate-200"
                  >
                    <option value="BANK">🏦 Ngân hàng</option>
                    <option value="CASH">💵 Tiền mặt</option>
                    <option value="EWALLET">💳 Ví điện tử</option>
                  </select>

                  {members.length > 0 && (
                    <select
                      value={newWalletOwner}
                      onChange={(e) => setNewWalletOwner(e.target.value)}
                      className="h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-sm text-slate-200"
                    >
                      <option value="">-- Của chung --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.avatar} {m.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="submit"
                    className="h-11 ml-auto px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 stroke-[2.8]" /> Thêm Nguồn Tiền
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. BOX: QUẢN LÝ DANH MỤC THU / CHI */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          <button
            type="button"
            onClick={() => toggleSection('categories')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Quản Lý Danh Mục Thu / Chi</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold shrink-0">
                    {categories.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Thêm mới, đổi tên, biểu tượng hoặc xóa danh mục
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.categories ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {openSections.categories && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-slate-400">
                  Tùy biến danh mục theo thói quen chi tiêu của gia đình bạn:
                </p>

                <div className="flex bg-slate-800 p-1 rounded-xl gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatFilterType('EXPENSE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      catFilterType === 'EXPENSE' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Chi tiêu ({categories.filter((c) => c.type === 'EXPENSE').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatFilterType('INCOME')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      catFilterType === 'INCOME' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Thu nhập ({categories.filter((c) => c.type === 'INCOME').length})
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {displayedCategories.map((cat) => {
                  const isEditing = editingCatId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className="px-3.5 py-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      {!isEditing ? (
                        <>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl">{cat.icon}</span>
                            <span className="text-sm font-bold text-slate-100 truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditCategory(cat)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                              title="Sửa danh mục"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Xóa danh mục"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <select
                            value={editCatIcon}
                            onChange={(e) => setEditCatIcon(e.target.value)}
                            className="h-10 bg-slate-800 border border-slate-700 rounded-xl px-2 text-base"
                          >
                            {CATEGORY_ICONS.map((ic) => (
                              <option key={ic} value={ic}>
                                {ic}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="h-10 flex-1 bg-slate-800 border border-emerald-500 rounded-xl px-3 text-sm font-bold text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(cat.id)}
                            className="h-10 px-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="h-10 px-2.5 rounded-xl bg-slate-800 text-slate-400 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
                <select
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="h-11 min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base"
                >
                  {CATEGORY_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={`Tên danh mục ${catFilterType === 'EXPENSE' ? 'chi tiêu' : 'thu nhập'} mới...`}
                  className="h-11 min-h-[44px] flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 text-sm text-white focus:outline-none"
                />
                {catFilterType === 'EXPENSE' && (
                  <select
                    value={newCatJar}
                    onChange={(e) => setNewCatJar(e.target.value as JarCode)}
                    className="h-11 min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-2.5 text-xs sm:text-sm text-slate-200"
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
                  className="h-11 min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center gap-1 cursor-pointer active:scale-95 transition"
                >
                  <Plus className="w-4 h-4 stroke-[2.8]" /> Thêm Mục
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. BOX: ĐỒNG BỘ GOOGLE SHEETS */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          <button
            type="button"
            onClick={() => toggleSection('sync')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Đồng Bộ Google Sheets</h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                      pendingCount > 0
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {pendingCount > 0 ? `${pendingCount} chờ gửi` : 'Đã kết nối'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Tự động lưu và đồng bộ 2 chiều qua Google Apps Script
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.sync ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {openSections.sync && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-400">
                Dán đường dẫn <strong>Web App URL</strong> từ file Google Apps Script để các thiết bị tự động đồng bộ thu chi:
              </p>

              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-4 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />

              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSaveUrlAndSync}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Đang đồng bộ với Google Sheets...' : 'Lưu URL & Đồng Bộ Ngay'}
              </button>

              {lastSyncTime && (
                <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
                  <span>Lần đồng bộ cuối: {new Date(lastSyncTime).toLocaleString('vi-VN')}</span>
                  <span className="text-emerald-400 font-bold">● Local-First</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 5. BOX: SAO LƯU & PHỤC HỒI (.JSON) */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          <button
            type="button"
            onClick={() => toggleSection('backup')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Sao Lưu & Phục Hồi Dữ Liệu</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold shrink-0">
                    .JSON
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Xuất file dự phòng offline hoặc khôi phục dữ liệu
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.backup ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {openSections.backup && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-4">
              <p className="text-xs sm:text-sm text-slate-400">
                Xuất toàn bộ giao dịch, nguồn tiền và cài đặt ra file <code>.JSON</code> độc lập để lưu trữ an toàn phòng khi đổi máy.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="h-12 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Xuất File Backup (.JSON)
                </button>

                <label className="h-12 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
                  <Upload className="w-4 h-4 text-amber-400" /> Khôi Phục Từ File Backup
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 6. BOX: ỨNG DỤNG ANDROID (.APK) */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xs transition hover:border-slate-700/80">
          <button
            type="button"
            onClick={() => toggleSection('apk')}
            className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between text-left cursor-pointer transition bg-slate-900 hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white truncate">Ứng Dụng Android (.APK)</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
                    HuChiTieu.apk
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  Tải trực tiếp file APK để cài đặt lên điện thoại
                </p>
              </div>
            </div>

            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                openSections.apk ? 'rotate-180 text-white' : ''
              }`}
            >
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {openSections.apk && (
            <div className="p-5 sm:p-6 border-t border-slate-800/80 animate-fadeIn space-y-4">
              <p className="text-xs sm:text-sm text-slate-400">
                File <code>HuChiTieu.apk</code> được GitHub Actions tự động biên dịch mới nhất từ mã nguồn. Bạn có thể bấm nút bên dưới để tải về cài trực tiếp:
              </p>

              <a
                href="https://github.com/trungvuong3xx/Huchitieu/releases/download/app-latest/HuChiTieu.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
              >
                <Download className="w-4 h-4 stroke-[3]" /> Tải HuChiTieu.apk Cài Đặt Ngay
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
