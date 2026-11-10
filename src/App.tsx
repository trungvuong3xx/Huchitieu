import React, { useEffect } from 'react';
import { Home, PieChart, PiggyBank, Settings, Plus, RefreshCw, Undo2 } from 'lucide-react';
import { db, initializeDatabase, FAMILY_MEMBERS } from './db/database';
import { useAppStore } from './store/useAppStore';
import { DashboardTab } from './components/DashboardTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { BudgetsTab } from './components/BudgetsTab';
import { SettingsTab } from './components/SettingsTab';
import { QuickAddModal } from './components/QuickAddModal';
import { syncWithGoogleSheets } from './services/syncEngine';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    openQuickAdd,
    currentMember,
    setCurrentMember,
    isSyncing,
    scriptUrl,
    toastMessage,
    clearToast,
    showToast,
  } = useAppStore();

  useEffect(() => {
    initializeDatabase().then(() => {
      if (scriptUrl) {
        syncWithGoogleSheets().catch(() => {});
      }
    });
  }, []);

  const handleUndo = async (txId: string) => {
    await db.transactions.delete(txId);
    clearToast();
    showToast('↩️ Đã hoàn tác giao dịch vừa nhập');
  };

  const activeMemberObj = FAMILY_MEMBERS.find((m) => m.id === currentMember) || FAMILY_MEMBERS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col relative px-3.5 pt-3">
        {/* Top Bar: Thương hiệu + Đổi nhanh Vợ/Chồng + Nút Sync */}
        <header className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg shadow-inner">
              🏺
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight leading-none">Hũ Chi Tiêu Gia Đình</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Local-First • Đồng bộ Google Sheets</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Chuyển đổi nhanh người đang cầm máy (1 chạm đổi Chồng <-> Vợ) */}
            <button
              type="button"
              onClick={() => {
                const next = currentMember === 'WIFE' ? 'HUSBAND' : 'WIFE';
                setCurrentMember(next);
                const m = FAMILY_MEMBERS.find((x) => x.id === next);
                showToast(`Đang ghi với tư cách: ${m?.avatar} ${m?.name}`);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition"
              title="Chạm để đổi nhanh người đang ghi chép"
            >
              <span>{activeMemberObj.avatar}</span>
              <span>{activeMemberObj.name}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!scriptUrl) {
                  setActiveTab('settings');
                  showToast('⚙️ Hãy dán Google Script URL trong mục Cài đặt để đồng bộ');
                  return;
                }
                const res = await syncWithGoogleSheets();
                showToast(res.message);
              }}
              className="p-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition"
              title="Đồng bộ ngay với Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Nội dung Tab hiện tại */}
        <main className="flex-1">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'budgets' && <BudgetsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>

        {/* Toast thông báo + Nút Hoàn tác (Undo) trong 4 giây */}
        {toastMessage && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm bg-slate-900/95 border border-emerald-500/40 text-slate-100 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between text-xs font-medium animate-fadeIn">
            <span className="truncate pr-2">{toastMessage.text}</span>
            {toastMessage.undoTxId && (
              <button
                type="button"
                onClick={() => handleUndo(toastMessage.undoTxId!)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold shrink-0 hover:bg-amber-500/30"
              >
                <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
              </button>
            )}
          </div>
        )}

        {/* Thanh Điều Hướng Đáy (Bottom Navigation Bar) với nút '+' Nhập 3 Giây ở chính giữa */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 px-4 py-1.5 z-30 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Sổ Thu Chi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition ${
              activeTab === 'analytics' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px]">Báo Cáo</span>
          </button>

          {/* Nút '+' Siêu Tốc ở chính giữa ngón cái */}
          <div className="-mt-6">
            <button
              type="button"
              onClick={openQuickAdd}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition"
              title="Nhập chi tiêu trong 3 giây"
            >
              <Plus className="w-7 h-7 stroke-[2.8]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition ${
              activeTab === 'budgets' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[10px]">6 Hũ & Trần</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition ${
              activeTab === 'settings' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Cài Đặt</span>
          </button>
        </nav>

        {/* Modal Nhập Chi Tiêu Trong 3 Giây */}
        <QuickAddModal />
      </div>
    </div>
  );
};

export default App;
