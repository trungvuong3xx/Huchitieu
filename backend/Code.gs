/**
 * ============================================================================
 * HŨ CHI TIÊU GIA ĐÌNH - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * Cách cài đặt (Chỉ mất 2 phút):
 * 1. Tạo 1 file Google Sheets mới trên Google Drive của gia đình.
 * 2. Trên thanh menu của Google Sheets, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết mã mặc định, dán toàn bộ nội dung file Code.gs này vào và bấm Lưu (Ctrl+S).
 * 4. Chọn hàm `setupFamilySheets` trên thanh công cụ và bấm nút "Chạy (Run)" 1 lần đầu
 *    để Script tự động tạo đủ 4 Tabs (Transactions, Wallets, Categories, Budgets) kèm tiêu đề cột chuẩn!
 * 5. Bấm nút "Triển khai (Deploy)" ở góc trên bên phải -> "Tùy chọn triển khai mới (New deployment)":
 *    - Loại (Select type): Ứng dụng web (Web app)
 *    - Thực thi dưới dạng (Execute as): Tôi (Me)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 6. Copy đường dẫn "Web App URL" (có đuôi /exec) dán vào mục Cài Đặt trên Web App của 2 vợ chồng!
 * ============================================================================
 */

const SHEET_SCHEMA = {
  Transactions: [
    'id',
    'date',
    'type',
    'amount',
    'wallet_id',
    'to_wallet_id',
    'category_id',
    'member_id',
    'beneficiary',
    'is_shared',
    'note',
    'is_deleted',
    'created_at',
    'updated_at',
  ],
  Wallets: [
    'id',
    'name',
    'type',
    'initial_balance',
    'owner_id',
    'icon',
    'color',
    'is_archived',
    'updated_at',
  ],
  Categories: [
    'id',
    'name',
    'type',
    'jar_code',
    'icon',
    'color',
    'sort_order',
    'is_active',
  ],
  Budgets: [
    'id',
    'month_year',
    'category_id',
    'amount_limit',
    'alert_threshold',
    'updated_at',
  ],
};

/**
 * Hàm chạy 1 lần đầu để tự động tạo 4 Sheet và định dạng Header đẹp mắt
 */
function setupFamilySheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SHEET_SCHEMA).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = SHEET_SCHEMA[sheetName];
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmptyHeader = firstRow.every(function (cell) {
      return !cell;
    });

    if (isEmptyHeader) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#10b981');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Định dạng cột date / month_year là Plain Text (@) để Google Sheets không tự ý đảo ngày/tháng
    const dateColIdx = headers.indexOf('date');
    if (dateColIdx !== -1) {
      sheet.getRange(2, dateColIdx + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
    }
    const monthColIdx = headers.indexOf('month_year');
    if (monthColIdx !== -1) {
      sheet.getRange(2, monthColIdx + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
    }
  });
}

/**
 * API Kiểm tra kết nối (GET)
 */
function doGet() {
  setupFamilySheets();
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'ok',
      app: 'HuChiTieuGiaDinh_GoogleSheets_Bridge',
      timestamp: new Date().toISOString(),
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * API Đồng bộ 2 chiều (POST) với cơ chế LockService chống xung đột khi Vợ & Chồng nhập cùng lúc
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Đợi tối đa 15 giây nếu người kia đang ghi vào Sheet
    lock.waitLock(15000);

    setupFamilySheets();

    const body = JSON.parse(e.postData.contents || '{}');
    const incoming = body.data || {};
    const lastSyncTime = body.lastSyncTime ? new Date(body.lastSyncTime) : null;

    // 1. Upsert (Cập nhật hoặc Thêm mới) dữ liệu từ điện thoại gửi lên
    if (incoming.transactions && incoming.transactions.length > 0) {
      upsertRows('Transactions', incoming.transactions);
    }
    if (incoming.wallets && incoming.wallets.length > 0) {
      upsertRows('Wallets', incoming.wallets);
    }
    if (incoming.categories && incoming.categories.length > 0) {
      upsertRows('Categories', incoming.categories);
    }
    if (incoming.budgets && incoming.budgets.length > 0) {
      upsertRows('Budgets', incoming.budgets);
    }

    // 2. Đọc dữ liệu từ Sheet trả về cho điện thoại (Lọc theo lastSyncTime nếu có để tối ưu tốc độ)
    const allTransactions = readRows('Transactions', lastSyncTime);
    const allWallets = readRows('Wallets', null);
    const allCategories = readRows('Categories', null);
    const allBudgets = readRows('Budgets', null);

    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'ok',
        syncedAt: new Date().toISOString(),
        data: {
          transactions: allTransactions,
          wallets: allWallets,
          categories: allCategories,
          budgets: allBudgets,
        },
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: err.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hàm Upsert thông minh theo khóa chính `id` và `updated_at` (Last-Write-Wins)
 */
function upsertRows(sheetName, items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();

  // Map vị trí dòng hiện có theo ID (id -> rowIndex 1-based)
  const idToRowMap = {};
  const idToUpdatedAtMap = {};
  const updatedIdx = headers.indexOf('updated_at');

  if (lastRow >= 2) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < existingData.length; i++) {
      const rowId = String(existingData[i][0] || '');
      if (rowId) {
        idToRowMap[rowId] = i + 2;
        if (updatedIdx !== -1) {
          idToUpdatedAtMap[rowId] = existingData[i][updatedIdx];
        }
      }
    }
  }

  const rowsToAppend = [];

  items.forEach(function (item) {
    if (!item || !item.id) return;
    const rowValues = headers.map(function (col) {
      const val = item[col];
      if (val === undefined || val === null) return '';
      // Giữ nguyên định dạng chuỗi YYYY-MM-DD hoặc YYYY-MM bằng dấu nháy đơn
      if ((col === 'date' || col === 'month_year') && typeof val === 'string') {
        return "'" + val;
      }
      return val;
    });

    const existingRowNumber = idToRowMap[item.id];
    if (existingRowNumber) {
      // Chỉ ghi đè nếu bản gửi lên có updated_at mới hơn hoặc bằng bản trên Sheet
      const existingUpdated = idToUpdatedAtMap[item.id];
      const shouldUpdate =
        !existingUpdated ||
        !item.updated_at ||
        new Date(item.updated_at) >= new Date(existingUpdated);

      if (shouldUpdate) {
        sheet.getRange(existingRowNumber, 1, 1, headers.length).setValues([rowValues]);
      }
    } else {
      rowsToAppend.push(rowValues);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  }
}

/**
 * Hàm đọc dữ liệu từ Sheet ra mảng JSON
 */
function readRows(sheetName, sinceDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const results = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue; // Bỏ qua dòng trống

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let cellVal = row[c];
      const colName = headers[c];

      // Nếu Google Sheets lỡ chuyển Date thành đối tượng Date của JS thì ép lại về YYYY-MM-DD
      if ((colName === 'date' || colName === 'month_year') && cellVal instanceof Date) {
        const tz = ss.getSpreadsheetTimeZone() || 'Asia/Ho_Chi_Minh';
        const fmt = colName === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM';
        cellVal = Utilities.formatDate(cellVal, tz, fmt);
      } else if (typeof cellVal === 'string' && cellVal.startsWith("'")) {
        cellVal = cellVal.substring(1);
      }

      obj[colName] = cellVal;
    }

    if (sinceDate && obj.updated_at) {
      if (new Date(obj.updated_at) <= sinceDate) {
        continue;
      }
    }

    results.push(obj);
  }

  return results;
}

/**
 * Hàm Sao lưu tự động hàng tháng (Có thể gắn Time-driven Trigger chạy ngày 1 hàng tháng)
 */
function createMonthlySpreadsheetBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folderName = 'Backup_HuChiTieu_GiaDinh';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const dateStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const backupName = ss.getName() + '_Backup_' + dateStr;
  DriveApp.getFileById(ss.getId()).makeCopy(backupName, folder);
}
