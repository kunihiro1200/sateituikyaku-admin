/**
 * 保持プロパティテスト: buyer-spreadsheet-at-column-sync-bug
 *
 * **Property 2: Preservation** - 物件番号なし・他フィールド更新時の既存動作維持
 *
 * **重要**: このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
 * 観察優先メソドロジーに従い、非バグ条件の入力（property_number が空・null・未定義）の動作を観察する
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import { BuyerColumnMapper } from '../BuyerColumnMapper';

describe('保持プロパティ: buyer-spreadsheet-at-column-sync-bug', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  // ----------------------------------------------------------
  // 観察1: property_number を含まない更新で AU/AY/BQ/BR 列が変更されない
  // ----------------------------------------------------------
  describe('観察1: property_number を含まない更新で AU/AY/BQ/BR 列が変更されない', () => {
    /**
     * property_number を含まない更新データを mapDatabaseToSpreadsheet に渡した場合、
     * 結果に 物件所在地（AU列）・住居表示（AY列）・価格（BQ列）・物件担当者（BR列）が
     * 含まれないことを確認する。
     *
     * Requirements 3.1: AT列（物件番号）が空白の場合、AU/AY/BQ/BR列を変更しない
     */
    it('観察1: viewing_date のみの更新では 物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2026-01-15' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });

    it('観察1: latest_status のみの更新では 物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ latest_status: 'A' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });

    it('観察1: next_call_date のみの更新では 物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ next_call_date: '2026-02-01' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });
  });

  // ----------------------------------------------------------
  // 観察2: property_number = '' の場合、物件情報取得処理がスキップされる
  // ----------------------------------------------------------
  describe('観察2: property_number が空文字の場合の動作確認', () => {
    /**
     * BuyerService.updateWithSync の実装を静的解析し、
     * property_number が空文字の場合に物件情報取得処理がスキップされることを確認する。
     *
     * Requirements 3.1: AT列（物件番号）が空白の場合、AU/AY/BQ/BR列を変更しない
     */
    it('観察2: updateWithSync の実装に property_number が空文字の場合のスキップ条件が存在する', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      const hasEmptyStringCheck =
        funcBody.includes("allowedData.property_number !== ''") ||
        funcBody.includes('allowedData.property_number !== ""') ||
        funcBody.includes("property_number !== ''") ||
        funcBody.includes('property_number !== ""');
      expect(hasEmptyStringCheck).toBe(true);
    });

    it('観察2: mapDatabaseToSpreadsheet({ property_number: "" }) では 物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ property_number: '' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });
  });

  // ----------------------------------------------------------
  // 観察3: property_listings に対応物件がない場合、エラーなく処理継続
  // ----------------------------------------------------------
  describe('観察3: property_listings に対応物件がない場合の動作確認', () => {
    /**
     * BuyerService.updateWithSync の実装を静的解析し、
     * property_listings に対応物件が存在しない場合にエラーなく処理継続することを確認する。
     *
     * Requirements 3.3: property_listings に対応物件が存在しない場合、
     * エラーを発生させずに処理を継続し、物件番号のみを保存する
     */
    it('観察3: updateWithSync の実装に maybeSingle() が使用されている（存在しない場合のエラー回避）', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      expect(funcBody.includes('maybeSingle()')).toBe(true);
    });

    it('観察3: updateWithSync の実装に property_listings 取得失敗時の継続処理が存在する', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      expect(funcBody.includes('try {')).toBe(true);
      expect(funcBody.includes('catch (')).toBe(true);
      expect(funcBody.includes("from('property_listings')")).toBe(true);
    });

    it('観察3: create の実装に maybeSingle() が使用されている（存在しない場合のエラー回避）', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('  async create(buyerData: Partial<any>): Promise<any> {');
      const funcEnd = sourceCode.indexOf('\n  private async initBuyerNumberClient()', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      expect(funcBody.includes('maybeSingle()')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 観察4: 内覧日・最新状況など他フィールドの同期が正常に動作する
  // ----------------------------------------------------------
  describe('観察4: 他フィールドの同期が正常に動作する', () => {
    /**
     * viewing_date・latest_status・next_call_date などの他フィールドが
     * 正しくスプレッドシートのカラム名にマッピングされることを確認する。
     *
     * Requirements 3.2: 物件番号以外のフィールド（内覧日・最新状況など）を更新する場合、
     * 対応するスプレッドシート列を正常に同期する
     */
    it('観察4: viewing_date が ●内覧日(最新） にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2026-01-15' });
      expect(result).toHaveProperty('●内覧日(最新）');
    });

    it('観察4: latest_status が ★最新状況 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ latest_status: 'A' });
      const hasLatestStatus = Object.keys(result).some(key => key.includes('★最新状況'));
      expect(hasLatestStatus).toBe(true);
    });

    it('観察4: next_call_date が ★次電日 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ next_call_date: '2026-02-01' });
      expect(result).toHaveProperty('★次電日');
    });

    it('観察4: follow_up_assignee が 後続担当 にマッピングされる', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ follow_up_assignee: 'KN' });
      expect(result).toHaveProperty('後続担当', 'KN');
    });
  });

  // ----------------------------------------------------------
  // プロパティベーステスト: property_number が空・null・未定義の全ケースで
  //                         AU/AY/BQ/BR 列が変更されない
  // ----------------------------------------------------------
  describe('プロパティベーステスト: property_number が空・null・未定義の全ケースで AU/AY/BQ/BR 列が変更されない', () => {
    /**
     * property_number が空文字・null・undefined の場合、
     * mapDatabaseToSpreadsheet の結果に
     * 物件所在地（AU列）・住居表示（AY列）・価格（BQ列）・物件担当者（BR列）が
     * 含まれないことを検証する。
     *
     * Requirements 3.1: AT列（物件番号）が空白の場合、AU/AY/BQ/BR列を変更しない
     *
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     */
    it('PBT: property_number が空文字の場合、物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ property_number: '' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });

    it('PBT: property_number が null の場合、物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ property_number: null });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });

    it('PBT: property_number が undefined の場合（フィールドなし）、物件所在地/住居表示/価格/物件担当者 が含まれない', () => {
      const result = mapper.mapDatabaseToSpreadsheet({ viewing_date: '2026-01-15' });
      expect(result).not.toHaveProperty('物件所在地');
      expect(result).not.toHaveProperty('住居表示');
      expect(result).not.toHaveProperty('価格');
      expect(result).not.toHaveProperty('物件担当者');
    });

    it('PBT: property_number が空・null・未定義の全ケースで AU/AY/BQ/BR 列が変更されない（fast-check）', () => {
      const emptyPropertyNumbers = fc.oneof(
        fc.constant(''),
        fc.constant(null),
        fc.constant(undefined)
      );
      const nonPropertyNumberFields = [
        'viewing_date', 'latest_status', 'next_call_date', 'name',
        'phone_number', 'email', 'desired_area', 'desired_timing',
        'desired_property_type', 'viewing_result_follow_up', 'inquiry_hearing',
        'follow_up_assignee', 'distribution_type', 'pinrich', 'budget',
        'viewing_mobile', 'viewing_type_general', 'inquiry_email_phone',
        'three_calls_confirmed',
      ];
      fc.assert(
        fc.property(
          emptyPropertyNumbers,
          fc.constantFrom(...nonPropertyNumberFields),
          fc.string({ minLength: 0, maxLength: 50 }),
          (emptyPropertyNumber, otherFieldName, otherFieldValue) => {
            const record: Record<string, any> = { [otherFieldName]: otherFieldValue };
            if (emptyPropertyNumber !== undefined) {
              record.property_number = emptyPropertyNumber;
            }
            const result = mapper.mapDatabaseToSpreadsheet(record);
            if (
              otherFieldName !== 'property_address' &&
              otherFieldName !== 'display_address' &&
              otherFieldName !== 'price' &&
              otherFieldName !== 'property_assignee'
            ) {
              return !('物件所在地' in result) && !('住居表示' in result) &&
                     !('価格' in result) && !('物件担当者' in result);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PBT: property_number を含まない任意のフィールド更新では 物件担当者（BR列）が含まれない', () => {
      const nonPropertyNumberFields = [
        'viewing_date', 'latest_status', 'next_call_date', 'name',
        'phone_number', 'email', 'desired_area', 'desired_timing',
        'desired_property_type', 'viewing_result_follow_up', 'inquiry_hearing',
        'follow_up_assignee', 'distribution_type', 'pinrich', 'budget',
        'viewing_mobile', 'viewing_type_general', 'inquiry_email_phone',
        'three_calls_confirmed',
      ];
      fc.assert(
        fc.property(
          fc.constantFrom(...nonPropertyNumberFields),
          fc.string({ minLength: 1, maxLength: 50 }),
          (fieldName, fieldValue) => {
            const record: Record<string, any> = { [fieldName]: fieldValue };
            const result = mapper.mapDatabaseToSpreadsheet(record);
            return !('物件担当者' in result);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ----------------------------------------------------------
  // 観察5: buyer-column-mapping.json の既存マッピング確認
  // ----------------------------------------------------------
  describe('観察5: buyer-column-mapping.json の既存マッピング確認', () => {
    /**
     * databaseToSpreadsheet の既存フィールドが変更されていないことを確認する。
     *
     * Requirements 3.4: 既存フィールドのマッピングは変更されない
     */
    it('観察5: databaseToSpreadsheet に property_address -> 物件所在地 が存在する（AU列）', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.databaseToSpreadsheet).toHaveProperty('property_address', '物件所在地');
    });

    it('観察5: databaseToSpreadsheet に display_address -> 住居表示 が存在する（AY列）', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.databaseToSpreadsheet).toHaveProperty('display_address', '住居表示');
    });

    it('観察5: databaseToSpreadsheet に price -> 価格 が存在する（BQ列）', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.databaseToSpreadsheet).toHaveProperty('price', '価格');
    });

    it('観察5: databaseToSpreadsheet に property_assignee -> 物件担当者 が存在する（BR列 - 修正後確認）', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      // 修正後は property_assignee -> 物件担当者 が追加される
      expect(columnMapping.databaseToSpreadsheet['property_assignee']).toBe('物件担当者');
    });

    it('観察5: spreadsheetToDatabase に 物件担当者 -> property_assignee が存在する（逆方向は存在する）', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.spreadsheetToDatabase['物件担当者']).toBe('property_assignee');
    });

    it('観察5: databaseToSpreadsheet に viewing_date -> ●内覧日(最新） が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.databaseToSpreadsheet).toHaveProperty('viewing_date', '●内覧日(最新）');
    });

    it('観察5: databaseToSpreadsheet に buyer_number -> 買主番号 が存在する', () => {
      const columnMapping = require('../../config/buyer-column-mapping.json');
      expect(columnMapping.databaseToSpreadsheet).toHaveProperty('buyer_number', '買主番号');
    });
  });

  // ----------------------------------------------------------
  // 観察6: BuyerService.updateWithSync の静的解析による動作確認
  // ----------------------------------------------------------
  describe('観察6: BuyerService.updateWithSync の静的解析による動作確認', () => {
    /**
     * BuyerService.updateWithSync の実装を静的解析し、
     * property_number を含まない更新では物件情報が追加されないことを確認する。
     *
     * Requirements 3.1: property_number を含まない更新では既存動作が維持される
     */
    it('観察6: updateWithSync は allowedData.property_number の存在チェックを行う', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      const hasPropertyNumberCheck =
        funcBody.includes('allowedData.property_number') &&
        (funcBody.includes('!= null') || funcBody.includes('!== null') || funcBody.includes('!== undefined'));
      expect(hasPropertyNumberCheck).toBe(true);
    });

    it('観察6: updateWithSync は writeService.updateFields に allowedData を渡す', () => {
      const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');
      const sourceCode = fs.readFileSync(buyerServicePath, 'utf-8');
      const funcStart = sourceCode.indexOf('async updateWithSync(');
      const funcEnd = sourceCode.indexOf('\n  async updateBatch(', funcStart);
      const funcBody = funcStart !== -1 && funcEnd !== -1
        ? sourceCode.substring(funcStart, funcEnd)
        : '';
      expect(
        funcBody.includes('writeService') &&
        funcBody.includes('updateFields') &&
        funcBody.includes('allowedData')
      ).toBe(true);
    });
  });
});
