import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Định dạng tiền tệ chuẩn Việt Nam (Số nguyên -> "50.000 ₫")
 * Tuyệt đối tránh lỗi dấu phẩy động IEEE 754 bằng Math.round()
 */
export function formatVND(amount: number, showSymbol = true): string {
  const safeInt = Math.round(amount || 0);
  const formatted = new Intl.NumberFormat('vi-VN').format(safeInt);
  return showSymbol ? `${formatted} ₫` : formatted;
}

/**
 * Định dạng rút gọn cho biểu đồ (VD: 1.500.000 -> "1.5tr", 45.000 -> "45k")
 */
export function formatCompactVND(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1);
    return `${sign}${val}tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${abs}`;
}

/**
 * Lấy ngày hiện tại theo đúng Local Time của thiết bị (YYYY-MM-DD)
 * Tránh cạm bẫy toISOString() bị lùi ngày lúc 0h-7h sáng GMT+7
 */
export function getTodayLocalISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Lấy chuỗi tháng hiện tại (YYYY-MM)
 */
export function getCurrentMonthYear(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Hiển thị ngày thân thiện bằng Tiếng Việt ("Hôm nay", "Hôm qua", "Thứ Ba, 10/11")
 */
export function formatFriendlyDate(dateStr: string): string {
  const today = getTodayLocalISO();
  if (dateStr === today) return 'Hôm nay';

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = format(yesterdayDate, 'yyyy-MM-dd');
  if (dateStr === yesterday) return 'Hôm qua';

  try {
    const parsed = parseISO(dateStr);
    return format(parsed, 'EEEE, dd/MM/yyyy', { locale: vi });
  } catch {
    return dateStr;
  }
}

/**
 * Tạo ID duy nhất sắp xếp được theo thời gian (Time-sortable ULID-like)
 * Đảm bảo 2 vợ chồng nhập offline cùng lúc không bao giờ trùng ID
 */
export function generateId(prefix = 'tx'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Tính khoảng ngày của kỳ tài chính (Hỗ trợ ngày chốt sổ tuỳ chỉnh, VD: nhận lương ngày 25)
 */
export function getFiscalMonthRange(monthYear: string, startDay = 1): { start: string; end: string } {
  const [year, month] = monthYear.split('-').map(Number);
  if (startDay === 1) {
    const base = new Date(year, month - 1, 1);
    return {
      start: format(startOfMonth(base), 'yyyy-MM-dd'),
      end: format(endOfMonth(base), 'yyyy-MM-dd'),
    };
  }
  const startDate = new Date(year, month - 2, startDay);
  const endDate = new Date(year, month - 1, startDay - 1);
  return {
    start: format(startDate, 'yyyy-MM-dd'),
    end: format(endDate, 'yyyy-MM-dd'),
  };
}
