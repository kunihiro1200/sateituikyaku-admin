/**
 * 保全プロパティテスト: buyer-property-sync-missing
 *
 * **Property 2: Preservation** - 非property_numberフィールド更新の既存動作維持
 *
 * **重要**: このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
 * 観察優先メソドロジーに従い、非バグ条件の入力の動作を観察する
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import * as fc from 'fast-check';
import { BuyerColumnMapper } from '../BuyerColumnMapper';

// ============================================================
// 保全プロパティテスト
// ============================================================

describe('保全プロパティ: buyer-property-sync-missing', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  // ----------------------------------------------------------
  // 観察1: property_address のマッピングが正しく動作する
  // ----------------------------------------------------------
  describe('観察1: property_address マッピングの動作確認', () => {
    /**
     * 既存の databaseToSpreadsheet マッピングに property_address が存在し、
     * mapDatabaseToSpreadsheet({ property_address: "大分市..." }) が
     * { "物件所在地": "大分市..." } を返すことを確認する
     *
     * Requirements 3.4: databaseToSpreadsheet の既存フィールドは引き続き正しく動作する
     */
    it('観察1: mapDatabaseToSpreadsheet({ property_address: "大分市中央1-1-1" }) が { "物件所在地": "大分市中央1-1-1" } を返す', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ property_address: '大分市中央1-1-1' });

      console.log('[観察1] mapDatabaseToSpreadsheet({ property_address: "大分市中央1-1-1" }) =>', JSON.stringify(result));

      // 既存動作: property_address -> 物件所在地 のマッピングが正しく動作する
      expect(result).toHaveProperty('物件所在地', '大分市中央1-1-1');
    });

    it('観察1: mapDatabaseToSpreadsheet({ property_address: "別府市..." }) が 物件所在地 キーを含む', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ property_address: '別府市北浜1-2-3' });

      expect(result).toHaveProperty('物件所在地');
      expect(result['物件所在地']).toBe('別府市北浜1-2-3');
    });
  });

  // ----------------------------------------------------------
  // 観察2: viewing_date 更新時に物件情報フィールドが含まれない
  // ----------------------------------------------------------
  describe('観察2: viewing_date 更新時の動作確認', () => {
    /**
     * viewing_date を更新した際、mapDatabaseToSpreadsheet の結果に
     * property_address / display_address / price が含まれないことを確認する
     *
     * Requirements 3.1: property_number を含まないフィールド更新では
     * 物件情報がスプレッドシートに追加されない
     */
    it('観察2: mapDatabaseToSpreadsheet({ viewing_date: "2026-01-01" }) の結果に property_address/display_address/price が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2026-01-01' });

      console.log('[観察2] mapDatabaseToSpreadsheet({ viewing_date: "2026-01-01" }) =>', JSON.stringify(result));

      // 既存動作: viewing_date の更新では物件情報フィールドは含まれない
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
    });

    it('観察2: mapDatabaseToSpreadsheet({ viewing_date: "2026-01-01" }) が ●内覧日(最新） キーを含む', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2026-01-01' });

      // viewing_date は ●内覧日(最新） にマッピングされる
      expect(result).toHaveProperty('●内覧日(最新）');
    });
  });

  // ----------------------------------------------------------
  // 観察3: 既存フィールドのマッピングが正しく動作する
  // ----------------------------------------------------------
  describe('観察3: 既存フィールドのマッピング動作確認', () => {
    /**
     * databaseToSpreadsheet の既存フィールドが正しくマッピングされることを確認する
     *
     * Requirements 3.4: databaseToSpreadsheet の既存フィールドは変更されない
     */
    it('観察3: price フィールドが 価格 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ price: 23800000 });

      console.log('[観察3] mapDatabaseToSpreadsheet({ price: 23800000 }) =>', JSON.stringify(result));

      expect(result).toHaveProperty('価格');
    });

    it('観察3: latest_status フィールドが ★最新状況 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ latest_status: 'A' });

      // latest_status -> ★最新状況\n にマッピングされる
      const hasLatestStatus = Object.keys(result).some(key => key.includes('★最新状況'));
      expect(hasLatestStatus).toBe(true);
    });

    it('観察3: buyer_number フィールドが 買主番号 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ buyer_number: '7187' });

      expect(result).toHaveProperty('買主番号', '7187');
    });

    it('観察3: viewing_date と property_address を同時に渡した場合、両方が正しくマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({
        viewing_date: '2026-01-01',
        property_address: '大分市中央1-1-1',
      });

      expect(result).toHaveProperty('●内覧日(最新）');
      expect(result).toHaveProperty('物件所在地', '大分市中央1-1-1');
    });
  });

  // ----------------------------------------------------------
  // プロパティベーステスト: property_number を含まない更新では物件情報が追加されない
  // ----------------------------------------------------------
  describe('プロパティベーステスト: 非property_numberフィールド更新の保全', () => {
    /**
     * property_number を含まない任意のフィールド更新では、
     * mapDatabaseToSpreadsheet の結果に property_address / display_address / price が
     * 含まれないことを検証する
     *
     * Requirements 3.1, 3.2: property_number を含まない更新では物件情報は追加されない
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    it('プロパティベーステスト: property_number を含まない任意のフィールド更新では 物件所在地/住居表示/価格 が結果に含まれない', () => {
      // property_number を含まないフィールド名のリスト
      const nonPropertyNumberFields = [
        'viewing_date',
        'latest_status',
        'next_call_date',
        'name',
        'phone_number',
        'email',
        'desired_area',
        'desired_timing',
        'desired_property_type',
        'viewing_result_follow_up',
        'inquiry_hearing',
        'follow_up_assignee',
        'distribution_type',
        'pinrich',
        'budget',
        'viewing_mobile',
        'viewing_type_general',
      ];

      fc.assert(
        fc.property(
          // property_number を含まないフィールド名をランダムに選択
          fc.constantFrom(...nonPropertyNumberFields),
          fc.string({ minLength: 1, maxLength: 50 }),
          (fieldName, fieldValue) => {
            const record: Record<string, any> = { [fieldName]: fieldValue };
            const result = mapper.mapDatabaseToSpreadsheet(record);

            // property_number を含まない更新では物件情報フィールドが含まれない
            const hasPropertyAddress = '物件所在地' in result;
            const hasDisplayAddress = '住居表示' in result;
            const hasPrice = '価格' in result;

            // 物件情報フィールドが含まれないことを確認
            // ただし、property_address フィールドを直接渡した場合は除く
            if (fieldName === 'property_address') {
              // property_address を直接渡した場合は 物件所在地 が含まれる（正常動作）
              return true;
            }

            return !hasPropertyAddress && !hasDisplayAddress && !hasPrice;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('プロパティベーステスト: property_number=null の更新では物件情報フィールドが含まれない', () => {
      // property_number が null の場合
      const result = mapper.mapDatabaseToSpreadsheet({ property_number: null });

      console.log('[PBT] mapDatabaseToSpreadsheet({ property_number: null }) =>', JSON.stringify(result));

      // property_number: null の場合、物件情報フィールドは含まれない
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
    });

    it('プロパティベーステスト: 空文字の property_number では物件情報フィールドが含まれない', () => {
      // property_number が空文字の場合
      const result = mapper.mapDatabaseToSpreadsheet({ property_number: '' });

      console.log('[PBT] mapDatabaseToSpreadsheet({ property_number: "" }) =>', JSON.stringify(result));

      // property_number: "" の場合、物件情報フィールドは含まれない
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
    });
  });

  // ----------------------------------------------------------
  // 観察4: buyer-column-mapping.json の既存マッピング確認
  // ----------------------------------------------------------
  describe('観察4: buyer-column-mapping.json の既存マッピング確認', () => {
    /**
     * databaseToSpreadsheet の既存フィールドが変更されていないことを確認する
     *
     * Requirements 3.4: 既存フィールドのマッピングは変更されない
     */
    it('観察4: databaseToSpreadsheet に property_address が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      expect(databaseToSpreadsheet).toHaveProperty('property_address', '物件所在地');
    });

    it('観察4: databaseToSpreadsheet に price が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      expect(databaseToSpreadsheet).toHaveProperty('price', '価格');
    });

    it('観察4: databaseToSpreadsheet に viewing_date が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      expect(databaseToSpreadsheet).toHaveProperty('viewing_date', '●内覧日(最新）');
    });

    it('観察4: databaseToSpreadsheet に buyer_number が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const databaseToSpreadsheet = columnMapping.databaseToSpreadsheet;

      expect(databaseToSpreadsheet).toHaveProperty('buyer_number', '買主番号');
    });

    it('観察4: spreadsheetToDatabaseExtended に 住居表示 -> display_address が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      const spreadsheetToDatabaseExtended = columnMapping.spreadsheetToDatabaseExtended;

      // スプシ→DB方向のマッピングは既存通り存在する（Requirements 3.3）
      expect(spreadsheetToDatabaseExtended).toHaveProperty('住居表示', 'display_address');
    });
  });

  // ----------------------------------------------------------
  // 観察5: BuyerService.updateWithSync に property_number 保存時の処理が存在しない（未修正確認）
  // ----------------------------------------------------------
  describe('観察5: BuyerService.updateWithSync の現在の動作確認', () => {
    /**
     * 未修正コードでは、updateWithSync は allowedData をそのままスプレッドシートに書き戻す
     * property_number を含まない更新では、allowedData に物件情報が追加されない
     *
     * Requirements 3.1: property_number を含まない更新では既存動作が維持される
     */
    it('観察5: BuyerService.updateWithSync は allowedData をそのまま writeService.updateFields に渡す', () => {
      const fs = require('fs');
      const path = require('path');

      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // updateWithSync メソッドの範囲を抽出
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';

      // writeService.updateFields(buyerNumber, allowedData) が呼ばれていることを確認
      const callsUpdateFields = funcBody.includes('writeService') &&
        funcBody.includes('updateFields') &&
        funcBody.includes('allowedData');

      console.log('[観察5] writeService.updateFields(buyerNumber, allowedData) が呼ばれているか:', callsUpdateFields);

      // 既存動作: writeService.updateFields に allowedData を渡す
      expect(callsUpdateFields).toBe(true);
    });

    it('観察5: BuyerService.updateWithSync の protectedFields に buyer_number が含まれる', () => {
      const fs = require('fs');
      const path = require('path');

      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');

      // protectedFields の定義を確認
      const hasProtectedFields = sourceCode.includes("'buyer_number'") &&
        sourceCode.includes('protectedFields');

      console.log('[観察5] protectedFields に buyer_number が含まれるか:', hasProtectedFields);

      // 既存動作: buyer_number は更新不可フィールドとして保護されている
      expect(hasProtectedFields).toBe(true);
    });
  });
});
