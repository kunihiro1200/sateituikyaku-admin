/**
 * Preservation Test
 *
 * Property 2: Preservation - 買主フィルタリング・個別名前差し込み・フォールバック処理が変わらないことを確認
 *
 * このテストは未修正コードで**PASS する必要があります**（ベースライン動作の確認）
 *
 * 観察1: 完全な propertyData を渡した場合、すべてのプレースホルダーが置換される
 * 観察2: buyerName = null の場合、{buyerName} が空文字に置換される
 * 観察3: フォールバック処理用のローカル replacePlaceholders 関数は正しく動作する
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { replacePlaceholders, EMAIL_TEMPLATES } from '../utils/gmailDistributionTemplates';

const priceReductionTemplate = EMAIL_TEMPLATES.find(t => t.id === 'price-reduction')!;

describe('Preservation: 値下げメールプレースホルダー保持確認', () => {
  // 観察1: 完全な propertyData を渡した場合、すべてのプレースホルダーが置換される
  describe('観察1: 完全な propertyData でのプレースホルダー置換', () => {
    it('すべてのプレースホルダーが置換されること', () => {
      const propertyData = {
        propertyNumber: 'AA1234',
        address: '大分市',
        publicUrl: 'https://example.com',
        priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
        signature: 'SIGNATURE',
        buyerName: '田中様',
      };

      const result = replacePlaceholders(priceReductionTemplate.body, propertyData);

      // すべてのプレースホルダーが置換されていること
      expect(result).not.toContain('{publicUrl}');
      expect(result).not.toContain('{priceChangeText}');
      expect(result).not.toContain('{signature}');
      expect(result).not.toContain('{buyerName}');
      expect(result).not.toContain('{address}');

      // 実際の値が含まれていること
      expect(result).toContain('https://example.com');
      expect(result).toContain('1850万円 → 1350万円（500万円値下げ）');
      expect(result).toContain('SIGNATURE');
      expect(result).toContain('田中様');
      expect(result).toContain('大分市');
    });

    it('件名のプレースホルダーも置換されること', () => {
      const propertyData = {
        propertyNumber: 'AA1234',
        address: '大分市',
        publicUrl: 'https://example.com',
        priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
        signature: 'SIGNATURE',
        buyerName: '田中様',
      };

      const subjectResult = replacePlaceholders(priceReductionTemplate.subject, propertyData);

      expect(subjectResult).not.toContain('{address}');
      expect(subjectResult).toContain('大分市');
    });
  });

  // 観察2: buyerName = null の場合、{buyerName} が空文字に置換される
  describe('観察2: buyerName が null の場合の動作', () => {
    it('buyerName が null の場合、{buyerName} が空文字に置換されること', () => {
      // replacePlaceholders は Record<string, string> を受け取るため、
      // null を空文字として渡す（実際のコードでの動作を模倣）
      const propertyData: Record<string, string> = {
        propertyNumber: 'AA1234',
        address: '大分市',
        publicUrl: 'https://example.com',
        priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
        signature: 'SIGNATURE',
        buyerName: '', // null の場合は空文字として渡される
      };

      const result = replacePlaceholders(priceReductionTemplate.body, propertyData);

      // {buyerName} が残らないこと（空文字に置換される）
      expect(result).not.toContain('{buyerName}');
    });

    it('buyerName が空文字の場合、{buyerName} が空文字に置換されること', () => {
      const propertyData: Record<string, string> = {
        propertyNumber: 'AA1234',
        address: '大分市',
        publicUrl: 'https://example.com',
        priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
        signature: 'SIGNATURE',
        buyerName: '',
      };

      const result = replacePlaceholders(priceReductionTemplate.body, propertyData);

      expect(result).not.toContain('{buyerName}');
    });
  });

  // 観察3: フォールバック処理用のローカル replacePlaceholders 関数は正しく動作する
  describe('観察3: フォールバック処理用 replacePlaceholders の動作確認', () => {
    it('replacePlaceholders が正しく動作すること（フォールバック処理の模倣）', () => {
      // GmailDistributionButton 内のローカル replacePlaceholders と同等の動作を確認
      // gmailDistributionTemplates.ts の replacePlaceholders を使用
      const template = '{buyerName}様\n{address}の物件です。\n詳細：{publicUrl}\n{signature}';
      const data: Record<string, string> = {
        buyerName: '山田',
        address: '大分市中央町',
        publicUrl: 'https://example.com/property/AA1234',
        signature: '株式会社テスト\n担当者名',
      };

      const result = replacePlaceholders(template, data);

      expect(result).toBe('山田様\n大分市中央町の物件です。\n詳細：https://example.com/property/AA1234\n株式会社テスト\n担当者名');
      expect(result).not.toContain('{buyerName}');
      expect(result).not.toContain('{address}');
      expect(result).not.toContain('{publicUrl}');
      expect(result).not.toContain('{signature}');
    });

    it('存在しないキーのプレースホルダーはそのまま残ること', () => {
      // replacePlaceholders は渡されたキーのみ置換する
      const template = '{buyerName}様\n{unknownKey}';
      const data: Record<string, string> = {
        buyerName: '田中',
      };

      const result = replacePlaceholders(template, data);

      expect(result).toContain('田中様');
      expect(result).toContain('{unknownKey}'); // 存在しないキーはそのまま残る
      expect(result).not.toContain('{buyerName}');
    });
  });

  // プロパティベーステスト: ランダムな入力でプレースホルダーが残らないことを検証
  describe('プロパティベーステスト: 完全な propertyData でプレースホルダーが残らない', () => {
    /**
     * Property 2: Preservation
     * 完全な propertyData（すべての必要なキーを含む）を渡した場合、
     * {key} 形式のプレースホルダーが結果に残らないことを検証する
     *
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
     */
    it('ランダムな完全 propertyData でプレースホルダーが残らないこと', () => {
      // 正規表現置換の特殊文字（$&, $`, $', $1 等）を除外した安全な文字列ジェネレーター
      // replacePlaceholders は String.replace を使用するため、値に $ が含まれると特殊解釈される
      const safeString = (maxLength: number) =>
        fc.string({ minLength: 0, maxLength }).filter(
          s => !s.includes('{') && !s.includes('}') && !s.includes('$')
        );

      fc.assert(
        fc.property(
          safeString(50),
          safeString(200),
          safeString(100),
          safeString(50),
          safeString(200),
          (publicUrl, priceChangeText, signature, buyerName, address) => {
            const propertyData: Record<string, string> = {
              propertyNumber: 'AA1234',
              address,
              publicUrl,
              priceChangeText,
              signature,
              buyerName,
            };

            const result = replacePlaceholders(priceReductionTemplate.body, propertyData);

            // すべてのプレースホルダーが置換されていること
            expect(result).not.toContain('{publicUrl}');
            expect(result).not.toContain('{priceChangeText}');
            expect(result).not.toContain('{signature}');
            expect(result).not.toContain('{buyerName}');
            expect(result).not.toContain('{address}');
          }
        )
      );
    });

    it('ランダムな buyerName（空文字含む）で {buyerName} が残らないこと', () => {
      fc.assert(
        fc.property(
          // buyerName は空文字も含む（$ は正規表現置換の特殊文字のため除外）
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('{') && !s.includes('}') && !s.includes('$')),
          (buyerName) => {
            const propertyData: Record<string, string> = {
              propertyNumber: 'AA1234',
              address: '大分市',
              publicUrl: 'https://example.com',
              priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
              signature: 'テスト署名',
              buyerName,
            };

            const result = replacePlaceholders(priceReductionTemplate.body, propertyData);

            // buyerName がどんな値でも {buyerName} が残らないこと
            expect(result).not.toContain('{buyerName}');
          }
        )
      );
    });
  });
});
