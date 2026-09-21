import { isJapaneseHoliday, isJapaneseHolidayDateStr } from '../japaneseHolidays';

const d = (s: string) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
};

describe('isJapaneseHoliday - 祝日法上の祝日', () => {
  test('元日 (2026-01-01) は祝日', () => {
    expect(isJapaneseHoliday(d('2026-01-01'))).toBe(true);
  });
  test('成人の日 (2026-01-12 第2月曜) は祝日', () => {
    expect(isJapaneseHoliday(d('2026-01-12'))).toBe(true);
  });
  test('春分の日 (2026-03-20) は祝日', () => {
    expect(isJapaneseHoliday(d('2026-03-20'))).toBe(true);
  });
  test('敬老の日 (2026-09-21 第3月曜) は祝日', () => {
    expect(isJapaneseHoliday(d('2026-09-21'))).toBe(true);
  });
  test('秋分の日 (2026-09-23) は祝日', () => {
    expect(isJapaneseHoliday(d('2026-09-23'))).toBe(true);
  });
  test('平日 (2026-09-24) は祝日ではない', () => {
    expect(isJapaneseHoliday(d('2026-09-24'))).toBe(false);
  });
});

describe('isJapaneseHoliday - 国民の休日', () => {
  test('2026-09-22 は敬老の日(9/21)と秋分の日(9/23)に挟まれた国民の休日', () => {
    expect(isJapaneseHoliday(d('2026-09-22'))).toBe(true);
  });
  test('2015-09-22 も国民の休日（シルバーウィーク）', () => {
    expect(isJapaneseHoliday(d('2015-09-22'))).toBe(true);
  });
});

describe('isJapaneseHoliday - 振替休日', () => {
  // 2025-11-03 (文化の日) は月曜なので振替なし。日曜の祝日ケースを検証する。
  // 2025-02-23 (天皇誕生日) は日曜 → 2025-02-24(月) が振替休日
  test('2025-02-23 (天皇誕生日) は日曜で祝日', () => {
    expect(d('2025-02-23').getDay()).toBe(0);
    expect(isJapaneseHoliday(d('2025-02-23'))).toBe(true);
  });
  test('2025-02-24 (月) は振替休日', () => {
    expect(isJapaneseHoliday(d('2025-02-24'))).toBe(true);
  });
  // 2026-05-03 (憲法記念日) は日曜 → 2026-05-06(水) が振替休日
  // 5/3(日,憲法) 5/4(月,みどり) 5/5(火,こども) と連続 → 振替は 5/6
  test('2026-05-03 は日曜', () => {
    expect(d('2026-05-03').getDay()).toBe(0);
  });
  test('2026-05-06 は連続祝日後の振替休日', () => {
    expect(isJapaneseHoliday(d('2026-05-06'))).toBe(true);
  });
  test('通常の平日 (2025-02-25 火) は祝日ではない', () => {
    expect(isJapaneseHoliday(d('2025-02-25'))).toBe(false);
  });
});

describe('isJapaneseHolidayDateStr', () => {
  test('"2026-09-22" は国民の休日として true', () => {
    expect(isJapaneseHolidayDateStr('2026-09-22')).toBe(true);
  });
  test('時刻付き "2026-09-24T10:00" の平日は false', () => {
    expect(isJapaneseHolidayDateStr('2026-09-24T10:00')).toBe(false);
  });
  test('空文字は false', () => {
    expect(isJapaneseHolidayDateStr('')).toBe(false);
  });
});
