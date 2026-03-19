// 近隣買主候補テーブル フィールド表示バグ - バグ条件探索テスト
// Property 1: Bug Condition - getBuyersByAreas() のSQLクエリに必要なフィールドが含まれていない
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示す counterexample を発見する

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 静的コード解析: getBuyersByAreas() のSQLクエリを解析
// ============================================================

describe('バグ条件探索: getBuyersByAreas() のSQLクエリに必要なフィールドが含まれていない', () => {
  const buyerServicePath = path.resolve(__dirname, '../BuyerService.ts');

  let buyerServiceSource: string;

  // getBuyersByAreas() の .select() ブロックを抽出するヘルパー
  function extractGetBuyersByAreasSelectBlock(source: string): string | null {
    // getBuyersByAreas メソッドを抽出
    const methodMatch = source.match(
      /async getBuyersByAreas\s*\([^)]*\)[^{]*\{([\s\S]*?)(?=\n  (?:private|async|public)\s|\n  \/\*\*)/
    );
    if (!methodMatch) return null;

    const methodBody = methodMatch[1];

    // .select(` ... `) ブロックを抽出
    const selectMatch = methodBody.match(/\.select\(`([\s\S]*?)`\)/);
    if (!selectMatch) return null;

    return selectMatch[1];
  }

  beforeAll(() => {
    buyerServiceSource = fs.readFileSync(buyerServicePath, 'utf-8');
  });

  // ============================================================
  // 前提確認: BuyerService.ts と getBuyersByAreas() の存在確認
  // ============================================================
  describe('前提確認: BuyerService.ts に getBuyersByAreas() が存在する', () => {
    it('BuyerService.ts ファイルが存在する', () => {
      expect(fs.existsSync(buyerServicePath)).toBe(true);
    });

    it('BuyerService.ts に getBuyersByAreas() メソッドが定義されている', () => {
      expect(buyerServiceSource).toContain('async getBuyersByAreas(');
    });

    it('getBuyersByAreas() が Supabase の .select() を使用している', () => {
      // getBuyersByAreas メソッド内に .select() が存在することを確認
      const methodMatch = buyerServiceSource.match(
        /async getBuyersByAreas\s*\([^)]*\)([\s\S]*?)(?=\n  private parseDistributionAreas)/
      );
      expect(methodMatch).not.toBeNull();
      expect(methodMatch![1]).toContain('.select(');
    });
  });

  // ============================================================
  // 調査: 既存フィールドの確認（バグではないフィールド）
  // ============================================================
  describe('既存フィールドの確認: 正常に含まれているフィールド', () => {
    it('buyer_id が .select() に含まれている', () => {
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('buyer_id');
    });

    it('buyer_number が .select() に含まれている', () => {
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('buyer_number');
    });

    it('name が .select() に含まれている', () => {
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('name');
    });

    it('distribution_areas が .select() に含まれている', () => {
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();
      expect(selectBlock).toContain('distribution_areas');
    });
  });

  // ============================================================
  // バグ条件テスト: Property 1 - Bug Condition
  // 7つのフィールドが .select() に含まれていない
  // ============================================================
  describe('Property 1: Bug Condition - 必要なフィールドが .select() に含まれていない', () => {
    // ============================================================
    // Bug Condition 1.1: inquiry_property_type（種別）
    // ============================================================
    it('Bug Condition 1.1: inquiry_property_type（種別）が .select() に含まれていない', () => {
      // counterexample: buyer.inquiry_property_type === undefined
      // 根本原因: SQLクエリの .select() に inquiry_property_type が含まれていないため、
      //           Supabase がこのカラムを返さず、フロントエンドで undefined → "-" と表示される
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // 未修正コードでは inquiry_property_type が含まれていないため FAIL する
      // これが counterexample: buyer.inquiry_property_type === undefined
      expect(selectBlock).toContain('inquiry_property_type'); // ← 未修正コードでは FAIL
    });

    // ============================================================
    // Bug Condition 1.2: property_address（問合せ住所）
    // ============================================================
    it('Bug Condition 1.2: property_address（問合せ住所）が .select() に含まれていない', () => {
      // counterexample: buyer.property_address === undefined
      // 根本原因: SQLクエリの .select() に property_address が含まれていないため、
      //           Supabase がこのカラムを返さず、フロントエンドで undefined → "-" と表示される
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // 未修正コードでは property_address が含まれていないため FAIL する
      expect(selectBlock).toContain('property_address'); // ← 未修正コードでは FAIL
    });

    // ============================================================
    // Bug Condition 1.3: inquiry_price（価格）
    // ============================================================
    it('Bug Condition 1.3: inquiry_price（価格）が .select() に含まれていない', () => {
      // counterexample: buyer.inquiry_price === undefined
      // 根本原因: SQLクエリの .select() に inquiry_price が含まれていないため、
      //           Supabase がこのカラムを返さず、フロントエンドで undefined → "-" と表示される
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // 未修正コードでは inquiry_price が含まれていないため FAIL する
      expect(selectBlock).toContain('inquiry_price'); // ← 未修正コードでは FAIL
    });

    // ============================================================
    // Bug Condition 1.4: inquiry_hearing（ヒアリング）
    // ============================================================
    it('Bug Condition 1.4: inquiry_hearing（ヒアリング）が .select() に含まれていない', () => {
      // counterexample: buyer.inquiry_hearing === undefined
      // 根本原因: SQLクエリの .select() に inquiry_hearing が含まれていないため、
      //           Supabase がこのカラムを返さず、フロントエンドで undefined → "-" と表示される
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // 未修正コードでは inquiry_hearing が含まれていないため FAIL する
      expect(selectBlock).toContain('inquiry_hearing'); // ← 未修正コードでは FAIL
    });

    // ============================================================
    // Bug Condition 1.5: viewing_result_follow_up（内覧結果フォローアップ）
    // ============================================================
    it('Bug Condition 1.5: viewing_result_follow_up（内覧結果フォローアップ）が .select() に含まれていない', () => {
      // counterexample: buyer.viewing_result_follow_up === undefined
      // 根本原因: SQLクエリの .select() に viewing_result_follow_up が含まれていないため、
      //           Supabase がこのカラムを返さず、フロントエンドで undefined → "-" と表示される
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // 未修正コードでは viewing_result_follow_up が含まれていないため FAIL する
      expect(selectBlock).toContain('viewing_result_follow_up'); // ← 未修正コードでは FAIL
    });

    // ============================================================
    // Bug Condition 1.6: latest_status（最新状況）
    // ============================================================
    it('Bug Condition 1.6: latest_status（最新状況）が .select() に含まれている（既存フィールド）', () => {
      // latest_status は既にクエリに含まれているため、このテストは PASS する
      // 設計ドキュメントの確認: latest_status と latest_viewing_date は既存フィールド
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // latest_status は既に含まれているため PASS する
      expect(selectBlock).toContain('latest_status');
    });

    // ============================================================
    // Bug Condition 1.7: latest_viewing_date（内覧日）
    // ============================================================
    it('Bug Condition 1.7: latest_viewing_date（内覧日）が .select() に含まれている（既存フィールド）', () => {
      // latest_viewing_date は既にクエリに含まれているため、このテストは PASS する
      // 設計ドキュメントの確認: latest_status と latest_viewing_date は既存フィールド
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      // latest_viewing_date は既に含まれているため PASS する
      expect(selectBlock).toContain('latest_viewing_date');
    });
  });

  // ============================================================
  // バグ条件の一括確認: 5つの欠けているフィールドを一度に検証
  // ============================================================
  describe('Bug Condition 一括確認: 欠けている5フィールドの全体検証', () => {
    it('Bug Condition: 5つの必要フィールドが全て .select() に含まれていない（修正後は PASS する）', () => {
      // isBugCondition(apiResponse) の形式的仕様:
      // RETURN EXISTS buyer IN apiResponse WHERE
      //   buyer.inquiry_property_type IS undefined
      //   AND buyer.property_address IS undefined
      //   AND buyer.inquiry_price IS undefined
      //   AND buyer.inquiry_hearing IS undefined
      //   AND buyer.viewing_result_follow_up IS undefined
      //
      // 静的解析: .select() に5フィールドが含まれていないことを確認

      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);
      expect(selectBlock).not.toBeNull();

      const missingFields: string[] = [];

      // 欠けているフィールドを収集
      const requiredFields = [
        'inquiry_property_type',
        'property_address',
        'inquiry_price',
        'inquiry_hearing',
        'viewing_result_follow_up',
      ];

      for (const field of requiredFields) {
        if (!selectBlock!.includes(field)) {
          missingFields.push(field);
        }
      }

      // counterexample を出力
      if (missingFields.length > 0) {
        console.log('=== counterexample: 欠けているフィールド ===');
        for (const field of missingFields) {
          console.log(`  buyer.${field} === undefined（DBに値があっても undefined が返る）`);
        }
        console.log('=== 根本原因 ===');
        console.log('  getBuyersByAreas() の .select() に以下のフィールドが含まれていない:');
        for (const field of missingFields) {
          console.log(`    - ${field}`);
        }
        console.log('  Supabase はクエリで指定されたカラムのみを返すため、');
        console.log('  フロントエンドでは undefined → "-" と表示される。');
      }

      // 修正後は全フィールドが含まれるため missingFields.length === 0 になる
      // 未修正コードでは missingFields.length > 0 のため FAIL する
      expect(missingFields).toHaveLength(0); // ← 未修正コードでは FAIL
    });
  });

  // ============================================================
  // counterexample の記録
  // ============================================================
  describe('counterexample の記録', () => {
    it('counterexample: 現在の .select() の内容を出力して記録する', () => {
      const selectBlock = extractGetBuyersByAreasSelectBlock(buyerServiceSource);

      console.log('=== getBuyersByAreas() の現在の .select() 内容 ===');
      console.log(selectBlock ?? '（抽出失敗）');
      console.log('=== counterexample 終了 ===');
      console.log('');
      console.log('バグの影響:');
      console.log('  通話モードページ（/sellers/:id/call）の「近隣買主候補」テーブルで');
      console.log('  以下のフィールドが全て "-" と表示される:');
      console.log('    - 種別（inquiry_property_type）');
      console.log('    - 問合せ住所（property_address）');
      console.log('    - 価格（inquiry_price）');
      console.log('    - ヒアリング（inquiry_hearing）');
      console.log('    - 内覧結果フォローアップ（viewing_result_follow_up）');
      console.log('');
      console.log('修正方法:');
      console.log('  getBuyersByAreas() の .select() に上記5フィールドを追加する');

      // このテストは常に PASS（記録目的）
      expect(selectBlock).not.toBeNull();
    });
  });
});
