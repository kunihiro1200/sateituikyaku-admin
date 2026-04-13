/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - 値下げ配信メールのプレースホルダー未置換バグ
 *
 * このテストは修正前のコードで**必ず失敗する必要があります**
 * 失敗によりバグの存在が確認されます
 *
 * バグ条件: `sendEmailsDirectly()` に渡す `propertyData` に
 * `publicUrl`、`priceChangeText`、`signature`、`buyerName` が欠落している状態
 *
 * 期待される動作（修正後）: すべてのプレースホルダーが実際の値に置換される
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { replacePlaceholders, EMAIL_TEMPLATES } from '../utils/gmailDistributionTemplates';

describe('Bug Condition Exploration: 値下げメールプレースホルダー未置換バグ', () => {
  // 修正後のコードで sendEmailsDirectly に渡される完全な propertyData
  const fixedPropertyData = {
    propertyNumber: 'AA1234',
    address: '大分市中央町1-1-1',
    publicUrl: 'https://example.com/property/AA1234',
    priceChangeText: '1850万円 → 1350万円（500万円値下げ）',
    signature: '*****************************\n株式会社いふう\n大分市舞鶴町1-3-30\nTEL:097-533-2022\n******************************',
    buyerName: '田中',
    propertyType: '中古戸建',
    price: '1350万円',
  };

  const priceReductionTemplate = EMAIL_TEMPLATES.find(t => t.id === 'price-reduction')!;

  it('{publicUrl} が置換されること（バグ条件下では FAIL）', () => {
    const result = replacePlaceholders(priceReductionTemplate.body, fixedPropertyData);

    // 期待: {publicUrl} が残らない（修正後に PASS）
    // 未修正コードでは publicUrl が propertyData に含まれないため {publicUrl} がそのまま残る → FAIL
    expect(result).not.toContain('{publicUrl}');
  });

  it('{priceChangeText} が置換されること（バグ条件下では FAIL）', () => {
    const result = replacePlaceholders(priceReductionTemplate.body, fixedPropertyData);

    // 期待: {priceChangeText} が残らない（修正後に PASS）
    // 未修正コードでは priceChangeText が propertyData に含まれないため {priceChangeText} がそのまま残る → FAIL
    expect(result).not.toContain('{priceChangeText}');
  });

  it('{signature} が置換されること（バグ条件下では FAIL）', () => {
    const result = replacePlaceholders(priceReductionTemplate.body, fixedPropertyData);

    // 期待: {signature} が残らない（修正後に PASS）
    // 未修正コードでは signature が propertyData に含まれないため {signature} がそのまま残る → FAIL
    expect(result).not.toContain('{signature}');
  });

  it('{buyerName} が置換されること（バグ条件下では FAIL）', () => {
    const result = replacePlaceholders(priceReductionTemplate.body, fixedPropertyData);

    // 期待: {buyerName} が残らない（修正後に PASS）
    // 未修正コードでは buyerName が propertyData に含まれないため {buyerName} がそのまま残る → FAIL
    expect(result).not.toContain('{buyerName}');
  });

  it('バグ条件下ですべてのプレースホルダーが置換されること（統合テスト、バグ条件下では FAIL）', () => {
    const result = replacePlaceholders(priceReductionTemplate.body, fixedPropertyData);

    // 期待: すべてのプレースホルダーが置換される（修正後に PASS）
    expect(result).not.toContain('{publicUrl}');
    expect(result).not.toContain('{priceChangeText}');
    expect(result).not.toContain('{signature}');
    expect(result).not.toContain('{buyerName}');
  });
});
