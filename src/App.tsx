import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Home, PieChart, PiggyBank, Settings, Plus, RefreshCw, Undo2, Sun, Moon } from 'lucide-react';
import { db, initializeDatabase } from './db/database';
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
    theme,
    toggleTheme,
  } = useAppStore();

  const members = useLiveQuery(() => db.members.toArray(), []) || [];

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

  const activeMemberObj = members.find((m) => m.id === currentMember);

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Sổ Thu Chi', icon: Home },
    { id: 'analytics', label: 'Báo Cáo', icon: PieChart },
    { id: 'budgets', label: '6 Hũ & Quỹ', icon: PiggyBank },
    { id: 'settings', label: 'Cài Đặt', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex transition-colors duration-250">
      {/* SIDEBAR BÊN TRÁI CHO DESKTOP/WEB (>= md) */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col justify-between bg-slate-900 border-r border-slate-800 p-5 sticky top-0 h-screen shadow-sm">
        <div className="space-y-6">
          {/* Logo & Theme Switcher */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-inner">
                🏺
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight leading-none">Hũ Chi Tiêu</h1>
                <p className="text-xs text-slate-400 mt-1 font-medium">Tối giản • Thông minh</p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 active:scale-95 transition-all cursor-pointer shadow-xs"
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
              aria-label="Đổi giao diện Sáng / Tối"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>

          {/* Nút "+ GHI THU CHI" (Nổi bật, h-12) */}
          <button
            type="button"
            onClick={openQuickAdd}
            className="w-full h-12 min-h-[48px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[3]" /> Ghi Thu Chi
          </button>

          {/* Menu Điều hướng Desktop (Touch target >= 44x44px) */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[48px] flex items-center gap-3.5 px-4 rounded-2xl text-sm font-bold transition cursor-pointer active:scale-[0.98] ${
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

        {/* Góc dưới Sidebar: Chọn người dùng & Nút Đồng bộ */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          {members.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Người ghi chép:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const active = currentMember === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setCurrentMember(m.id);
                        showToast(`Đang ghi với tên: ${m.avatar} ${m.name}`);
                      }}
                      className={`min-h-[36px] py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-xs'
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
          )}

          <button
            type="button"
            onClick={async () => {
              const res = await syncWithGoogleSheets();
              showToast(res.message);
            }}
            className="w-full h-11 min-h-[44px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs sm:text-sm font-bold text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Google Sheets'}</span>
          </button>
        </div>
      </aside>

      {/* KHU VỰC NỘI DUNG CHÍNH (Mobile + Desktop) */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="w-full max-w-md md:max-w-6xl mx-auto flex-1 flex flex-col px-3.5 sm:px-6 pt-3 md:pt-6">
          {/* Top Bar trên Mobile (< md) */}
          <header className="flex md:hidden items-center justify-between mb-3.5 px-0.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shadow-inner">
                🏺
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight leading-none">Hũ Chi Tiêu</h1>
                {activeMemberObj && (
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <span>{activeMemberObj.avatar}</span>
                    <span>{activeMemberObj.name}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 active:scale-95 transition"
                title="Đổi giao diện Sáng / Tối"
                aria-label="Đổi giao diện Sáng / Tối"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await syncWithGoogleSheets();
                  showToast(res.message);
                }}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 active:scale-95 transition"
                title="Đồng bộ ngay với Google Sheets"
                aria-label="Đồng bộ Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </header>

          {/* Nội dung Tab */}
          <main className="flex-1">
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'budgets' && <BudgetsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </main>
        </div>

        {/* TOAST PHẢN HỒI THÀNH CÔNG / BÁO LỖI VÀ HOÀN TÁC */}
        {toastMessage && (
          <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between text-sm font-semibold animate-fadeIn">
            <span className="truncate pr-2">{toastMessage.text}</span>
            {toastMessage.undoTxId && (
              <button
                type="button"
                onClick={() => handleUndo(toastMessage.undoTxId!)}
                className="h-11 min-h-[44px] px-3.5 rounded-xl bg-amber-500/20 text-amber-300 font-extrabold text-xs flex items-center gap-1.5 shrink-0 hover:bg-amber-500/30 active:scale-95 cursor-pointer"
              >
                <Undo2 className="w-4 h-4" /> Hoàn tác
              </button>
            )}
          </div>
        )}

        {/* THANH ĐIỀU HƯỚNG ĐÁY THUMB ZONE (MOBILE < md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 px-3 py-1.5 z-40 flex items-center justify-around shadow-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px]">Sổ Thu Chi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
              activeTab === 'analytics' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[11px]">Báo Cáo</span>
          </button>

          {/* FAB Action Button chính ở trung tâm ngón cái */}
          <div className="flex-1 flex justify-center -mt-6">
            <button
              type="button"
              onClick={openQuickAdd}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/30 flex items-center justify-center active:scale-90 transition cursor-pointer"
              title="Ghi Thu Chi Nhanh"
              aria-label="Ghi Thu Chi Nhanh"
            >
              <Plus className="w-7 h-7 stroke-[3]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
              activeTab === 'budgets' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[11px]">6 Hũ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
              activeTab === 'settings' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px]">Cài Đặt</span>
          </button>
        </nav>

        {/* Modal Ghi Thu Chi Tối Giản */}
        <QuickAddModal />
      </div>
    </div>
  );
};

export default App;
