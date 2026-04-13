/**
 * バグ条件探索テスト
 *
 * このテストは修正前の動作（バグ）を記録し、修正後の正しい動作を確認するものです。
 *
 * バグの内容:
 *   offer_status の更新日時が latest_status の更新日時より新しい場合でも、
 *   修正前の getPurchaseStatusText は常に latest_status（「買」を含む）を優先して返していた。
 *
 * 修正後の期待動作:
 *   更新日時が新しい方のステータスを返す。
 */

import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';

describe('バグ条件探索テスト: 買付ステータス優先順位', () => {
  /**
   * バグシナリオ: 物件AA9406の再現
   *
   * 修正前の動作（バグ）:
   *   getPurchaseStatusText("買付外れました", "一般他決") → "買付外れました" を返す（誤）
   *
   * 修正後の期待動作:
   *   offer_status_updated_at > latest_status_updated_at の場合、"一般他決" を返す（正）
   */
  it('修正後: offer_status の方が新しい場合は offer_status を返す（AA9406シナリオ）', () => {
    const latestStatus = '買付外れました'; // 2025-06-01 更新（古い）
    const offerStatus = '一般他決';        // 2025-06-10 更新（新しい）
    const latestStatusUpdatedAt = '2025-06-01T00:00:00.000Z';
    const offerStatusUpdatedAt = '2025-06-10T00:00:00.000Z';

    const result = getPurchaseStatusText(
      latestStatus,
      offerStatus,
      latestStatusUpdatedAt,
      offerStatusUpdatedAt
    );

    // 修正後: offer_status の方が新しいので "一般他決" を返す
    expect(result).toBe('一般他決');
  });

  /**
   * 修正前の動作（バグ）の記録:
   * タイムスタンプなしで呼び出した場合、修正前は "買付外れました" を返していた。
   * 修正後はタイムスタンプなしの場合 offer_status を優先するため "一般他決" を返す。
   */
  it('修正後: タイムスタンプなしの場合は offer_status を優先する（フォールバック）', () => {
    const latestStatus = '買付外れました';
    const offerStatus = '一般他決';

    // タイムスタンプなし（修正前の呼び出し方）
    const result = getPurchaseStatusText(latestStatus, offerStatus);

    // 修正後: タイムスタンプなしの場合は offer_status を優先
    expect(result).toBe('一般他決');
  });

  /**
   * 正常ケース: latest_status の方が新しい場合は latest_status を返す
   */
  it('修正後: latest_status の方が新しい場合は latest_status を返す', () => {
    const latestStatus = '買付外れました'; // 2025-06-10 更新（新しい）
    const offerStatus = '一般他決';        // 2025-06-01 更新（古い）
    const latestStatusUpdatedAt = '2025-06-10T00:00:00.000Z';
    const offerStatusUpdatedAt = '2025-06-01T00:00:00.000Z';

    const result = getPurchaseStatusText(
      latestStatus,
      offerStatus,
      latestStatusUpdatedAt,
      offerStatusUpdatedAt
    );

    // latest_status の方が新しいので "買付外れました" を返す
    expect(result).toBe('買付外れました');
  });
});
