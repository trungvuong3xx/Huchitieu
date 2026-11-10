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
} from 'lucide-react';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { syncWithGoogleSheets, exportBackupJSON, importBackupJSON } from '../services/syncEngine';
import { formatVND, generateId } from '../utils/formatters';
import type { WalletType, Wallet } from '../types';

const AVATAR_OPTIONS = ['👤', '👨🏻', '👩🏻', '👶🏻', '爷爷', '👵🏻', '🏡', '⭐'];

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
  const pendingCount = useLiveQuery(() => db.transactions.where('sync_status').equals('PENDING').count(), []) || 0;

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
  };

  const handleSaveEditMember = async (id: string) => {
    if (!editingMemberName.trim()) return;
    await db.members.update(id, { name: editingMemberName.trim() });
    setEditingMemberId(null);
    showToast('✅ Đã đổi tên thành công');
  };

  const handleDeleteMember = async (id: string, name: string) => {
    await db.members.delete(id);
    if (currentMember === id) {
      const remaining = members.filter((m) => m.id !== id);
      setCurrentMember(remaining[0]?.id || '');
    }
    showToast(`🗑️ Đã xóa "${name}"`);
  };

  // --- XỬ LÝ NGUỒN TIỀN (VÍ) ---
  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const initBal = parseInt(newWalletBalance.replace(/\D/g, ''), 10) || 0;

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
    const initBal = parseInt(editWBal.replace(/\D/g, ''), 10) || 0;
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24 lg:pb-10 items-start">
      {/* Cột Trái (6/12): Quản lý Thành Viên / Người Dùng & Quản lý Nguồn Tiền */}
      <div className="lg:col-span-6 space-y-6">
        {/* 1. Quản lý Người Dùng / Thành Viên (Tự đặt tên, không mặc định Vợ/Chồng) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">Danh Sách Người Dùng ({members.length})</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Tự đặt tên người sử dụng (VD: Vương, Thảo, Quỹ Chung...). Bấm vào tên để chọn làm người đang thao tác trên thiết bị này.
          </p>

          {members.length > 0 && (
            <div className="space-y-2.5 mb-4">
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
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            title="Sửa tên"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.id, m.name)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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
                          className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
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

          <form onSubmit={handleAddMember} className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
            <select
              value={newMemberAvatar}
              onChange={(e) => setNewMemberAvatar(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base"
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
              placeholder="Nhập tên (VD: Vương, Thảo...)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Thêm Tên
            </button>
          </form>
        </div>

        {/* 2. Quản lý Nguồn Tiền / Ví (Thêm, Sửa, Xóa toàn quyền, không tạo mặc định) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">Quản Lý Nguồn Tiền / Ví ({wallets.length})</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Tạo các nguồn tiền thực tế của bạn (Tiền mặt, Ngân hàng, Ví điện tử). Có thể sửa tên, sửa số dư hoặc xóa bất cứ lúc nào.
          </p>

          {wallets.length > 0 && (
            <div className="space-y-3 mb-4">
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
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                            title="Sửa nguồn tiền"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWallet(w)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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
                            className="bg-slate-800 border border-emerald-500 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editWBal}
                            onChange={(e) => setEditWBal(e.target.value)}
                            placeholder="Số dư đầu kỳ"
                            className="bg-slate-800 border border-emerald-500 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editWType}
                            onChange={(e) => setEditWType(e.target.value as WalletType)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200"
                          >
                            <option value="BANK">🏦 Ngân hàng</option>
                            <option value="CASH">💵 Tiền mặt</option>
                            <option value="EWALLET">💳 Ví điện tử</option>
                          </select>

                          <select
                            value={editWOwner}
                            onChange={(e) => setEditWOwner(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200"
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
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-4 h-4" /> Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingWalletId(null)}
                              className="p-2 rounded-xl bg-slate-800 text-slate-400 cursor-pointer"
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

          {/* Form Thêm Nguồn Tiền Mới */}
          <form onSubmit={handleAddWallet} className="space-y-3 pt-3 border-t border-slate-800">
            <div className="text-sm font-bold text-slate-200">Thêm nguồn tiền mới:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                placeholder="Tên nguồn tiền (VD: Tiền mặt, Vietcombank...)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={newWalletBalance}
                onChange={(e) => setNewWalletBalance(e.target.value)}
                placeholder="Số dư ban đầu (Mặc định: 0)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={newWalletType}
                onChange={(e) => setNewWalletType(e.target.value as WalletType)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200"
              >
                <option value="BANK">🏦 Ngân hàng</option>
                <option value="CASH">💵 Tiền mặt</option>
                <option value="EWALLET">💳 Ví điện tử</option>
              </select>

              {members.length > 0 && (
                <select
                  value={newWalletOwner}
                  onChange={(e) => setNewWalletOwner(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200"
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
                className="ml-auto px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" /> Thêm Nguồn Tiền
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Cột Phải (6/12): Đồng Bộ Google Sheets & Sao Lưu Dữ Liệu */}
      <div className="lg:col-span-6 space-y-6">
        {/* Kết nối & Đồng bộ 2 chiều Google Sheets */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">Đồng Bộ Google Sheets</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-bold">
              {pendingCount} chờ gửi
            </span>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Đường dẫn <strong>Web App URL</strong> từ file Google Apps Script để tự động lưu và đồng bộ thu chi:
          </p>

          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSaveUrlAndSync}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Đang đồng bộ với Google Sheets...' : 'Lưu URL & Đồng Bộ Ngay'}
            </button>

            {lastSyncTime && (
              <div className="text-xs text-slate-400 pt-1">
                Lần đồng bộ cuối: {new Date(lastSyncTime).toLocaleString('vi-VN')}
              </div>
            )}
          </div>
        </div>

        {/* Sao lưu & Phục hồi */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">Sao Lưu & Phục Hồi (.JSON)</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Xuất toàn bộ giao dịch, nguồn tiền và cài đặt ra file <code>.JSON</code> hoặc khôi phục lại từ file đã lưu.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportJSON}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Xuất File Backup
            </button>

            <label className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition">
              <Upload className="w-4 h-4 text-amber-400" /> Khôi Phục (.JSON)
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
