// AA6コメント同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - commentsフィールドのmapToSheetマッピング欠落
// **Validates: Requirements 1.1, 1.2**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示す counterexample を発見する

import { ColumnMapper } from '../ColumnMapper';

describe('バグ条件探索: ColumnMapper.mapToSheet() が comments フィールドを SheetRow に含めない', () => {
  let mapper: ColumnMapper;

  beforeEach(() => {
    mapper = new ColumnMapper();
  });

  // ============================================================
  // テストケース1: comments に非空文字列を持つ SellerData
  // ============================================================
  describe('Property 1: Bug Condition - comments フィールドのマッピング', () => {
    it('Bug Condition: { comments: "テストコメント" } を mapToSheet() に渡すと sheetRow["コメント"] === "テストコメント" になるべき（未修正コードでは FAIL）', () => {
      // Arrange
      const sellerData = {
        name: 'テスト太郎',
        address: '大分市中央町1-1-1',
        phone_number: '090-1234-5678',
        status: '追客中',
        comments: 'テストコメント',
      };

      // Act
      const sheetRow = mapper.mapToSheet(sellerData);

      // Assert
      // 未修正コードでは sheetRow['コメント'] が undefined または '' になる
      // これが counterexample: comments フィールドがマッピングされていない証拠
      console.log('=== counterexample 記録 ===');
      console.log('入力: comments =', sellerData.comments);
      console.log('出力: sheetRow["コメント"] =', sheetRow['コメント']);
      console.log('期待値: "テストコメント"');
      console.log('実際値:', JSON.stringify(sheetRow['コメント']));
      console.log('=== counterexample 終了 ===');

      expect(sheetRow['コメント']).toBe('テストコメント'); // ← 未修正コードでは FAIL の可能性
    });

    it('Bug Condition: { comments: "再電話不要" } を mapToSheet() に渡すと sheetRow["コメント"] === "再電話不要" になるべき（未修正コードでは FAIL）', () => {
      // Arrange
      const sellerData = {
        name: 'テスト太郎',
        address: '大分市中央町1-1-1',
        phone_number: '090-1234-5678',
        status: '追客中',
        comments: '再電話不要',
      };

      // Act
      const sheetRow = mapper.mapToSheet(sellerData);

      // Assert
      console.log('=== counterexample 記録 ===');
      console.log('入力: comments =', sellerData.comments);
      console.log('出力: sheetRow["コメント"] =', sheetRow['コメント']);
      console.log('期待値: "再電話不要"');
      console.log('実際値:', JSON.stringify(sheetRow['コメント']));
      console.log('=== counterexample 終了 ===');

      expect(sheetRow['コメント']).toBe('再電話不要'); // ← 未修正コードでは FAIL の可能性
    });

    it('Bug Condition: { comments: null } を mapToSheet() に渡すと sheetRow["コメント"] === "" になるべき（nullは空文字になるはず）', () => {
      // Arrange
      const sellerData = {
        name: 'テスト太郎',
        address: '大分市中央町1-1-1',
        phone_number: '090-1234-5678',
        status: '追客中',
        comments: null as any,
      };

      // Act
      const sheetRow = mapper.mapToSheet(sellerData);

      // Assert
      console.log('=== counterexample 記録 ===');
      console.log('入力: comments =', sellerData.comments);
      console.log('出力: sheetRow["コメント"] =', sheetRow['コメント']);
      console.log('期待値: "" (空文字)');
      console.log('実際値:', JSON.stringify(sheetRow['コメント']));
      console.log('=== counterexample 終了 ===');

      // null の場合は空文字になるはず（mapToSheet の null 処理に基づく）
      expect(sheetRow['コメント']).toBe(''); // ← null は '' に変換されるはず
    });
  });

  // ============================================================
  // 根本原因調査: column-mapping.json の databaseToSpreadsheet に comments が含まれているか
  // ============================================================
  describe('根本原因調査: column-mapping.json の databaseToSpreadsheet セクション', () => {
    it('getMappingConfig() の dbToSpreadsheet に "comments" キーが存在するか確認', () => {
      const config = mapper.getMappingConfig();
      const dbToSpreadsheet = config.dbToSpreadsheet;

      console.log('=== databaseToSpreadsheet の "comments" キー確認 ===');
      console.log('comments キーの存在:', 'comments' in dbToSpreadsheet);
      console.log('comments の値:', dbToSpreadsheet['comments']);
      console.log('=== 確認終了 ===');

      // column-mapping.json に "comments": "コメント" が定義されているか確認
      expect(dbToSpreadsheet['comments']).toBe('コメント');
    });

    it('mapToSheet() が返す SheetRow に "コメント" キーが存在するか確認（全フィールドを出力）', () => {
      const sellerData = {
        name: 'テスト太郎',
        address: '大分市中央町1-1-1',
        phone_number: '090-1234-5678',
        status: '追客中',
        comments: '訪問希望あり',
      };

      const sheetRow = mapper.mapToSheet(sellerData);

      console.log('=== mapToSheet() の出力（全フィールド） ===');
      const keys = Object.keys(sheetRow);
      console.log('SheetRow のキー一覧:', keys);
      console.log('"コメント" キーの存在:', 'コメント' in sheetRow);
      console.log('"コメント" の値:', sheetRow['コメント']);
      console.log('=== 出力終了 ===');

      // "コメント" キーが SheetRow に存在するか確認
      expect('コメント' in sheetRow).toBe(true);
      expect(sheetRow['コメント']).toBe('訪問希望あり');
    });
  });

  // ============================================================
  // isBugCondition の形式的仕様に基づくテスト
  // ============================================================
  describe('形式的仕様: isBugCondition(input) の検証', () => {
    it('isBugCondition: comments が非空文字列の場合、sheetRow["コメント"] が null または "" であればバグ', () => {
      // 設計ドキュメントの形式的仕様:
      // RETURN input.comments IS NOT NULL
      //        AND input.comments IS NOT EMPTY
      //        AND sheetRow['コメント'] IS NULL OR sheetRow['コメント'] = ''

      const testCases = [
        { comments: 'テストコメント', expected: 'テストコメント' },
        { comments: '再電話不要', expected: '再電話不要' },
        { comments: '訪問希望あり', expected: '訪問希望あり' },
      ];

      for (const testCase of testCases) {
        const sellerData = {
          name: 'テスト太郎',
          address: '大分市中央町1-1-1',
          phone_number: '090-1234-5678',
          comments: testCase.comments,
        };

        const sheetRow = mapper.mapToSheet(sellerData);
        const isBugCondition =
          testCase.comments !== null &&
          testCase.comments !== '' &&
          (sheetRow['コメント'] === null || sheetRow['コメント'] === '' || sheetRow['コメント'] === undefined);

        console.log(`comments="${testCase.comments}" → sheetRow["コメント"]="${sheetRow['コメント']}" → isBugCondition=${isBugCondition}`);

        // バグが存在する場合、isBugCondition は true になる
        // このアサーションは「バグが存在しないこと」を期待する
        // 未修正コードでバグがあれば FAIL する
        expect(isBugCondition).toBe(false); // ← バグがあれば FAIL
        expect(sheetRow['コメント']).toBe(testCase.expected);
      }
    });
  });
});
