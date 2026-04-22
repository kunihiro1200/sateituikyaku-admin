/**
 * buildLedgerSheetUrl のユニットテスト
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import { buildLedgerSheetUrl, LEDGER_SHEET_GID } from '../spreadsheetUrl';

describe('buildLedgerSheetUrl', () => {
  describe('基本ケース（設計書テーブルの4ケース）', () => {
    it('ケース1: /edit のみのURL → #gid=78322744 を付加する', () => {
      const input = 'https://docs.google.com/spreadsheets/d/ABC/edit';
      const expected = 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744';
      expect(buildLedgerSheetUrl(input)).toBe(expected);
    });

    it('ケース2: #gid=99999 付きURL → 既存gidを除去して台帳gidを付加する', () => {
      const input = 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=99999';
      const expected = 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744';
      expect(buildLedgerSheetUrl(input)).toBe(expected);
    });

    it('ケース3: ?gid=99999#gid=99999 付きURL → クエリとハッシュ両方を除去して台帳gidを付加する', () => {
      const input = 'https://docs.google.com/spreadsheets/d/ABC/edit?gid=99999#gid=99999';
      const expected = 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744';
      expect(buildLedgerSheetUrl(input)).toBe(expected);
    });

    it('ケース4: URLとして解析できない文字列 → そのまま返す（フォールバック）', () => {
      const input = 'not-a-url';
      expect(buildLedgerSheetUrl(input)).toBe('not-a-url');
    });
  });

  describe('エッジケース', () => {
    it('既に台帳gidが付いているURL → 変わらず同じURLを返す', () => {
      const input = `https://docs.google.com/spreadsheets/d/ABC/edit#gid=${LEDGER_SHEET_GID}`;
      expect(buildLedgerSheetUrl(input)).toBe(input);
    });

    it('/edit/xxx のような余分なパスを除去する', () => {
      const input = 'https://docs.google.com/spreadsheets/d/ABC/edit/something';
      const expected = 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744';
      expect(buildLedgerSheetUrl(input)).toBe(expected);
    });

    it('gid以外のクエリパラメータは保持する', () => {
      const input = 'https://docs.google.com/spreadsheets/d/ABC/edit?foo=bar&gid=99999';
      const result = buildLedgerSheetUrl(input);
      expect(result).toContain('foo=bar');
      expect(result).not.toContain('gid=99999');
      expect(result).toContain(`#gid=${LEDGER_SHEET_GID}`);
    });

    it('空文字列 → そのまま返す（URL解析失敗）', () => {
      expect(buildLedgerSheetUrl('')).toBe('');
    });
  });

  describe('LEDGER_SHEET_GID 定数', () => {
    it('LEDGER_SHEET_GID は "78322744" である', () => {
      expect(LEDGER_SHEET_GID).toBe('78322744');
    });
  });
});
