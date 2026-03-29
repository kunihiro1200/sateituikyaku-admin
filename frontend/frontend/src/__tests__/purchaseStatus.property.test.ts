/**
 * 買付状況判定ユーティリティのプロパティベーステスト
 *
 * fast-check を使用して、判定ロジックの正確性と優先順位を検証する。
 */

import * as fc from 'fast-check';
import {
  hasBuyerPurchaseStatus,
  hasPropertyOfferStatus,
  getPurchaseStatusText,
} from '../utils/purchaseStatusUtils';

describe('purchaseStatusUtils プロパティテスト', () => {
  // Feature: property-purchase-status-display, Property 1: 判定ロジックの正確性（条件1）
  // Validates: 要件 1.1, 1.4
  it('Property 1: 「買」を含む文字列は true を返し、含まない文字列は false を返す', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = hasBuyerPurchaseStatus(s);
        return result === s.includes('買');
      }),
      { numRuns: 20 }
    );
  });

  // Feature: property-purchase-status-display, Property 1: null・空文字は false を返す
  it('Property 1 (エッジケース): null・空文字は false を返す', () => {
    expect(hasBuyerPurchaseStatus(null)).toBe(false);
    expect(hasBuyerPurchaseStatus(undefined)).toBe(false);
    expect(hasBuyerPurchaseStatus('')).toBe(false);
  });

  // Feature: property-purchase-status-display, Property 2: 判定ロジックの正確性（条件2）
  // Validates: 要件 1.2, 1.5
  it('Property 2: 空でない文字列は true を返す', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (s) => {
        return hasPropertyOfferStatus(s) === true;
      }),
      { numRuns: 20 }
    );
  });

  // Feature: property-purchase-status-display, Property 2: null・空文字は false を返す
  it('Property 2 (エッジケース): null・空文字は false を返す', () => {
    expect(hasPropertyOfferStatus(null)).toBe(false);
    expect(hasPropertyOfferStatus(undefined)).toBe(false);
    expect(hasPropertyOfferStatus('')).toBe(false);
  });

  // Feature: property-purchase-status-display, Property 3: 優先順位の正確性
  // Validates: 要件 1.3
  it('Property 3: 条件1と条件2が両方成立する場合、常に latestStatus の値を返す', () => {
    fc.assert(
      fc.property(
        // 条件1成立: 「買」を含む文字列
        fc.string().filter((s) => s.includes('買')),
        // 条件2成立: 空でない文字列
        fc.string({ minLength: 1 }),
        (latestStatus, offerStatus) => {
          return getPurchaseStatusText(latestStatus, offerStatus) === latestStatus;
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Property 6: latest_status を使った条件1判定', () => {
  // Feature: property-purchase-status-display, Property 6: latest_statusを使った条件1判定
  // Validates: 要件 3.4, 4.5
  it('Property 6: latest_status に「買」が含まれる場合はその値を返し、含まれない場合は null を返す', () => {
    fc.assert(
      fc.property(
        fc.record({
          latest_status: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string()
          ),
        }),
        (buyer) => {
          const result = getPurchaseStatusText(buyer.latest_status, null);
          if (buyer.latest_status && buyer.latest_status.includes('買')) {
            // 条件1成立: latest_status の値が返る
            return result === buyer.latest_status;
          } else {
            // 条件1不成立: null が返る（条件2も null のため）
            return result === null;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
