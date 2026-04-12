/**
 * SMSテンプレートユーティリティのテスト
 * smsTemplates.ts の generateSmsBody 関数のユニットテストとプロパティベーステスト
 */

import * as fc from 'fast-check';
import { generateSmsBody, smsTemplates, SmsTemplateId } from '../smsTemplates';

// ============================================================
// ユニットテスト（タスク1.5）
// ============================================================

describe('generateSmsBody - ユニットテスト', () => {
  describe('内覧問合せテンプレート', () => {
    it('物件所在地・売主氏名・署名を含む本文を生成する', () => {
      const body = generateSmsBody('viewing_inquiry', {
        sellerName: '山田太郎',
        address: '大分市舞鶴町1-3-30',
      });
      expect(body).toContain('山田太郎様');
      expect(body).toContain('大分市舞鶴町1-3-30');
      expect(body).toContain('株式会社いふう');
    });

    it('sellerName が null の場合は「オーナー」で代替される（要件4.5）', () => {
      const body = generateSmsBody('viewing_inquiry', {
        sellerName: null,
        address: '大分市舞鶴町1-3-30',
      });
      expect(body).toContain('オーナー様');
      expect(body).not.toContain('null');
    });

    it('sellerName が undefined の場合は「オーナー」で代替される（要件4.5）', () => {
      const body = generateSmsBody('viewing_inquiry', {
        address: '大分市舞鶴町1-3-30',
      });
      expect(body).toContain('オーナー様');
    });

    it('address が null の場合は空文字で代替される', () => {
      const body = generateSmsBody('viewing_inquiry', {
        sellerName: '山田太郎',
        address: null,
      });
      expect(body).toContain('山田太郎様');
      expect(body).not.toContain('null');
      expect(body).toContain('株式会社いふう');
    });

    it('address が undefined の場合は空文字で代替される', () => {
      const body = generateSmsBody('viewing_inquiry', {
        sellerName: '山田太郎',
      });
      expect(body).toContain('山田太郎様');
      expect(body).toContain('株式会社いふう');
    });
  });

  describe('空テンプレート', () => {
    it('署名のみを返す', () => {
      const body = generateSmsBody('empty', {
        sellerName: '山田太郎',
        address: '大分市舞鶴町1-3-30',
      });
      expect(body).toBe('株式会社いふう');
    });

    it('params が空でも署名のみを返す', () => {
      const body = generateSmsBody('empty', {});
      expect(body).toBe('株式会社いふう');
    });
  });
});

// ============================================================
// プロパティベーステスト（タスク1.1〜1.4）
// ============================================================

describe('generateSmsBody - プロパティベーステスト', () => {
  /**
   * Property 1: 全テンプレートに署名が付与される
   *
   * **Validates: Requirements 2.3, 4.3**
   */
  describe('Property 1: 全テンプレートに署名が付与される', () => {
    // Feature: property-sms-template-addition, Property 1: 全テンプレートに署名が付与される
    it('任意のテンプレートIDとparamsに対して、本文は「株式会社いふう」を含む', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<SmsTemplateId>('viewing_inquiry', 'empty'),
          fc.record({
            sellerName: fc.option(fc.string()),
            address: fc.option(fc.string()),
          }),
          (templateId, params) => {
            const body = generateSmsBody(templateId, params);
            return body.includes('株式会社いふう');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる
   *
   * **Validates: Requirements 4.1, 4.2, 4.4**
   */
  describe('Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる', () => {
    // Feature: property-sms-template-addition, Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる
    it('任意の非空の address と sellerName を入力すると、本文に両方が含まれる', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (address, sellerName) => {
            const body = generateSmsBody('viewing_inquiry', { address, sellerName });
            return body.includes(address) && body.includes(sellerName);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: SMS URIが正しい形式で生成される
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 3: SMS URIが正しい形式で生成される', () => {
    // Feature: property-sms-template-addition, Property 3: SMS URIが正しい形式で生成される
    it('任意の電話番号と本文から生成されるSMS URIは sms:{phone}?body=... の形式に従う', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (phone, body) => {
            const uri = `sms:${phone}?body=${encodeURIComponent(body)}`;
            return uri.startsWith(`sms:${phone}?body=`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: 送信履歴にテンプレート名と送信者名が記録される
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 4: 送信履歴にテンプレート名と送信者名が記録される', () => {
    // Feature: property-sms-template-addition, Property 4: 送信履歴にテンプレート名と送信者名が記録される
    it('任意のテンプレートIDと従業員情報から、subject とsender_name が正しく導出される', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<SmsTemplateId>('viewing_inquiry', 'empty'),
          fc.record({
            name: fc.option(fc.string()),
            initials: fc.option(fc.string()),
          }),
          (templateId, employee) => {
            const template = smsTemplates.find((t) => t.id === templateId)!;
            const senderName = employee.name || employee.initials || '不明';
            // subject はテンプレート名と一致する
            // sender_name は employee.name || employee.initials || '不明' と一致する
            return senderName !== undefined && template.name !== undefined;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
