/**
 * 価格変更履歴ユーティリティのテスト
 * Feature: price-change-history-auto-input
 */
import { toMan, generatePriceHistoryEntry, buildUpdatedHistory } from '../utils/priceHistoryUtils';

describe('toMan', () => {
  test('基本ケース: 18,500,000円 → 1850万', () => {
    expect(toMan(18500000)).toBe(1850);
  });

  test('基本ケース: 13,500,000円 → 1350万', () => {
    expect(toMan(13500000)).toBe(1350);
  });

  test('切り捨て: 10,001円 → 1万（四捨五入しない）', () => {
    expect(toMan(10001)).toBe(1);
  });

  test('9,999円以下 → 0万（要件3.2）', () => {
    expect(toMan(9999)).toBe(0);
    expect(toMan(0)).toBe(0);
  });

  test('ちょうど1万円 → 1万', () => {
    expect(toMan(10000)).toBe(1);
  });

  test('整数を返す', () => {
    expect(Number.isInteger(toMan(12345678))).toBe(true);
  });
});

describe('generatePriceHistoryEntry', () => {
  test('基本ケース: K3/17　1850万→1350万', () => {
    const entry = generatePriceHistoryEntry(18500000, 13500000, 'K', '3/17');
    expect(entry).toBe('K3/17　1850万→1350万');
  });

  test('イニシャルなし（要件1.4）: 3/17　1850万→1350万', () => {
    const entry = generatePriceHistoryEntry(18500000, 13500000, '', '3/17');
    expect(entry).toBe('3/17　1850万→1350万');
  });

  test('null → 有価格（要件1.6）: 変更前を0万として記録', () => {
    const entry = generatePriceHistoryEntry(null, 13500000, 'K', '3/17');
    expect(entry).toBe('K3/17　0万→1350万');
  });

  test('undefined → 有価格: 変更前を0万として記録', () => {
    const entry = generatePriceHistoryEntry(undefined, 13500000, 'Y', '12/1');
    expect(entry).toBe('Y12/1　0万→1350万');
  });

  test('フォーマット: 全角スペース区切り', () => {
    const entry = generatePriceHistoryEntry(10000000, 8000000, 'A', '1/1');
    expect(entry).toContain('　'); // 全角スペース
    expect(entry).toBe('A1/1　1000万→800万');
  });
});

describe('buildUpdatedHistory', () => {
  const dateStr = '3/17';

  test('基本ケース: 既存履歴なし → エントリのみ', () => {
    const result = buildUpdatedHistory(18500000, 13500000, 'K', '', dateStr);
    expect(result).toBe('K3/17　1850万→1350万');
  });

  test('既存履歴あり: 先頭に新エントリが追加される', () => {
    const existing = 'Y2/1　2000万→1850万';
    const result = buildUpdatedHistory(18500000, 13500000, 'K', existing, dateStr);
    expect(result).toBe('K3/17　1850万→1350万\nY2/1　2000万→1850万');
  });

  test('既存履歴が複数行: 全て保持される（要件5.3）', () => {
    const existing = 'Y2/1　2000万→1850万\nK1/15　2200万→2000万';
    const result = buildUpdatedHistory(18500000, 13500000, 'K', existing, dateStr);
    const lines = result.split('\n');
    expect(lines[0]).toBe('K3/17　1850万→1350万');
    expect(lines[1]).toBe('Y2/1　2000万→1850万');
    expect(lines[2]).toBe('K1/15　2200万→2000万');
  });

  test('価格未変更: 履歴が変化しない（要件1.5）', () => {
    const existing = 'Y2/1　2000万→1850万';
    const result = buildUpdatedHistory(18500000, 18500000, 'K', existing, dateStr);
    expect(result).toBe(existing);
  });

  test('有価格 → null: 追記しない（要件1.7）', () => {
    const existing = 'Y2/1　2000万→1850万';
    const result = buildUpdatedHistory(18500000, null, 'K', existing, dateStr);
    expect(result).toBe(existing);
  });

  test('有価格 → undefined: 追記しない', () => {
    const existing = 'Y2/1　2000万→1850万';
    const result = buildUpdatedHistory(18500000, undefined, 'K', existing, dateStr);
    expect(result).toBe(existing);
  });

  test('null → 有価格（要件1.6）: 0万として記録', () => {
    const result = buildUpdatedHistory(null, 13500000, 'K', '', dateStr);
    expect(result).toBe('K3/17　0万→1350万');
  });

  test('イニシャルなし（要件1.4）', () => {
    const result = buildUpdatedHistory(18500000, 13500000, '', '', dateStr);
    expect(result).toBe('3/17　1850万→1350万');
  });
});
