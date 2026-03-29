/**
 * BuyerColumnMapper 保持プロパティテスト
 *
 * 修正によって変更してはいけない既存の動作を検証する。
 * このテストは未修正コードで PASS し、修正後も PASS し続けること。
 */

import { BuyerColumnMapper } from '../BuyerColumnMapper';

describe('BuyerColumnMapper.formatValueForSpreadsheet - 保持プロパティ', () => {
  let mapper: BuyerColumnMapper;

  beforeEach(() => {
    mapper = new BuyerColumnMapper();
  });

  const callFormatValue = (mapper: BuyerColumnMapper, column: string, value: any) => {
    return (mapper as any).formatValueForSpreadsheet(column, value);
  };

  describe('保持1: 既存date型フィールドの変換継続', () => {
    // Validates: Requirements 3.3
    it('reception_date "2026-01-15" が "2026/01/15" に変換されること', () => {
      const result = callFormatValue(mapper, 'reception_date', '2026-01-15');
      expect(result).toBe('2026/01/15');
    });

    it('next_call_date "2026-03-01" が "2026/03/01" に変換されること', () => {
      const result = callFormatValue(mapper, 'next_call_date', '2026-03-01');
      expect(result).toBe('2026/03/01');
    });

    it('campaign_date "2025-12-31" が "2025/12/31" に変換されること', () => {
      const result = callFormatValue(mapper, 'campaign_date', '2025-12-31');
      expect(result).toBe('2025/12/31');
    });

    it('date型フィールドのnullは空文字を返すこと', () => {
      expect(callFormatValue(mapper, 'reception_date', null)).toBe('');
      expect(callFormatValue(mapper, 'next_call_date', null)).toBe('');
    });
  });

  describe('保持2: HTMLフィールドのストリップ処理継続', () => {
    // Validates: Requirements 3.4
    it('inquiry_hearing のHTMLタグがストリップされること', () => {
      const result = callFormatValue(mapper, 'inquiry_hearing', '<p>テスト内容</p>');
      expect(result).toBe('テスト内容');
    });

    it('viewing_result_follow_up のHTMLタグがストリップされること', () => {
      const result = callFormatValue(mapper, 'viewing_result_follow_up', '<p>内覧結果</p>');
      expect(result).toBe('内覧結果');
    });

    it('message_to_assignee のHTMLタグがストリップされること', () => {
      const result = callFormatValue(mapper, 'message_to_assignee', '<p>伝言内容</p>');
      expect(result).toBe('伝言内容');
    });

    it('HTMLを含まないinquiry_hearingはそのまま返ること', () => {
      const result = callFormatValue(mapper, 'inquiry_hearing', 'プレーンテキスト');
      expect(result).toBe('プレーンテキスト');
    });
  });

  describe('保持3: text型フィールドのパススルー継続', () => {
    // Validates: Requirements 3.4
    it('follow_up_assignee がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'follow_up_assignee', '担当者名')).toBe('担当者名');
    });

    it('pre_viewing_notes がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'pre_viewing_notes', '内覧前メモ')).toBe('内覧前メモ');
    });

    it('viewing_notes がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'viewing_notes', '内覧メモ')).toBe('内覧メモ');
    });

    it('seller_viewing_contact がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'seller_viewing_contact', '済')).toBe('済');
    });

    it('buyer_viewing_contact がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'buyer_viewing_contact', '未')).toBe('未');
    });

    it('notification_sender がそのまま返ること', () => {
      expect(callFormatValue(mapper, 'notification_sender', 'Y')).toBe('Y');
    });

    it('text型フィールドのnullは空文字を返すこと', () => {
      expect(callFormatValue(mapper, 'follow_up_assignee', null)).toBe('');
    });
  });
});
