/**
 * buildLedgerSheetUrl のプロパティベーステスト
 *
 * **Feature: business-detail-spreadsheet-link**
 * **Property 3: URL生成の冪等性（gid付加の一意性）**
 * **Property 4: URL生成の冪等性（二重適用）**
 */

import * as fc from 'fast-check';
import { buildLedgerSheetUrl, LEDGER_SHEET_GID } from '../spreadsheetUrl';

/**
 * 有効なスプレッドシートIDを生成するアービトラリ
 * Google SpreadsheetのIDは英数字・ハイフン・アンダースコアで構成される
 */
const spreadsheetIdArbitrary = fc
  .array(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
    { minLength: 10, maxLength: 44 }
  )
  .map((chars) => chars.join(''));

/**
 * 任意のgid値を生成するアービトラリ（数字のみ）
 */
const gidArbitrary = fc.nat({ max: 999999999 }).map(String);

/**
 * 有効なGoogleスプレッドシートURLを生成するアービトラリ
 * 以下のパターンを生成する:
 * - https://docs.google.com/spreadsheets/d/{ID}/edit
 * - https://docs.google.com/spreadsheets/d/{ID}/edit#gid={任意のgid}
 * - https://docs.google.com/spreadsheets/d/{ID}/edit?gid={任意のgid}#gid={任意のgid}
 */
const validSpreadsheetUrlArbitrary = fc.oneof(
  // パターン1: /edit のみ
  spreadsheetIdArbitrary.map(
    (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`
  ),
  // パターン2: #gid=XXXXX 付き
  fc.tuple(spreadsheetIdArbitrary, gidArbitrary).map(
    ([id, gid]) => `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}`
  ),
  // パターン3: ?gid=XXXXX#gid=XXXXX 付き
  fc.tuple(spreadsheetIdArbitrary, gidArbitrary, gidArbitrary).map(
    ([id, qgid, hgid]) =>
      `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${qgid}#gid=${hgid}`
  ),
);

describe('buildLedgerSheetUrl - Property-Based Tests', () => {
  /**
   * Property 3: URL生成の冪等性（gid付加の一意性）
   *
   * *For any* 有効なGoogleスプレッドシートURL（#gid= あり・なし・?gid= あり・なし の任意の組み合わせ）に対して、
   * buildLedgerSheetUrl を適用した結果は常に #gid=78322744 で終わり、かつ #gid= が1つだけ含まれる。
   *
   * **Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4**
   */
  describe('Property 3: URL生成の冪等性（gid付加の一意性）', () => {
    it('結果は常に #gid=78322744 で終わり、#gid= が1つだけ含まれる', () => {
      fc.assert(
        fc.property(validSpreadsheetUrlArbitrary, (url) => {
          const result = buildLedgerSheetUrl(url);
          const gidCount = (result.match(/#gid=/g) || []).length;
          return (
            result.endsWith(`#gid=${LEDGER_SHEET_GID}`) && gidCount === 1
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: URL生成の冪等性（二重適用）
   *
   * *For any* 有効なGoogleスプレッドシートURLに対して、
   * buildLedgerSheetUrl を2回適用した結果は1回適用した結果と等しい（冪等性）。
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 4: URL生成の冪等性（二重適用）', () => {
    it('2回適用した結果は1回適用した結果と等しい', () => {
      fc.assert(
        fc.property(validSpreadsheetUrlArbitrary, (url) => {
          const once = buildLedgerSheetUrl(url);
          const twice = buildLedgerSheetUrl(once);
          return once === twice;
        }),
        { numRuns: 100 }
      );
    });
  });
});
