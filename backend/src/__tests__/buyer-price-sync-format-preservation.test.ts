/**
 * 保全プロパティテスト: price以外のフィールドのDB→スプシ同期動作保全
 *
 * このテストは未修正コードで実行し、PASSすることを確認する（ベースライン動作の確認）
 *
 * 目的: price フィールドを含まない全ての入力に対して、
 *       BuyerColumnMapper.mapDatabaseToSpreadsheet が正しく動作することを確認する。
 *
 * 観察優先メソドロジー:
 *   - 未修正コードで非バグ条件の入力（price フィールドを含まないレコード）の動作を観察する
 *   - 修正前後で変換結果が同一であることを確認する（リグレッション防止）
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import * as fc from 'fast-check';
import { BuyerColumnMapper } from '../services/BuyerColumnMapper';

describe('Preservation: price以外のフィールドのDB→スプシ同期動作保全', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  // ===== 観察例: 具体的なフィールドの変換動作を確認 =====

  /**
   * 観察例1: name フィールドの変換
   * mapDatabaseToSpreadsheet({ name: '田中太郎' }) → { "●氏名・会社名": '田中太郎' }
   */
  test('観察例1: name フィールドが "●氏名・会社名" に正しく変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ name: '田中太郎' });

    console.log('[Preservation Test] 入力: { name: "田中太郎" }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('●氏名・会社名', '田中太郎');
  });

  /**
   * 観察例2: phone_number フィールドの変換
   */
  test('観察例2: phone_number フィールドが "●電話番号\\n（ハイフン不要）" に正しく変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ phone_number: '09012345678' });

    console.log('[Preservation Test] 入力: { phone_number: "09012345678" }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('●電話番号\n（ハイフン不要）', '09012345678');
  });

  /**
   * 観察例3: viewing_date フィールドの変換（日付フォーマット）
   * YYYY-MM-DD → YYYY/MM/DD に変換される
   */
  test('観察例3: viewing_date フィールドが "●内覧日(最新）" に正しく変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2024-01-15' });

    console.log('[Preservation Test] 入力: { viewing_date: "2024-01-15" }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('●内覧日(最新）');
    // 日付フォーマット変換: YYYY-MM-DD → YYYY/MM/DD
    expect(result['●内覧日(最新）']).toBe('2024/01/15');
  });

  /**
   * 観察例4: reception_date フィールドの変換
   */
  test('観察例4: reception_date フィールドが "受付日" に正しく変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ reception_date: '2024-03-20' });

    console.log('[Preservation Test] 入力: { reception_date: "2024-03-20" }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('受付日');
    expect(result['受付日']).toBe('2024/03/20');
  });

  /**
   * 観察例5: 複数フィールドの同時変換
   */
  test('観察例5: 複数フィールドが同時に正しく変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({
      name: '山田花子',
      phone_number: '08011112222',
      viewing_date: '2024-02-10',
    });

    console.log('[Preservation Test] 入力: { name, phone_number, viewing_date }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('●氏名・会社名', '山田花子');
    expect(result).toHaveProperty('●電話番号\n（ハイフン不要）', '08011112222');
    expect(result).toHaveProperty('●内覧日(最新）', '2024/02/10');
  });

  /**
   * 観察例6: null値の変換（空文字列に変換される）
   */
  test('観察例6: null値が空文字列に変換されること', () => {
    const result = mapper.mapDatabaseToSpreadsheet({ name: null });

    console.log('[Preservation Test] 入力: { name: null }');
    console.log('[Preservation Test] 結果:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('●氏名・会社名', '');
  });

  // ===== Property 2: Preservation プロパティベーステスト =====

  /**
   * Property 2 (PBT): price フィールドを含まない全ての入力に対して
   * databaseToSpreadsheet マッピング済みフィールドが正しく変換されること
   *
   * 未修正コードでは price 以外のフィールドは正常に動作するため、このテストは PASS する。
   *
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  test('Property 2 (PBT): price フィールドを含まない入力に対して、マッピング済みフィールドが正しく変換されること', () => {
    // databaseToSpreadsheet マッピングに存在するフィールド（price を除く）
    const mappedFields = [
      { dbField: 'name', spreadsheetField: '●氏名・会社名' },
      { dbField: 'phone_number', spreadsheetField: '●電話番号\n（ハイフン不要）' },
      { dbField: 'follow_up_assignee', spreadsheetField: '後続担当' },
      { dbField: 'initial_assignee', spreadsheetField: '初動担当' },
      { dbField: 'inquiry_source', spreadsheetField: '●問合せ元' },
      { dbField: 'distribution_type', spreadsheetField: '配信種別' },
      { dbField: 'desired_area', spreadsheetField: '★エリア' },
      { dbField: 'desired_timing', spreadsheetField: '●希望時期' },
      { dbField: 'desired_property_type', spreadsheetField: '★希望種別' },
      { dbField: 'desired_building_age', spreadsheetField: '★築年数' },
      { dbField: 'desired_floor_plan', spreadsheetField: '★間取り' },
      { dbField: 'email', spreadsheetField: '●メアド' },
      { dbField: 'company_name', spreadsheetField: '法人名' },
      { dbField: 'other_company_property', spreadsheetField: '他社物件' },
    ];

    fc.assert(
      fc.property(
        // ランダムな文字列値を生成（空文字列・null・通常文字列）
        fc.oneof(
          fc.constant(null),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        // ランダムにフィールドを選択
        fc.integer({ min: 0, max: mappedFields.length - 1 }),
        (value, fieldIndex) => {
          const { dbField, spreadsheetField } = mappedFields[fieldIndex];
          const input = { [dbField]: value };
          const result = mapper.mapDatabaseToSpreadsheet(input);

          // price フィールドが含まれていないことを確認
          const hasPriceKey = '価格' in result;
          if (hasPriceKey) {
            console.log(`[PBT] 予期しない "価格" キーが結果に含まれています: input=${JSON.stringify(input)}`);
            return false;
          }

          // マッピング済みフィールドが結果に含まれていることを確認
          const hasSpreadsheetField = spreadsheetField in result;
          if (!hasSpreadsheetField) {
            console.log(`[PBT] 反例発見: ${dbField} → "${spreadsheetField}" のマッピングが失敗`);
            console.log(`[PBT] 入力: ${JSON.stringify(input)}`);
            console.log(`[PBT] 結果: ${JSON.stringify(result)}`);
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 (PBT): 日付フィールドが price を含まない入力で正しく変換されること
   *
   * Validates: Requirements 3.1, 3.3
   */
  test('Property 2 (PBT): 日付フィールドが price を含まない入力で正しく変換されること', () => {
    fc.assert(
      fc.property(
        // YYYY-MM-DD 形式の日付文字列を生成
        fc.integer({ min: 2020, max: 2030 }).chain(year =>
          fc.integer({ min: 1, max: 12 }).chain(month =>
            fc.integer({ min: 1, max: 28 }).map(day => ({
              year,
              month: String(month).padStart(2, '0'),
              day: String(day).padStart(2, '0'),
            }))
          )
        ),
        ({ year, month, day }) => {
          const dateStr = `${year}-${month}-${day}`;
          const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: dateStr });

          // price フィールドが含まれていないことを確認
          if ('価格' in result) {
            return false;
          }

          // viewing_date が "●内覧日(最新）" に変換されていることを確認
          if (!('●内覧日(最新）' in result)) {
            console.log(`[PBT] 反例発見: viewing_date="${dateStr}" → "●内覧日(最新）" のマッピングが失敗`);
            return false;
          }

          // 日付フォーマットが YYYY/MM/DD に変換されていることを確認
          const expectedDate = `${year}/${month}/${day}`;
          if (result['●内覧日(最新）'] !== expectedDate) {
            console.log(`[PBT] 反例発見: viewing_date="${dateStr}" → 期待値="${expectedDate}", 実際="${result['●内覧日(最新）']}"`);
            return false;
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2 (PBT): price フィールドを含まない入力では "価格" キーが結果に含まれないこと
   *
   * 未修正コードでは price マッピングが存在しないため、
   * price フィールドを含まない入力では "価格" キーが結果に含まれない（正常動作）。
   *
   * Validates: Requirements 3.1, 3.2
   */
  test('Property 2 (PBT): price フィールドを含まない入力では "価格" キーが結果に含まれないこと', () => {
    // price 以外のフィールドのみを使用
    const nonPriceFields = ['name', 'phone_number', 'viewing_date', 'reception_date', 'email', 'follow_up_assignee'];

    fc.assert(
      fc.property(
        // price を含まないレコードを生成
        fc.record(
          Object.fromEntries(
            nonPriceFields.map(field => [
              field,
              fc.oneof(fc.constant(null), fc.string({ minLength: 0, maxLength: 20 }))
            ])
          )
        ),
        (record) => {
          // price フィールドが含まれていないことを確認
          if ('price' in record) {
            return true; // このケースはスキップ（ジェネレーターの設計上発生しないが念のため）
          }

          const result = mapper.mapDatabaseToSpreadsheet(record);

          // price フィールドを含まない入力では "価格" キーが結果に含まれないことを確認
          const hasPriceKey = '価格' in result;
          if (hasPriceKey) {
            console.log(`[PBT] 予期しない "価格" キーが結果に含まれています`);
            console.log(`[PBT] 入力: ${JSON.stringify(record)}`);
            console.log(`[PBT] 結果: ${JSON.stringify(result)}`);
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
