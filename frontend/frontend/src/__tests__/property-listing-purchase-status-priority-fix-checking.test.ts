/**
 * 修正確認テスト
 *
 * 修正後の getPurchaseStatusText 関数が正しく動作することを確認する。
 *
 * Validates: Requirements 2.1, 2.2
 */

import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';

describe('修正確認テスト: 更新日時比較ロジック', () => {
  describe('offer_status_updated_at > latest_status_updated_at の場合', () => {
    it('offer_status を返す', () => {
      const result = getPurchaseStatusText(
        '買付外れました',
        '一般他決',
        '2025-06-01T00:00:00.000Z', // latest_status: 古い
        '2025-06-10T00:00:00.000Z'  // offer_status: 新しい
      );
      expect(result).toBe('一般他決');
    });

    it('時刻が1秒だけ新しい場合も offer_status を返す', () => {
      const result = getPurchaseStatusText(
        '買付申込',
        '一般他決',
        '2025-06-10T12:00:00.000Z',
        '2025-06-10T12:00:01.000Z'
      );
      expect(result).toBe('一般他決');
    });
  });

  describe('latest_status_updated_at > offer_status_updated_at の場合', () => {
    it('latest_status を返す', () => {
      const result = getPurchaseStatusText(
        '買付外れました',
        '一般他決',
        '2025-06-10T00:00:00.000Z', // latest_status: 新しい
        '2025-06-01T00:00:00.000Z'  // offer_status: 古い
      );
      expect(result).toBe('買付外れました');
    });

    it('時刻が1秒だけ新しい場合も latest_status を返す', () => {
      const result = getPurchaseStatusText(
        '買付申込',
        '一般他決',
        '2025-06-10T12:00:01.000Z',
        '2025-06-10T12:00:00.000Z'
      );
      expect(result).toBe('買付申込');
    });
  });

  describe('タイムスタンプなしの場合', () => {
    it('両方のタイムスタンプが undefined の場合は offer_status を優先する', () => {
      const result = getPurchaseStatusText('買付外れました', '一般他決');
      expect(result).toBe('一般他決');
    });

    it('両方のタイムスタンプが null の場合は offer_status を優先する', () => {
      const result = getPurchaseStatusText('買付外れました', '一般他決', null, null);
      expect(result).toBe('一般他決');
    });

    it('latest_status_updated_at のみ null の場合は offer_status を優先する', () => {
      const result = getPurchaseStatusText(
        '買付外れました',
        '一般他決',
        null,
        '2025-06-10T00:00:00.000Z'
      );
      expect(result).toBe('一般他決');
    });

    it('offer_status_updated_at のみ null の場合は offer_status を優先する', () => {
      const result = getPurchaseStatusText(
        '買付外れました',
        '一般他決',
        '2025-06-10T00:00:00.000Z',
        null
      );
      expect(result).toBe('一般他決');
    });
  });
});
