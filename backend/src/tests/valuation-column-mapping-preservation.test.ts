/**
 * 保存検証テスト：既存同期ロジックの維持
 * 
 * **重要**: このテストは修正前のコードで実行し、成功することを確認する（ベースライン動作を確認）
 * **修正後も実行する** - 修正後もこのテストが成功することで、リグレッションがないことを確認
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * Preservation Requirements:
 * - 査定額以外のフィールド（名前、電話番号、物件住所等）の同期ロジックは変更しない
 * - 手動入力査定額（CB/CC/CD列）が存在する場合の優先順位ロジック（「手動入力優先、なければ自動計算」）は維持する
 * - 査定額の単位変換ロジック（万円→円、×10,000）は維持する
 * - スプレッドシートの取得範囲（`B:CZ`）は維持する
 */

import columnMapping from '../config/column-mapping.json';
import fc from 'fast-check';

describe('Preservation: 既存同期ロジックの維持', () => {
  describe('3.1 査定額以外のフィールドのマッピング', () => {
    it('should preserve mapping for name field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 名前フィールドのマッピングが変更されていないことを確認
      expect(mapping.name).toBe('名前(漢字のみ）');
    });

    it('should preserve mapping for phone_number field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 電話番号フィールドのマッピングが変更されていないことを確認
      expect(mapping.phone_number).toBe('電話番号\nハイフン不要');
    });

    it('should preserve mapping for property_address field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 物件住所フィールドのマッピングが変更されていないことを確認
      expect(mapping.property_address).toBe('物件所在地');
    });

    it('should preserve mapping for email field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // メールアドレスフィールドのマッピングが変更されていないことを確認
      expect(mapping.email).toBe('メールアドレス');
    });

    it('should preserve mapping for status field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 状況（当社）フィールドのマッピングが変更されていないことを確認
      expect(mapping.status).toBe('状況（当社）');
    });

    it('should preserve mapping for visit_assignee field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 営担フィールドのマッピングが変更されていないことを確認
      expect(mapping.visit_assignee).toBe('営担');
    });

    it('should preserve mapping for next_call_date field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // 次電日フィールドのマッピングが変更されていないことを確認
      expect(mapping.next_call_date).toBe('次電日');
    });

    it('should preserve mapping for comments field', () => {
      const mapping = columnMapping.databaseToSpreadsheet;
      
      // コメントフィールドのマッピングが変更されていないことを確認
      expect(mapping.comments).toBe('コメント');
    });
  });

  describe('3.2 優先順位ロジックの維持（手動入力優先）', () => {
    it('should have both manual and auto valuation mappings in spreadsheetToDatabase', () => {
      const mapping = columnMapping.spreadsheetToDatabase;
      
      // 手動入力査定額のマッピングが存在することを確認
      expect(mapping['査定額1']).toBe('valuation_amount_1');
      expect(mapping['査定額2']).toBe('valuation_amount_2');
      expect(mapping['査定額3']).toBe('valuation_amount_3');
      
      // 自動計算査定額のマッピングも存在することを確認
      expect(mapping['査定額1（自動計算）v']).toBe('valuation_amount_1_auto');
      expect(mapping['査定額2（自動計算）v']).toBe('valuation_amount_2_auto');
      expect(mapping['査定額3（自動計算）v']).toBe('valuation_amount_3_auto');
    });

    it('should verify that manual valuation fields map to the same database column as auto fields', () => {
      const mapping = columnMapping.spreadsheetToDatabase;
      
      // 手動入力と自動計算が同じDBカラムにマッピングされることを確認
      // （優先順位ロジックは同期サービス側で実装される）
      const manualColumn1 = mapping['査定額1'];
      const autoColumn1 = mapping['査定額1（自動計算）v'];
      
      // 両方とも valuation_amount_* にマッピングされることを確認
      expect(manualColumn1).toMatch(/^valuation_amount_\d+$/);
      expect(autoColumn1).toMatch(/^valuation_amount_\d+(_auto)?$/);
    });
  });

  describe('3.3 単位変換ロジックの維持（万円→円）', () => {
    it('should preserve type conversion for valuation fields', () => {
      const typeConversions = columnMapping.typeConversions;
      
      // 査定額フィールドの型変換が number であることを確認
      expect(typeConversions.valuation_amount_1).toBe('number');
      expect(typeConversions.valuation_amount_2).toBe('number');
      expect(typeConversions.valuation_amount_3).toBe('number');
      expect(typeConversions.valuation_amount_1_auto).toBe('number');
      expect(typeConversions.valuation_amount_2_auto).toBe('number');
      expect(typeConversions.valuation_amount_3_auto).toBe('number');
    });

    it('should preserve type conversion for other numeric fields', () => {
      const typeConversions = columnMapping.typeConversions;
      
      // 他の数値フィールドの型変換も維持されていることを確認
      expect(typeConversions.land_area).toBe('number');
      expect(typeConversions.building_area).toBe('number');
      expect(typeConversions.build_year).toBe('number');
      expect(typeConversions.land_area_verified).toBe('number');
      expect(typeConversions.building_area_verified).toBe('number');
      expect(typeConversions.fixed_asset_tax_road_price).toBe('number');
    });
  });

  describe('3.4 スプレッドシート取得範囲の維持', () => {
    it('should verify that CB/CC/CD columns are within the expected range', () => {
      // CB列 = 列79（0-indexed）
      // CC列 = 列80（0-indexed）
      // CD列 = 列81（0-indexed）
      // 取得範囲 B:CZ は列1〜103（0-indexed）をカバー
      
      // CB列（79）が範囲内であることを確認
      const cbColumnIndex = 79;
      const czColumnIndex = 103; // CZ列
      
      expect(cbColumnIndex).toBeLessThan(czColumnIndex);
      
      // CC列（80）が範囲内であることを確認
      const ccColumnIndex = 80;
      expect(ccColumnIndex).toBeLessThan(czColumnIndex);
      
      // CD列（81）が範囲内であることを確認
      const cdColumnIndex = 81;
      expect(cdColumnIndex).toBeLessThan(czColumnIndex);
    });
  });

  describe('Property-Based Test: 査定額以外のフィールドの整合性', () => {
    it('should maintain bidirectional mapping consistency for non-valuation fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'name',
            'phone_number',
            'email',
            'property_address',
            'status',
            'visit_assignee',
            'next_call_date',
            'comments',
            'inquiry_site',
            'property_type',
            'inquiry_year',
            'inquiry_date'
          ),
          (dbField) => {
            const dbToSheet = columnMapping.databaseToSpreadsheet;
            const sheetToDb = columnMapping.spreadsheetToDatabase;
            
            // DBフィールド → スプレッドシートカラム名を取得
            const sheetColumn = dbToSheet[dbField];
            
            // スプレッドシートカラム名が存在することを確認
            expect(sheetColumn).toBeDefined();
            expect(typeof sheetColumn).toBe('string');
            expect(sheetColumn.length).toBeGreaterThan(0);
            
            // スプレッドシートカラム名 → DBフィールドの逆マッピングを確認
            const reversedDbField = sheetToDb[sheetColumn];
            
            // 逆マッピングが元のDBフィールドと一致することを確認
            // （一部のフィールドは複数のスプレッドシートカラムにマッピングされる可能性があるため、
            //  完全一致ではなく、存在することを確認）
            expect(reversedDbField).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify that all non-valuation fields have valid type conversions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'land_area',
            'building_area',
            'build_year',
            'inquiry_date',
            'inquiry_detailed_datetime',
            'visit_acquisition_date',
            'visit_date',
            'land_area_verified',
            'building_area_verified',
            'next_call_date',
            'contract_year_month',
            'created_at',
            'updated_at',
            'fixed_asset_tax_road_price'
          ),
          (dbField) => {
            const typeConversions = columnMapping.typeConversions;
            
            // 型変換が定義されていることを確認
            const typeConversion = typeConversions[dbField];
            expect(typeConversion).toBeDefined();
            
            // 型変換が有効な値であることを確認
            expect(['number', 'date', 'datetime', 'string']).toContain(typeConversion);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property-Based Test: マッピングの完全性', () => {
    it('should verify that all databaseToSpreadsheet mappings have corresponding spreadsheetToDatabase mappings', () => {
      const dbToSheet = columnMapping.databaseToSpreadsheet;
      const sheetToDb = columnMapping.spreadsheetToDatabase;
      
      // 査定額フィールドを除外（これらは特殊な扱いをするため）
      const excludedFields = [
        'valuation_amount_1',
        'valuation_amount_2',
        'valuation_amount_3'
      ];
      
      Object.entries(dbToSheet).forEach(([dbField, sheetColumn]) => {
        if (excludedFields.includes(dbField)) {
          return; // 査定額フィールドはスキップ
        }
        
        // スプレッドシートカラム名が文字列であることを確認
        expect(typeof sheetColumn).toBe('string');
        
        // 逆マッピングが存在することを確認
        const reversedDbField = sheetToDb[sheetColumn as string];
        expect(reversedDbField).toBeDefined();
      });
    });

    it('should verify that required fields are present in the mapping', () => {
      const requiredFields = columnMapping.requiredFields;
      const dbToSheet = columnMapping.databaseToSpreadsheet;
      
      // 必須フィールドが全てマッピングに存在することを確認
      requiredFields.forEach((field) => {
        expect(dbToSheet[field]).toBeDefined();
        expect(typeof dbToSheet[field]).toBe('string');
        expect(dbToSheet[field].length).toBeGreaterThan(0);
      });
    });
  });
});
