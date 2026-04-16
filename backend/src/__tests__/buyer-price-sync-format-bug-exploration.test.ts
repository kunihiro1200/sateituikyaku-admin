/**
 * Bug Condition探索テスト: priceフィールドのDB→スプシ同期マッピング欠落バグ
 *
 * このテストは未修正コードで実行し、失敗することを確認する（失敗＝バグの存在を証明）
 *
 * バグ: buyer-column-mapping.json の databaseToSpreadsheet セクションに
 *       "price": "価格" のエントリが存在しないため、
 *       BuyerColumnMapper.mapDatabaseToSpreadsheet({ price: 23800000 }) を呼び出しても
 *       結果に "価格" キーが含まれない。
 *
 * 根本原因:
 *   backend/src/config/buyer-column-mapping.json の databaseToSpreadsheet セクションに
 *   "price" キーが存在しない（spreadsheetToDatabaseExtended には "価格": "price" が存在する）
 *
 * Validates: Requirements 1.3, 2.3
 */

import * as fc from 'fast-check';
import { BuyerColumnMapper } from '../services/BuyerColumnMapper';

describe('Bug Condition: priceフィールドのDB→スプシ同期マッピング欠落', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  /**
   * Property 1: Bug Condition
   *
   * mapDatabaseToSpreadsheet({ price: 23800000 }) を呼び出した結果に
   * "価格": 23800000 が含まれることをアサートする。
   *
   * 未修正コードでは databaseToSpreadsheet に "price" エントリが存在しないため、
   * このテストは FAIL する（これがバグの存在を証明する）。
   *
   * Validates: Requirements 1.3, 2.3
   */
  test('Bug Condition: mapDatabaseToSpreadsheet({ price: 23800000 }) の結果に "価格": 23800000 が含まれること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ price: 23800000 });

    console.log('[Bug Condition Test] 入力: { price: 23800000 }');
    console.log('[Bug Condition Test] 結果:', JSON.stringify(result, null, 2));
    console.log('[Bug Condition Test] "価格" キーの存在:', '"価格"' in result);
    console.log('[Bug Condition Test] "価格" の値:', result['価格']);

    // 未修正コードではこのアサーションが失敗する（バグの存在を証明）
    expect(result).toHaveProperty('価格', 23800000);
  });

  /**
   * Property 1 (PBT): 任意の正の整数 price に対してマッピングが正しく動作すること
   *
   * fast-check を使用して、任意の正の整数 price を入力として
   * mapDatabaseToSpreadsheet の結果に "価格" キーが含まれることを確認する。
   *
   * 未修正コードでは全ての入力でこのプロパティが失敗する。
   *
   * Validates: Requirements 1.3, 2.3
   */
  test('Property 1 (PBT): 任意の正の整数 price に対して "価格" キーが結果に含まれること', () => {
    fc.assert(
      fc.property(
        // 正の整数（1円〜9億9999万円の範囲）
        fc.integer({ min: 1, max: 999_999_999 }),
        (price) => {
          const result = mapper.mapDatabaseToSpreadsheet({ price });

          // "価格" キーが存在し、値が price と一致することを確認
          const hasKey = '価格' in result;
          const hasCorrectValue = result['価格'] === price;

          if (!hasKey) {
            console.log(`[PBT] 反例発見: price=${price} → "価格" キーが存在しない`);
          }

          return hasKey && hasCorrectValue;
        }
      ),
      { numRuns: 10 }
    );
  });
});
