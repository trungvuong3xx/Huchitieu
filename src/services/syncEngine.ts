import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import type { Transaction, Wallet, Category, Budget } from '../types';

/**
 * SyncEngine: Đồng bộ 2 chiều (Outbox Queue + Last-Write-Wins) giữa IndexedDB & Google Sheets
 * - Không bao giờ làm chậm UI (chạy ngầm hoàn toàn)
 * - Tự động gom các bản ghi có sync_status === 'PENDING' để đẩy lên Google Sheets
 * - Khi kéo dữ liệu từ Google Sheets về, so sánh updated_at để giữ bản mới nhất
 */
export async function syncWithGoogleSheets(forceFullSync = false): Promise<{
  success: boolean;
  pushed: number;
  pulled: number;
  message: string;
}> {
  const store = useAppStore.getState();
  const scriptUrl = store.scriptUrl;

  if (!scriptUrl) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      message: 'Chưa cấu hình URL Google Apps Script (Đang chạy chế độ Local Offline).',
    };
  }

  if (store.isSyncing) {
    return { success: false, pushed: 0, pulled: 0, message: 'Đang đồng bộ...' };
  }

  store.setIsSyncing(true);

  try {
    // 1. Lấy các giao dịch đang chờ đồng bộ (PENDING) hoặc toàn bộ nếu forceFullSync
    const pendingTransactions = forceFullSync
      ? await db.transactions.toArray()
      : await db.transactions.where('sync_status').equals('PENDING').toArray();

    const wallets = await db.wallets.toArray();
    const categories = await db.categories.toArray();
    const budgets = await db.budgets.toArray();

    // 2. Gửi POST request lên Google Apps Script Web App
    // Lưu ý: Dùng Content-Type text/plain để tránh lỗi CORS Preflight (OPTIONS) của Google Apps Script
    const payload = {
      action: 'SYNC_ALL',
      lastSyncTime: forceFullSync ? null : store.lastSyncTime,
      data: {
        transactions: pendingTransactions,
        wallets: forceFullSync ? wallets : [],
        categories: forceFullSync ? categories : [],
        budgets,
      },
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.status !== 'ok') {
      throw new Error(result?.message || 'Phản hồi từ Google Sheets không hợp lệ');
    }

    let pulledCount = 0;

    // 3. Đánh dấu các giao dịch đã đẩy lên là SYNCED
    await db.transaction('rw', [db.transactions, db.wallets, db.categories, db.budgets], async () => {
      for (const tx of pendingTransactions) {
        await db.transactions.update(tx.id, { sync_status: 'SYNCED' });
      }

      // 4. Hợp nhất (Merge) các giao dịch từ máy của Vợ/Chồng trên Google Sheets về máy này
      const remoteTransactions: Transaction[] = result.data?.transactions || [];
      for (const remoteTx of remoteTransactions) {
        if (!remoteTx || !remoteTx.id) continue;
        const localTx = await db.transactions.get(remoteTx.id);
        // Chỉ ghi đè nếu chưa có dưới máy hoặc bản trên Sheet mới hơn
        if (!localTx || new Date(remoteTx.updated_at) > new Date(localTx.updated_at)) {
          await db.transactions.put({
            ...remoteTx,
            amount: Number(remoteTx.amount) || 0,
            is_shared: Boolean(remoteTx.is_shared),
            is_deleted: Boolean(remoteTx.is_deleted),
            sync_status: 'SYNCED',
          });
          pulledCount++;
        }
      }

      // Merge Wallets nếu có
      const remoteWallets: Wallet[] = result.data?.wallets || [];
      for (const rw of remoteWallets) {
        if (!rw?.id) continue;
        const localW = await db.wallets.get(rw.id);
        if (!localW || new Date(rw.updated_at) > new Date(localW.updated_at)) {
          await db.wallets.put({
            ...rw,
            initial_balance: Number(rw.initial_balance) || 0,
            is_archived: Boolean(rw.is_archived),
          });
        }
      }

      // Merge Categories nếu có
      const remoteCategories: Category[] = result.data?.categories || [];
      for (const rc of remoteCategories) {
        if (!rc?.id) continue;
        const localC = await db.categories.get(rc.id);
        if (!localC) {
          await db.categories.put({
            ...rc,
            sort_order: Number(rc.sort_order) || 1,
            is_active: Boolean(rc.is_active),
          });
        }
      }

      // Merge Budgets nếu có
      const remoteBudgets: Budget[] = result.data?.budgets || [];
      for (const rb of remoteBudgets) {
        if (!rb?.id) continue;
        const localB = await db.budgets.get(rb.id);
        if (!localB || new Date(rb.updated_at) > new Date(localB.updated_at)) {
          await db.budgets.put({
            ...rb,
            amount_limit: Number(rb.amount_limit) || 0,
            alert_threshold: Number(rb.alert_threshold) || 80,
          });
        }
      }
    });

    const nowISO = new Date().toISOString();
    store.setLastSyncTime(nowISO);

    return {
      success: true,
      pushed: pendingTransactions.length,
      pulled: pulledCount,
      message: `Đã đồng bộ thành công (${pendingTransactions.length} gửi lên, ${pulledCount} tải về)`,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Lỗi kết nối Google Sheets';
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      message: `Lỗi đồng bộ: ${errMsg}`,
    };
  } finally {
    store.setIsSyncing(false);
  }
}

/**
 * Xuất toàn bộ Database ra file JSON (Lớp bảo vệ Backup thứ 3)
 */
export async function exportBackupJSON(): Promise<string> {
  const [wallets, categories, transactions, budgets, presets] = await Promise.all([
    db.wallets.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.presets.toArray(),
  ]);

  const backupPayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    app: 'HuChiTieuGiaDinh',
    data: { wallets, categories, transactions, budgets, presets },
  };

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Phục hồi dữ liệu từ file JSON Backup
 */
export async function importBackupJSON(jsonString: string): Promise<void> {
  const parsed = JSON.parse(jsonString);
  if (!parsed?.data?.transactions || !parsed?.data?.wallets) {
    throw new Error('File Backup không đúng định dạng Hũ Chi Tiêu Gia Đình!');
  }

  await db.transaction('rw', [db.wallets, db.categories, db.transactions, db.budgets, db.presets], async () => {
    await db.wallets.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.budgets.clear();
    await db.presets.clear();

    if (parsed.data.wallets?.length) await db.wallets.bulkPut(parsed.data.wallets);
    if (parsed.data.categories?.length) await db.categories.bulkPut(parsed.data.categories);
    if (parsed.data.transactions?.length) await db.transactions.bulkPut(parsed.data.transactions);
    if (parsed.data.budgets?.length) await db.budgets.bulkPut(parsed.data.budgets);
    if (parsed.data.presets?.length) await db.presets.bulkPut(parsed.data.presets);
  });
}
