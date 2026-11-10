import Dexie, { type EntityTable } from 'dexie';
import type { Wallet, Category, Transaction, Budget, QuickPreset, Member, BeneficiaryId, JarCode } from '../types';
import { getTodayLocalISO, getCurrentMonthYear } from '../utils/formatters';

export const FAMILY_MEMBERS: Member[] = [
  { id: 'HUSBAND', name: 'Chồng', avatar: '👨🏻', color: '#3b82f6' },
  { id: 'WIFE', name: 'Vợ', avatar: '👩🏻', color: '#ec4899' },
  { id: 'FAMILY', name: 'Quỹ Chung', avatar: '🏡', color: '#10b981' },
];

export const BENEFICIARIES: { id: BeneficiaryId; label: string; icon: string }[] = [
  { id: 'FAMILY', label: 'Cả nhà', icon: '🏡' },
  { id: 'KIDS', label: 'Con cái', icon: '👶🏻' },
  { id: 'HUSBAND', label: 'Chồng', icon: '👨🏻' },
  { id: 'WIFE', label: 'Vợ', icon: '👩🏻' },
  { id: 'PARENTS', label: 'Nội / Ngoại', icon: '👵🏻' },
];

export const SIX_JARS_INFO: Record<JarCode, { name: string; shortName: string; defaultPct: number; color: string; icon: string; desc: string }> = {
  NEC: { name: 'Thiết yếu (55%)', shortName: 'Thiết yếu', defaultPct: 55, color: '#ef4444', icon: '🏠', desc: 'Ăn uống, hóa đơn, đi lại, con cái' },
  LTSS: { name: 'Tiết kiệm dài hạn (10%)', shortName: 'Tiết kiệm', defaultPct: 10, color: '#3b82f6', icon: '💎', desc: 'Mua nhà, mua xe, dự phòng lớn' },
  EDUC: { name: 'Giáo dục & Phát triển (10%)', shortName: 'Giáo dục', defaultPct: 10, color: '#f59e0b', icon: '📚', desc: 'Học phí cho con, sách vở, khóa học' },
  FFA: { name: 'Tự do tài chính (10%)', shortName: 'Đầu tư', defaultPct: 10, color: '#10b981', icon: '📈', desc: 'Chứng khoán, vàng, tích sản' },
  PLAY: { name: 'Hưởng thụ (10%)', shortName: 'Hưởng thụ', defaultPct: 10, color: '#a855f7', icon: '🎉', desc: 'Du lịch, xem phim, ăn nhà hàng' },
  GIVE: { name: 'Cho đi & Hiếu hỉ (5%)', shortName: 'Hiếu hỉ', defaultPct: 5, color: '#ec4899', icon: '🎁', desc: 'Biếu bố mẹ, đám cưới, từ thiện' },
};

class FamilyFinanceDB extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  presets!: EntityTable<QuickPreset, 'id'>;

  constructor() {
    super('HuChiTieuGiaDinhDB');
    this.version(1).stores({
      wallets: 'id, type, owner_id, is_archived',
      categories: 'id, type, jar_code, sort_order, is_active',
      transactions: 'id, date, type, wallet_id, to_wallet_id, category_id, member_id, beneficiary, sync_status, is_deleted',
      budgets: 'id, month_year, category_id, [month_year+category_id]',
      presets: 'id, category_id',
    });
  }
}

export const db = new FamilyFinanceDB();

export const DEFAULT_WALLETS: Wallet[] = [
  {
    id: 'w_shared_bank',
    name: 'TK Chung Gia Đình',
    type: 'BANK',
    initial_balance: 25_000_000,
    owner_id: 'FAMILY',
    icon: '🏦',
    color: '#10b981',
    is_archived: false,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'w_wife_cash',
    name: 'Ví Tiền Mặt (Vợ)',
    type: 'CASH',
    initial_balance: 3_000_000,
    owner_id: 'WIFE',
    icon: '👛',
    color: '#ec4899',
    is_archived: false,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'w_husband_bank',
    name: 'Ví Điện Tử / Thẻ (Chồng)',
    type: 'EWALLET',
    initial_balance: 5_000_000,
    owner_id: 'HUSBAND',
    icon: '💳',
    color: '#3b82f6',
    is_archived: false,
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_CATEGORIES: Category[] = [
  // EXPENSE CATEGORIES
  { id: 'cat_groceries', name: 'Đi chợ / Siêu thị', type: 'EXPENSE', jar_code: 'NEC', icon: '🛒', color: '#10b981', sort_order: 1, is_active: true },
  { id: 'cat_food', name: 'Ăn sáng / Cà phê', type: 'EXPENSE', jar_code: 'NEC', icon: '🍜', color: '#f97316', sort_order: 2, is_active: true },
  { id: 'cat_kids', name: 'Con cái (Sữa/Học)', type: 'EXPENSE', jar_code: 'EDUC', icon: '👶🏻', color: '#f59e0b', sort_order: 3, is_active: true },
  { id: 'cat_bills', name: 'Điện / Nước / Net', type: 'EXPENSE', jar_code: 'NEC', icon: '⚡', color: '#eab308', sort_order: 4, is_active: true },
  { id: 'cat_transport', name: 'Xăng xe / Đi lại', type: 'EXPENSE', jar_code: 'NEC', icon: '🛵', color: '#3b82f6', sort_order: 5, is_active: true },
  { id: 'cat_shopping', name: 'Mua sắm / Đồ gia dụng', type: 'EXPENSE', jar_code: 'PLAY', icon: '🛍️', color: '#a855f7', sort_order: 6, is_active: true },
  { id: 'cat_health', name: 'Y tế / Thuốc men', type: 'EXPENSE', jar_code: 'NEC', icon: '💊', color: '#ef4444', sort_order: 7, is_active: true },
  { id: 'cat_gift', name: 'Biếu tặng / Hiếu hỉ', type: 'EXPENSE', jar_code: 'GIVE', icon: '🧧', color: '#ec4899', sort_order: 8, is_active: true },
  { id: 'cat_entertainment', name: 'Giải trí / Ăn ngoài', type: 'EXPENSE', jar_code: 'PLAY', icon: '🍕', color: '#8b5cf6', sort_order: 9, is_active: true },
  { id: 'cat_invest', name: 'Tiết kiệm / Đầu tư', type: 'EXPENSE', jar_code: 'FFA', icon: '💎', color: '#06b6d4', sort_order: 10, is_active: true },
  // INCOME CATEGORIES
  { id: 'cat_salary_husband', name: 'Lương Chồng', type: 'INCOME', jar_code: 'NEC', icon: '💰', color: '#10b981', sort_order: 11, is_active: true },
  { id: 'cat_salary_wife', name: 'Lương Vợ', type: 'INCOME', jar_code: 'NEC', icon: '💵', color: '#10b981', sort_order: 12, is_active: true },
  { id: 'cat_bonus', name: 'Thưởng / Thu nhập phụ', type: 'INCOME', jar_code: 'FFA', icon: '🎉', color: '#f59e0b', sort_order: 13, is_active: true },
];

export const DEFAULT_PRESETS: QuickPreset[] = [
  { id: 'pre_1', title: 'Ăn sáng', amount: 40_000, category_id: 'cat_food', wallet_id: 'w_wife_cash', beneficiary: 'FAMILY', icon: '🍜' },
  { id: 'pre_2', title: 'Cà phê', amount: 25_000, category_id: 'cat_food', wallet_id: 'w_husband_bank', beneficiary: 'HUSBAND', icon: '☕' },
  { id: 'pre_3', title: 'Đi chợ ngày', amount: 150_000, category_id: 'cat_groceries', wallet_id: 'w_wife_cash', beneficiary: 'FAMILY', icon: '🥬' },
  { id: 'pre_4', title: 'Đổ xăng', amount: 70_000, category_id: 'cat_transport', wallet_id: 'w_husband_bank', beneficiary: 'HUSBAND', icon: '⛽' },
  { id: 'pre_5', title: 'Gửi xe', amount: 10_000, category_id: 'cat_transport', wallet_id: 'w_wife_cash', beneficiary: 'FAMILY', icon: '🛵' },
];

export async function initializeDatabase() {
  const walletCount = await db.wallets.count();
  if (walletCount > 0) return;

  const today = getTodayLocalISO();
  const currentMonth = getCurrentMonthYear();
  const nowISO = new Date().toISOString();

  await db.transaction('rw', [db.wallets, db.categories, db.presets, db.budgets, db.transactions], async () => {
    await db.wallets.bulkPut(DEFAULT_WALLETS);
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    await db.presets.bulkPut(DEFAULT_PRESETS);

    const sampleBudgets: Budget[] = [
      { id: 'b_groceries', month_year: currentMonth, category_id: 'cat_groceries', amount_limit: 6_000_000, alert_threshold: 80, updated_at: nowISO },
      { id: 'b_food', month_year: currentMonth, category_id: 'cat_food', amount_limit: 2_500_000, alert_threshold: 80, updated_at: nowISO },
      { id: 'b_kids', month_year: currentMonth, category_id: 'cat_kids', amount_limit: 5_000_000, alert_threshold: 85, updated_at: nowISO },
      { id: 'b_bills', month_year: currentMonth, category_id: 'cat_bills', amount_limit: 2_200_000, alert_threshold: 90, updated_at: nowISO },
      { id: 'b_entertainment', month_year: currentMonth, category_id: 'cat_entertainment', amount_limit: 2_000_000, alert_threshold: 80, updated_at: nowISO },
    ];
    await db.budgets.bulkPut(sampleBudgets);

    const sampleTransactions: Transaction[] = [
      {
        id: 'tx_sample_1',
        date: today,
        type: 'INCOME',
        amount: 20_000_000,
        wallet_id: 'w_shared_bank',
        category_id: 'cat_salary_husband',
        member_id: 'HUSBAND',
        beneficiary: 'FAMILY',
        is_shared: true,
        note: 'Góp quỹ lương tháng này',
        is_deleted: false,
        sync_status: 'PENDING',
        created_at: nowISO,
        updated_at: nowISO,
      },
      {
        id: 'tx_sample_2',
        date: today,
        type: 'EXPENSE',
        amount: 285_000,
        wallet_id: 'w_wife_cash',
        category_id: 'cat_groceries',
        member_id: 'WIFE',
        beneficiary: 'FAMILY',
        is_shared: true,
        note: 'Mua thịt cá, rau củ WinMart',
        is_deleted: false,
        sync_status: 'PENDING',
        created_at: nowISO,
        updated_at: nowISO,
      },
      {
        id: 'tx_sample_3',
        date: today,
        type: 'EXPENSE',
        amount: 680_000,
        wallet_id: 'w_shared_bank',
        category_id: 'cat_kids',
        member_id: 'WIFE',
        beneficiary: 'KIDS',
        is_shared: true,
        note: 'Mua sữa bột và bỉm cho bé',
        is_deleted: false,
        sync_status: 'PENDING',
        created_at: nowISO,
        updated_at: nowISO,
      },
      {
        id: 'tx_sample_4',
        date: today,
        type: 'EXPENSE',
        amount: 45_000,
        wallet_id: 'w_husband_bank',
        category_id: 'cat_food',
        member_id: 'HUSBAND',
        beneficiary: 'HUSBAND',
        is_shared: false,
        note: 'Phở bò buổi sáng',
        is_deleted: false,
        sync_status: 'PENDING',
        created_at: nowISO,
        updated_at: nowISO,
      },
    ];
    await db.transactions.bulkPut(sampleTransactions);
  });
}
