export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type WalletType = 'CASH' | 'BANK' | 'EWALLET' | 'CREDIT';
export type JarCode = 'NEC' | 'FFA' | 'EDUC' | 'LTSS' | 'PLAY' | 'GIVE';
export type MemberId = 'HUSBAND' | 'WIFE' | 'FAMILY';
export type BeneficiaryId = 'FAMILY' | 'KIDS' | 'HUSBAND' | 'WIFE' | 'PARENTS';
export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

export interface Member {
  id: MemberId;
  name: string;
  avatar: string;
  color: string;
}

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  initial_balance: number; // Integer VND
  owner_id: MemberId;
  icon: string;
  color: string;
  is_archived: boolean;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  jar_code: JarCode;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  date: string; // Strictly YYYY-MM-DD (Local Time)
  type: TransactionType;
  amount: number; // Strictly positive Integer VND
  wallet_id: string;
  to_wallet_id?: string; // Only for TRANSFER
  category_id: string; // 'TRANSFER' if type === 'TRANSFER'
  member_id: MemberId; // Who paid
  beneficiary: BeneficiaryId; // Who benefited (Gia đình / Con cái / Chồng / Vợ / Nội Ngoại)
  is_shared: boolean; // Quỹ chung Gia đình (true) vs Chi tiêu Riêng (false)
  note: string;
  is_deleted: boolean;
  sync_status: SyncStatus;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface Budget {
  id: string;
  month_year: string; // YYYY-MM
  category_id: string; // Category ID or 'ALL' or JarCode
  amount_limit: number; // Integer VND
  alert_threshold: number; // Default 80 (%)
  updated_at: string;
}

export interface QuickPreset {
  id: string;
  title: string;
  amount: number;
  category_id: string;
  wallet_id: string;
  beneficiary: BeneficiaryId;
  icon: string;
}
