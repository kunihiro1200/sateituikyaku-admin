/**
 * 共有ページ新規作成フォーム ユーティリティ関数のテスト
 * Feature: shared-page-new-entry
 */
import { calculateNextId, toggleStaff, validateUrl } from '../utils/sharedItemFormUtils';

// ============================================================
// calculateNextId
// ============================================================
describe('calculateNextId', () => {
  test('エントリーが空の場合は1を返す', () => {
    expect(calculateNextId([])).toBe(1);
  });

  test('最大IDに1を加算した値を返す', () => {
    const entries = [{ id: '1' }, { id: '3' }, { id: '2' }];
    expect(calculateNextId(entries)).toBe(4);
  });

  test('IDが1件の場合は+1を返す', () => {
    expect(calculateNextId([{ id: '5' }])).toBe(6);
  });

  test('数値IDも正しく処理する', () => {
    const entries = [{ id: 10 }, { id: 20 }, { id: 15 }];
    expect(calculateNextId(entries)).toBe(21);
  });

  test('数値でないIDは0として扱う', () => {
    const entries = [{ id: 'abc' }, { id: '3' }];
    expect(calculateNextId(entries)).toBe(4);
  });
});

// ============================================================
// toggleStaff
// ============================================================
describe('toggleStaff', () => {
  test('未選択のスタッフを追加する', () => {
    const result = toggleStaff([], '田中');
    expect(result).toContain('田中');
    expect(result).toHaveLength(1);
  });

  test('選択済みのスタッフを除外する', () => {
    const result = toggleStaff(['田中', '鈴木'], '田中');
    expect(result).not.toContain('田中');
    expect(result).toContain('鈴木');
  });

  test('2回クリックすると元の状態に戻る（ラウンドトリップ）', () => {
    const initial: string[] = [];
    const after1 = toggleStaff(initial, '田中');
    const after2 = toggleStaff(after1, '田中');
    expect(after2).toHaveLength(0);
    expect(after2).not.toContain('田中');
  });

  test('複数スタッフを独立して選択できる', () => {
    let selected: string[] = [];
    selected = toggleStaff(selected, '田中');
    selected = toggleStaff(selected, '鈴木');
    selected = toggleStaff(selected, '佐藤');
    expect(selected).toContain('田中');
    expect(selected).toContain('鈴木');
    expect(selected).toContain('佐藤');
    expect(selected).toHaveLength(3);
  });

  test('元の配列を変更しない（イミュータブル）', () => {
    const original = ['田中'];
    toggleStaff(original, '鈴木');
    expect(original).toHaveLength(1);
  });
});

// ============================================================
// validateUrl
// ============================================================
describe('validateUrl', () => {
  test('空文字列は有効（任意フィールド）', () => {
    expect(validateUrl('')).toEqual({ isValid: true });
  });

  test('http:// で始まるURLは有効', () => {
    expect(validateUrl('http://example.com')).toEqual({ isValid: true });
  });

  test('https:// で始まるURLは有効', () => {
    expect(validateUrl('https://example.com/path?q=1')).toEqual({ isValid: true });
  });

  test('http:// でも https:// でもない文字列は無効', () => {
    const result = validateUrl('example.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('ftp:// で始まる文字列は無効', () => {
    expect(validateUrl('ftp://example.com').isValid).toBe(false);
  });

  test('ランダムな文字列は無効', () => {
    expect(validateUrl('not-a-url').isValid).toBe(false);
  });
});
