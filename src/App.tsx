import React, { useEffect } from 'react';
import { Home, PieChart, PiggyBank, Settings, Plus, RefreshCw, Undo2 } from 'lucide-react';
import { db, initializeDatabase, FAMILY_MEMBERS } from './db/database';
import { useAppStore, type ActiveTab } from './store/useAppStore';
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

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Sổ Thu Chi', icon: Home },
    { id: 'analytics', label: 'Báo Cáo Phân Tích', icon: PieChart },
    { id: 'budgets', label: '6 Hũ & Hạn Mức', icon: PiggyBank },
    { id: 'settings', label: 'Cài Đặt & Đồng Bộ', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* SIDEBAR BÊN TRÁI CHO DESKTOP/WEB (Ẩn trên Mobile, Hiện trên màn hình >= md) */}
      <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col justify-between bg-slate-900/70 border-r border-slate-800/80 p-5 sticky top-0 h-screen">
        <div className="space-y-6">
          {/* Logo & Tên App */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-inner">
              🏺
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">Hũ Chi Tiêu</h1>
              <p className="text-xs text-slate-400 mt-1">Gia Đình • Google Sheets</p>
            </div>
          </div>

          {/* Nút "+ GHI THU CHI (3 GIÂY)" nổi bật trên Desktop Sidebar */}
          <button
            type="button"
            onClick={openQuickAdd}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.8]" /> Ghi Thu Chi (3 Giây)
          </button>

          {/* Menu Điều hướng trên Desktop */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs lg:text-sm font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Góc dưới Sidebar: Chọn nhanh người đang dùng & Nút Đồng bộ */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="text-[11px] text-slate-400 mb-2">Đang thao tác với tư cách:</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['WIFE', 'HUSBAND'] as const).map((mId) => {
                const m = FAMILY_MEMBERS.find((x) => x.id === mId)!;
                const active = currentMember === mId;
                return (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => {
                      setCurrentMember(mId);
                      showToast(`Đang ghi với tư cách: ${m.avatar} ${m.name}`);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{m.avatar}</span>
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const res = await syncWithGoogleSheets();
              showToast(res.message);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
            <span>{isSyncing ? 'Đang đồng bộ Sheet...' : 'Đồng bộ Google Sheets'}</span>
          </button>
        </div>
      </aside>

      {/* KHU VỰC NỘI DUNG CHÍNH (Mobile: vừa khít điện thoại | Desktop: mở rộng 1280px 2 cột) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="w-full max-w-md md:max-w-6xl mx-auto flex-1 flex flex-col px-3.5 sm:px-6 pt-3 md:pt-6">
          {/* Top Bar trên Mobile (Ẩn trên Desktop vì đã có Sidebar) */}
          <header className="flex md:hidden items-center justify-between mb-3">
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
              <button
                type="button"
                onClick={() => {
                  const next = currentMember === 'WIFE' ? 'HUSBAND' : 'WIFE';
                  setCurrentMember(next);
                  const m = FAMILY_MEMBERS.find((x) => x.id === next);
                  showToast(`Đang ghi với tư cách: ${m?.avatar} ${m?.name}`);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition"
              >
                <span>{activeMemberObj.avatar}</span>
                <span>{activeMemberObj.name}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
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
        </div>

        {/* Toast thông báo + Nút Hoàn tác (Undo) */}
        {toastMessage && (
          <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-slate-900/95 border border-emerald-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-medium animate-fadeIn">
            <span className="truncate pr-2">{toastMessage.text}</span>
            {toastMessage.undoTxId && (
              <button
                type="button"
                onClick={() => handleUndo(toastMessage.undoTxId!)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold shrink-0 hover:bg-amber-500/30 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
              </button>
            )}
          </div>
        )}

        {/* Thanh Điều Hướng Đáy (CHỈ HIỆN TRÊN MOBILE < md) */}
        <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 px-4 py-1.5 z-30 flex items-center justify-between">
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
