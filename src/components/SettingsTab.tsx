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
  ExternalLink,
} from 'lucide-react';
import { db, FAMILY_MEMBERS } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import { syncWithGoogleSheets, exportBackupJSON, importBackupJSON } from '../services/syncEngine';
import { formatVND, generateId } from '../utils/formatters';
import type { MemberId, WalletType } from '../types';

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
  const pendingCount = useLiveQuery(() => db.transactions.where('sync_status').equals('PENDING').count(), []) || 0;

  const [urlInput, setUrlInput] = useState(scriptUrl);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [newWalletOwner, setNewWalletOwner] = useState<MemberId>('FAMILY');
  const [newWalletType, setNewWalletType] = useState<WalletType>('BANK');
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editingWalletBal, setEditingWalletBal] = useState<string>('');

  const handleSaveUrlAndSync = async () => {
    setScriptUrl(urlInput);
    if (!urlInput.trim()) {
      showToast('ℹ️ Đã lưu chế độ Offline (Local-First)');
      return;
    }
    const res = await syncWithGoogleSheets(true);
    showToast(res.message);
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const initBal = parseInt(newWalletBalance.replace(/\D/g, ''), 10) || 0;

    await db.wallets.add({
      id: generateId('w'),
      name: newWalletName.trim(),
      type: newWalletType,
      initial_balance: initBal,
      owner_id: newWalletOwner,
      icon: newWalletType === 'CASH' ? '💵' : newWalletType === 'BANK' ? '🏦' : '💳',
      color: '#10b981',
      is_archived: false,
      updated_at: new Date().toISOString(),
    });

    setNewWalletName('');
    setNewWalletBalance('');
    showToast(`✅ Đã thêm ví "${newWalletName}"`);
  };

  const handleExportJSON = async () => {
    const json = await exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_HuChiTieuGiaDinh_${new Date().toISOString().slice(0, 10)}.json`;
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
      showToast('✅ Đã khôi phục toàn bộ dữ liệu từ bản sao lưu!');
    } catch (err) {
      showToast(`❌ Lỗi khôi phục: ${err instanceof Error ? err.message : 'File không hợp lệ'}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-24 lg:pb-10 items-start">
      {/* Cột Trái (6/12 trên Desktop): Người dùng & Kết nối Google Sheets */}
      <div className="lg:col-span-6 space-y-5">
        {/* 1. Chọn người đang sử dụng trên thiết bị này */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
          <h3 className="text-sm sm:text-base font-bold text-white mb-1">👤 Ai đang dùng trên thiết bị này?</h3>
          <p className="text-xs text-slate-400 mb-3">
            Mọi giao dịch bấm nhanh sẽ tự động gán tên và ví mặc định của người này.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {FAMILY_MEMBERS.map((m) => {
              const active = currentMember === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setCurrentMember(m.id);
                    showToast(`Đã chuyển người nhập mặc định sang: ${m.avatar} ${m.name}`);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-2xl">{m.avatar}</span>
                  <span className="text-xs font-bold">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Kết nối & Đồng bộ 2 chiều Google Sheets */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">Đồng Bộ Google Sheets (Gia Đình)</h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold">
              {pendingCount} chờ gửi
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Đường dẫn <strong>Web App URL</strong> từ file Google Apps Script (`backend/Code.gs`) để 2 vợ chồng tự động đồng bộ thu chi:
          </p>

          <div className="space-y-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSaveUrlAndSync}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Đang đồng bộ với Google Sheets...' : 'Lưu URL & Đồng Bộ Ngay'}
              </button>
            </div>

            {lastSyncTime && (
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Lần đồng bộ cuối: {new Date(lastSyncTime).toLocaleString('vi-VN')}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Local-First Ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Sao lưu & Phục hồi (3-2-1 Backup Strategy) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">Sao Lưu & Phục Hồi Dữ Liệu (Backup / Restore)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Xuất toàn bộ giao dịch, ví và ngân sách ra file <code>.JSON</code> để lưu trữ an toàn tuyệt đối.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportJSON}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Xuất File Backup
            </button>

            <label className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4 text-amber-400" /> Khôi Phục (.JSON)
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Cột Phải (6/12 trên Desktop): Quản lý các Ví trong Gia Đình */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">Danh Sách Ví & Tài Khoản ({wallets.length})</h3>
        </div>

        <div className="space-y-2.5 mb-4">
          {wallets.map((w) => {
            const isEditing = editingWalletId === w.id;
            return (
              <div
                key={w.id}
                className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-slate-950/60 border border-slate-800/80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{w.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">{w.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Số dư đầu kỳ: <strong className="text-slate-300">{formatVND(w.initial_balance)}</strong> • Sở hữu:{' '}
                      {FAMILY_MEMBERS.find((m) => m.id === w.owner_id)?.name}
                    </div>
                  </div>
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWalletId(w.id);
                      setEditingWalletBal(String(w.initial_balance));
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 shrink-0 cursor-pointer"
                  >
                    Sửa số dư đầu
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editingWalletBal}
                      onChange={(e) => setEditingWalletBal(e.target.value)}
                      className="w-24 bg-slate-800 border border-emerald-500 rounded-xl px-2 py-1 text-xs font-bold text-white focus:outline-none"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const val = parseInt(editingWalletBal.replace(/\D/g, ''), 10) || 0;
                        await db.wallets.update(w.id, {
                          initial_balance: val,
                          updated_at: new Date().toISOString(),
                        });
                        setEditingWalletId(null);
                        showToast(`✅ Đã cập nhật số dư đầu kỳ ví "${w.name}" = ${formatVND(val)}`);
                        syncWithGoogleSheets(true).catch(() => {});
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Lưu
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddWallet} className="space-y-2.5 pt-3 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-300">Thêm ví mới:</div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              placeholder="Tên ví (VD: Thẻ Techcombank)"
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
            <input
              type="text"
              inputMode="numeric"
              value={newWalletBalance}
              onChange={(e) => setNewWalletBalance(e.target.value)}
              placeholder="Số dư đầu kỳ (VND)"
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newWalletType}
              onChange={(e) => setNewWalletType(e.target.value as WalletType)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300"
            >
              <option value="BANK">🏦 Ngân hàng</option>
              <option value="CASH">💵 Tiền mặt</option>
              <option value="EWALLET">💳 Ví điện tử</option>
            </select>
            <select
              value={newWalletOwner}
              onChange={(e) => setNewWalletOwner(e.target.value as MemberId)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300"
            >
              <option value="FAMILY">🏡 Quỹ Chung</option>
              <option value="WIFE">👩🏻 Của Vợ</option>
              <option value="HUSBAND">👨🏻 Của Chồng</option>
            </select>
            <button
              type="submit"
              className="ml-auto px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm Ví
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
