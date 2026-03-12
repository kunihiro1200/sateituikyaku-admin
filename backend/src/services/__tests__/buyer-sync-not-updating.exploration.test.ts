// 買主リスト自動同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - スプレッドシートの買主番号がDBに追加されない
// **Validates: Requirements 1.1, 1.2, 1.3**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示すカウンターサンプルを発見する

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// ============================================================
// 根本原因調査: 静的コード解析によるバグ条件の特定
// ============================================================

describe('バグ条件探索: スプレッドシートの買主番号がDBに追加されない', () => {
  const buyerSyncServicePath = path.resolve(__dirname, '../BuyerSyncService.ts');
  const migrationPath = path.resolve(
    __dirname,
    '../../../migrations/094_add_buyer_number_unique_constraint.sql'
  );
  const columnMappingPath = path.resolve(__dirname, '../../config/buyer-column-mapping.json');

  let buyerSyncServiceSource: string;
  let migrationSource: string;
  let columnMapping: any;

  beforeAll(() => {
    buyerSyncServiceSource = fs.readFileSync(buyerSyncServicePath, 'utf-8');
    migrationSource = fs.readFileSync(migrationPath, 'utf-8');
    columnMapping = JSON.parse(fs.readFileSync(columnMappingPath, 'utf-8'));
  });

  // ============================================================
  // 調査1: buyer_number UNIQUE制約の適用状況
  // ============================================================
  describe('根本原因調査1: buyer_number UNIQUE制約', () => {
    it('マイグレーションファイル094が存在する', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('マイグレーションファイルにUNIQUE制約の追加SQLが含まれる', () => {
      expect(migrationSource).toContain(
        'ADD CONSTRAINT buyers_buyer_number_unique UNIQUE (buyer_number)'
      );
    });

    it('BuyerSyncService.processBatch() が onConflict: buyer_number でupsertを実行している', () => {
      expect(buyerSyncServiceSource).toContain("onConflict: 'buyer_number'");
    });

    it('Fix Verified: upsertエラー時に error.code と error.details が記録される（修正済み）', () => {
      // 修正後: error.code と error.details がログに含まれている
      // UNIQUE制約エラー（42P10）等の根本原因が特定できるようになった
      const hasErrorCode = buyerSyncServiceSource.includes('error.code');
      const hasErrorDetails = buyerSyncServiceSource.includes('error.details');

      // 修正後はこれらが含まれるため、PASSする
      expect(hasErrorCode).toBe(true);    // ← 修正後はPASS
      expect(hasErrorDetails).toBe(true); // ← 修正後はPASS
    });
  });

  // ============================================================
  // 調査2: buyer_number カラムマッピングの確認
  // ============================================================
  describe('根本原因調査2: buyer_number カラムマッピング', () => {
    it('buyer-column-mapping.json に 買主番号 → buyer_number マッピングが存在する', () => {
      const mapping = columnMapping.spreadsheetToDatabase;
      expect(mapping['買主番号']).toBe('buyer_number');
    });

    it('BuyerColumnMapper が 買主番号 を buyer_number にマッピングする', () => {
      const { BuyerColumnMapper } = require('../BuyerColumnMapper');
      const mapper = new BuyerColumnMapper();

      const headers = ['買主番号', '●氏名・会社名', '受付日'];
      const row = ['7137', 'テスト太郎', '2026/01/01'];

      const result = mapper.mapSpreadsheetToDatabase(headers, row);

      // マッピングが正しければ buyer_number が '7137' になる
      expect(result.buyer_number).toBe('7137');
    });

    it('buyer_number が空文字の場合は null にマッピングされる（スキップ対象）', () => {
      const { BuyerColumnMapper } = require('../BuyerColumnMapper');
      const mapper = new BuyerColumnMapper();

      const headers = ['買主番号', '●氏名・会社名'];
      const row = ['', 'テスト太郎'];

      const result = mapper.mapSpreadsheetToDatabase(headers, row);

      // 空の buyer_number は null になる
      expect(result.buyer_number).toBeNull();
    });
  });

  // ============================================================
  // 調査3: スプレッドシート取得範囲の確認
  // ============================================================
  describe('根本原因調査3: スプレッドシート取得範囲', () => {
    it('BuyerSyncService がデータ取得に A2:GZ 範囲を使用している', () => {
      // テンプレートリテラル内の文字列を確認
      const hasRange = buyerSyncServiceSource.includes('A2:GZ');
      expect(hasRange).toBe(true);
    });

    it('GZ列（列208）は181カラムをカバーするのに十分な範囲である', () => {
      // GZ = G(7) * 26 + Z(26) = 208列目（0-indexed: 207）
      // 181カラムは208列以内に収まる
      const columnLetterToIndex = (letter: string): number => {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
          result = result * 26 + (letter.charCodeAt(i) - 64);
        }
        return result - 1; // 0-indexed
      };

      const gzIndex = columnLetterToIndex('GZ');
      expect(gzIndex).toBeGreaterThanOrEqual(181);
    });

    it('BuyerSyncService のコメントに 181カラム対応 と記載されている', () => {
      expect(buyerSyncServiceSource).toContain('181カラム対応');
    });
  });

  // ============================================================
  // バグ条件テスト: Property 1 - Bug Condition
  // スプレッドシートの買主番号がDBに追加されない
  // ============================================================
  describe('Property 1: Bug Condition - upsertのinsert部分が機能しない', () => {
    it('Bug Condition: processBatch() のupsertエラー時に error.code が記録されない', () => {
      // 根本原因: buyer_number UNIQUE制約がDBに適用されていない場合、
      // onConflict: 'buyer_number' を指定したupsertはエラーになる
      //
      // Supabase の upsert は以下の動作をする:
      // - UNIQUE制約が存在する場合: INSERT ... ON CONFLICT (buyer_number) DO UPDATE
      // - UNIQUE制約が存在しない場合: エラー（42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification）
      //
      // 現在のコードはエラーを result.failed にカウントするが、
      // error.code を記録しないため、このエラーが発生していても気づけない

      // バグ条件のカウンターサンプル:
      // 「upsertエラー時にerror.codeが記録されないため、UNIQUE制約エラー（42P10）が検出できない」
      const hasErrorCode = buyerSyncServiceSource.includes('error.code');

      // 未修正コードでは error.code が含まれていないため、このアサーションはFAIL
      // これがバグ条件のカウンターサンプル
      expect(hasErrorCode).toBe(true);
    });

    it('Bug Condition: processBatch() のupsertエラーログに error.details が含まれない', () => {
      // error.details がないため、PostgreSQLの詳細エラー情報が失われる
      // 修正後は error.details も記録される
      const hasErrorDetails = buyerSyncServiceSource.includes('error.details');

      // 未修正コードでは error.details が含まれていないため、このアサーションはFAIL
      expect(hasErrorDetails).toBe(true);
    });
  });

  // ============================================================
  // プロパティベーステスト: buyer_number マッピングの一貫性
  // ============================================================
  describe('Property-Based: buyer_number マッピングの一貫性', () => {
    it('任意の買主番号文字列が BuyerColumnMapper によって正しくマッピングされる', () => {
      const { BuyerColumnMapper } = require('../BuyerColumnMapper');
      const mapper = new BuyerColumnMapper();

      fc.assert(
        fc.property(
          // 買主番号は数字文字列（例: 7137）
          fc.nat({ max: 9999 }).map(n => String(n + 1)), // 1〜9999
          (buyerNumber) => {
            const headers = ['買主番号', '●氏名・会社名'];
            const row = [buyerNumber, 'テスト'];

            const result = mapper.mapSpreadsheetToDatabase(headers, row);

            // buyer_number が正しくマッピングされる
            return result.buyer_number === buyerNumber;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空文字の買主番号は null にマッピングされ、スキップ対象となる', () => {
      const { BuyerColumnMapper } = require('../BuyerColumnMapper');
      const mapper = new BuyerColumnMapper();

      // 空文字列 '' は convertValue で null になる
      const headers = ['買主番号', '●氏名・会社名'];
      const emptyRow = ['', 'テスト'];
      const result = mapper.mapSpreadsheetToDatabase(headers, emptyRow);
      expect(result.buyer_number).toBeNull();
    });

    it('スペースのみの買主番号は空文字列にトリムされ、processBatch でスキップされる', () => {
      const { BuyerColumnMapper } = require('../BuyerColumnMapper');
      const mapper = new BuyerColumnMapper();

      // '   ' は convertValue で String(value).trim() → '' になる
      // ただし convertValue の先頭チェックは value === '' のみなので、
      // '   ' は '' にトリムされた文字列として返る
      // processBatch では String(data.buyer_number).trim() === '' でスキップされる
      const headers = ['買主番号', '●氏名・会社名'];
      const spaceRow = ['   ', 'テスト'];
      const result = mapper.mapSpreadsheetToDatabase(headers, spaceRow);

      // スペースのみは trim() で '' になる → processBatch でスキップ対象
      const buyerNumber = result.buyer_number;
      const wouldBeSkipped = !buyerNumber || String(buyerNumber).trim() === '';
      expect(wouldBeSkipped).toBe(true);
    });
  });

  // ============================================================
  // 根本原因サマリー
  // ============================================================
  describe('根本原因サマリー', () => {
    it('根本原因1（修正済み）: upsertエラー時に error.code が記録される', () => {
      // 修正後: error.code が含まれるため、UNIQUE制約エラー（42P10）が検出できる
      const hasErrorCode = buyerSyncServiceSource.includes('error.code');
      expect(hasErrorCode).toBe(true); // ← 修正後はPASS
    });

    it('根本原因2: buyer_number カラムマッピングは正しい（この原因ではない）', () => {
      expect(columnMapping.spreadsheetToDatabase['買主番号']).toBe('buyer_number');
    });

    it('根本原因3: スプレッドシート取得範囲 A2:GZ は十分（この原因ではない）', () => {
      expect(buyerSyncServiceSource).toContain('A2:GZ');
    });

    it('根本原因4: マイグレーション094のSQLは正しく定義されている（適用状況は別途確認が必要）', () => {
      expect(migrationSource).toContain(
        'ADD CONSTRAINT buyers_buyer_number_unique UNIQUE (buyer_number)'
      );
    });
  });
});
