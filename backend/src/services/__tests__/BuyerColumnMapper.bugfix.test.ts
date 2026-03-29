/**
 * BuyerColumnMapper バグ条件探索テスト
 *
 * バグ条件:
 * 1. viewing_time (time型) のDB→スプシ変換が未実装のため空欄になる
 * 2. latest_viewing_date (date型) がUTC解釈でタイムゾーンずれを起こす
 *
 * このテストは未修正コードで FAIL する（バグの存在を証明）
 * 修正後に PASS することで修正を検証する
 */

import { BuyerColumnMapper } from '../BuyerColumnMapper';

describe('BuyerColumnMapper.formatValueForSpreadsheet - バグ条件探索', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  // formatValueForSpreadsheetはprivateなので、mapDatabaseToSpreadsheetを通してテスト
  const callFormatValue = (mapper: BuyerColumnMapper, column: string, value: any) => {
    const result = (mapper as any).formatValueForSpreadsheet(column, value);
    return result;
  };

  describe('バグ条件A: viewing_time (time型) の変換', () => {
    it('viewing_time "10:00" をスプシ形式に変換できること（未修正コードでは型処理なし）', () => {
      // Validates: Requirements 2.1
      const result = callFormatValue(mapper, 'viewing_time', '10:00');
      expect(result).toBe('10:00');
    });

    it('viewing_time "14:30" をスプシ形式に変換できること', () => {
      const result = callFormatValue(mapper, 'viewing_time', '14:30');
      expect(result).toBe('14:30');
    });

    it('viewing_time null は空文字を返すこと', () => {
      const result = callFormatValue(mapper, 'viewing_time', null);
      expect(result).toBe('');
    });

    it('viewing_time undefined は空文字を返すこと', () => {
      const result = callFormatValue(mapper, 'viewing_time', undefined);
      expect(result).toBe('');
    });
  });

  describe('バグ条件B: latest_viewing_date (date型) のタイムゾーンずれ', () => {
    it('latest_viewing_date "2026-03-29" がタイムゾーンずれなく "2026/03/29" に変換されること', () => {
      // Validates: Requirements 2.2
      // 未修正コードでは new Date("2026-03-29") がUTC 00:00として解釈され
      // UTC-X環境では "2026/03/28" になる可能性がある
      const result = callFormatValue(mapper, 'latest_viewing_date', '2026-03-29');
      expect(result).toBe('2026/03/29');
    });

    it('latest_viewing_date "2026-01-01" がタイムゾーンずれなく "2026/01/01" に変換されること', () => {
      const result = callFormatValue(mapper, 'latest_viewing_date', '2026-01-01');
      expect(result).toBe('2026/01/01');
    });

    it('latest_viewing_date "2026-12-31" がタイムゾーンずれなく "2026/12/31" に変換されること', () => {
      const result = callFormatValue(mapper, 'latest_viewing_date', '2026-12-31');
      expect(result).toBe('2026/12/31');
    });

    it('latest_viewing_date null は空文字を返すこと', () => {
      const result = callFormatValue(mapper, 'latest_viewing_date', null);
      expect(result).toBe('');
    });
  });
});
