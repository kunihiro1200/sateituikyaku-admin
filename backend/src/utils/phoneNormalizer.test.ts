import { normalizePhoneNumber } from './phoneNormalizer';

describe('normalizePhoneNumber', () => {
  test('空文字はそのまま返す', () => {
    expect(normalizePhoneNumber('')).toBe('');
  });

  test('null はそのまま返す', () => {
    expect(normalizePhoneNumber(null)).toBeNull();
  });

  test('undefined はそのまま返す', () => {
    expect(normalizePhoneNumber(undefined)).toBeUndefined();
  });

  test('先頭「0」ありの電話番号はそのまま返す', () => {
    expect(normalizePhoneNumber('090-1234-5678')).toBe('090-1234-5678');
  });

  test('先頭「0」なしの電話番号は「0」を付加して返す', () => {
    expect(normalizePhoneNumber('90-1234-5678')).toBe('090-1234-5678');
  });

  test('ハイフンありの先頭「0」なし電話番号は「0」を付加して返す', () => {
    expect(normalizePhoneNumber('90-1234-5678')).toBe('090-1234-5678');
  });

  test('括弧ありの先頭「0」なし電話番号は「0」を付加して返す', () => {
    expect(normalizePhoneNumber('(90)1234-5678')).toBe('0(90)1234-5678');
  });

  test('「0」のみの文字列はそのまま返す', () => {
    expect(normalizePhoneNumber('0')).toBe('0');
  });

  test('数字のみの先頭「0」なし文字列は「0」を付加して返す', () => {
    expect(normalizePhoneNumber('9012345678')).toBe('09012345678');
  });
});
