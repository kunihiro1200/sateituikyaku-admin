/**
 * バグ条件探索テスト: mergeAngleBracketPlaceholders() の内覧前伝達事項バグ
 *
 * このテストは未修正コードでバグを再現し、根本原因を確認するためのものです。
 *
 * バグ条件:
 *   EmailTemplateService.mergeAngleBracketPlaceholders() の末尾で
 *   `<<内覧前伝達事項v>>` が無条件に空文字へ置換されている。
 *   buyer.pre_viewing_notes に値が入っていても、その値を参照せずに空文字で上書きする。
 *
 * 未修正コードでは:
 *   - テスト「内覧前伝達事項の値が結果に含まれること」は FAIL する
 *     （`<<内覧前伝達事項v>>` が空文字に置換されるため）
 *   - これがバグの存在を証明する
 *
 * Validates: Requirements 2.1
 */

import { EmailTemplateService } from '../EmailTemplateService';

describe('バグ条件探索: mergeAngleBracketPlaceholders() の内覧前伝達事項バグ', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  describe('テストシナリオ1: pre_viewing_notes に値がある場合', () => {
    it('内覧前伝達事項の値が結果に含まれること（未修正コードでは FAIL）', () => {
      // Arrange
      const template = '<<氏名>>様\n\n内覧前のご確認事項:\n<<内覧前伝達事項v>>\n\nよろしくお願いします。';
      const buyer = {
        name: '田中太郎',
        pre_viewing_notes: '駐車場は右側',
      };
      const properties = [
        {
          propertyNumber: 'AA12345',
          address: '大分市中央町1-2-3',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 内覧前伝達事項の値が結果に含まれること
      // 未修正コードでは `<<内覧前伝達事項v>>` が空文字に置換されるため、この expect は FAIL する
      // → これがバグの存在を証明する
      expect(result).toContain('駐車場は右側');
    });
  });

  describe('テストシナリオ2: pre_viewing_notes に別の値がある場合', () => {
    it('内覧前伝達事項の値が結果に含まれること（未修正コードでは FAIL）', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '山田花子',
        pre_viewing_notes: '玄関の暗証番号は1234です',
      };
      const properties = [
        {
          propertyNumber: 'BB67890',
          address: '大分市府内町2-3-4',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 内覧前伝達事項の値が結果に含まれること
      // 未修正コードでは `<<内覧前伝達事項v>>` が空文字に置換されるため、この expect は FAIL する
      expect(result).toContain('玄関の暗証番号は1234です');
    });
  });

  describe('テストシナリオ3: pre_viewing_notes が空の場合（バグ条件に該当しない）', () => {
    it('<<内覧前伝達事項v>> が空文字に置換されること（未修正コードでも PASS）', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '鈴木一郎',
        pre_viewing_notes: '',
      };
      const properties = [
        {
          propertyNumber: 'CC11111',
          address: '大分市春日町3-4-5',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 空文字に置換されること（既存動作の維持）
      expect(result).not.toContain('<<内覧前伝達事項v>>');
    });
  });

  describe('テストシナリオ4: pre_viewing_notes が未定義の場合（バグ条件に該当しない）', () => {
    it('<<内覧前伝達事項v>> が空文字に置換されること（未修正コードでも PASS）', () => {
      // Arrange
      const template = '<<氏名>>様\n\n<<内覧前伝達事項v>>';
      const buyer = {
        name: '佐藤次郎',
        // pre_viewing_notes は未定義
      };
      const properties = [
        {
          propertyNumber: 'DD22222',
          address: '大分市大手町4-5-6',
        },
      ];

      // Act
      const result = service.mergeAngleBracketPlaceholders(template, buyer, properties);

      // Assert: 空文字に置換されること（既存動作の維持）
      expect(result).not.toContain('<<内覧前伝達事項v>>');
    });
  });
});
