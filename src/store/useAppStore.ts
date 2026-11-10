import { create } from 'zustand';
import type { MemberId, BeneficiaryId } from '../types';
import { getCurrentMonthYear } from '../utils/formatters';

export type ActiveTab = 'dashboard' | 'analytics' | 'budgets' | 'settings';

interface AppState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Quick Add Modal state
  isQuickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;

  // Người đang cầm điện thoại thao tác (Lưu vào LocalStorage để mở lên là nhớ luôn)
  currentMember: MemberId;
  setCurrentMember: (member: MemberId) => void;

  // Bộ lọc kỳ báo cáo (YYYY-MM)
  selectedMonthYear: string;
  setSelectedMonthYear: (monthYear: string) => void;
  shiftMonth: (delta: number) => void;

  // Bộ lọc xem theo Thành viên hoặc Đối tượng thụ hưởng
  filterMember: MemberId | 'ALL';
  setFilterMember: (member: MemberId | 'ALL') => void;
  filterBeneficiary: BeneficiaryId | 'ALL';
  setFilterBeneficiary: (ben: BeneficiaryId | 'ALL') => void;
  filterSharedOnly: 'ALL' | 'SHARED' | 'PERSONAL';
  setFilterSharedOnly: (mode: 'ALL' | 'SHARED' | 'PERSONAL') => void;

  // Cấu hình Google Sheets Web App URL
  scriptUrl: string;
  setScriptUrl: (url: string) => void;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  lastSyncTime: string | null;
  setLastSyncTime: (time: string | null) => void;

  // Toast thông báo nhanh + Hoàn tác (Undo)
  toastMessage: { text: string; undoTxId?: string } | null;
  showToast: (text: string, undoTxId?: string) => void;
  clearToast: () => void;
}

const STORAGE_KEYS = {
  MEMBER: 'huchitieu_current_member',
  SCRIPT_URL: 'huchitieu_google_script_url',
  LAST_SYNC: 'huchitieu_last_sync',
};

export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyU3e3ptN0WghBaeVW30ozYjhJutRwllhxHJpAJA507xG2mLfruIcoc5Lur_WPzEJjfCQ/exec';

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isQuickAddOpen: false,
  openQuickAdd: () => set({ isQuickAddOpen: true }),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),

  currentMember: (localStorage.getItem(STORAGE_KEYS.MEMBER) as MemberId) || 'WIFE',
  setCurrentMember: (member) => {
    localStorage.setItem(STORAGE_KEYS.MEMBER, member);
    set({ currentMember: member });
  },

  selectedMonthYear: getCurrentMonthYear(),
  setSelectedMonthYear: (monthYear) => set({ selectedMonthYear: monthYear }),
  shiftMonth: (delta) => {
    const [year, month] = get().selectedMonthYear.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    set({ selectedMonthYear: nextStr });
  },

  filterMember: 'ALL',
  setFilterMember: (member) => set({ filterMember: member }),
  filterBeneficiary: 'ALL',
  setFilterBeneficiary: (ben) => set({ filterBeneficiary: ben }),
  filterSharedOnly: 'ALL',
  setFilterSharedOnly: (mode) => set({ filterSharedOnly: mode }),

  scriptUrl: localStorage.getItem(STORAGE_KEYS.SCRIPT_URL) || DEFAULT_GOOGLE_SCRIPT_URL,
  setScriptUrl: (url) => {
    const trimmed = url.trim();
    localStorage.setItem(STORAGE_KEYS.SCRIPT_URL, trimmed);
    set({ scriptUrl: trimmed });
  },

  isSyncing: false,
  setIsSyncing: (val) => set({ isSyncing: val }),
  lastSyncTime: localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || null,
  setLastSyncTime: (time) => {
    if (time) localStorage.setItem(STORAGE_KEYS.LAST_SYNC, time);
    set({ lastSyncTime: time });
  },

  toastMessage: null,
  showToast: (text, undoTxId) => {
    set({ toastMessage: { text, undoTxId } });
    setTimeout(() => {
      if (get().toastMessage?.text === text) {
        set({ toastMessage: null });
      }
    }, 4000);
  },
  clearToast: () => set({ toastMessage: null }),
}));
