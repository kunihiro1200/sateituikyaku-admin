/**
 * プロパティテスト: テンプレート物件種別フィルタリング
 *
 * Feature: viewing-gmail-template-property-type-filter
 *
 * filterTemplatesByPropertyType 関数のプロパティベーステスト
 * 実装: frontend/frontend/src/components/TemplateSelectionModal.tsx
 */

import * as fc from 'fast-check';
import { filterTemplatesByPropertyType } from '../components/TemplateSelectionModal';
import type { EmailTemplate } from '../types/emailTemplate';

// ===== ジェネレーター =====

/**
 * EmailTemplate を生成するアービトラリー（任意の名前）
 */
const templateArb: fc.Arbitrary<EmailTemplate> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 0, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  subject: fc.string({ minLength: 0, maxLength: 100 }),
  body: fc.string({ minLength: 0, maxLength: 500 }),
maxLength: 20 }), { maxLength: 5 }),
});

/**
 * 括弧なしのテンプレート名を生成するアービトラリー
 * 全角括弧（）と半角括弧()を含まない文字列
 */
const nameWithoutBracketsArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
cludes('\uff09') && !s.includes('(') && !s.includes(')')
);

/**
 * 括弧なしのテンプレートを生成するアービトラリー
 */
const templateWithoutBracketsArb: fc.Arbitrary<EmailTemplate> = fc.record({
  id: fc.uuid(),
  name: nameWithoutBracketsArb,
  description: fc.string({ minLength: 0, maxLength: 100 }),
  subject: fc.string({ minLength: 0, maxLength: 100 }),
  body: fc.string({ minLength: 0, maxLength: 500 }),
  placeholders: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
});

/**
 * 全角括弧内に指定文字を含むテン
 */
function templateWithFullWidthBracket(content: string): fc.Arbitrary<EmailTemplate> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant(`\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\uff08${content}\uff09`),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    subject: fc.string({ minLength: 0, maxLength: 100 }),
    body: fc.string({ minLength: 0, maxLength: 500 }),
    placeholders: fc.constant([] as string[]),
  });
}

/**
 * 半角括弧内に指定文字を含むテンプレートを生成する
 */
functracket(content: string): fc.Arbitrary<EmailTemplate> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant(`\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8(${content})`),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    subject: fc.string({ minLength: 0, maxLength: 100 }),
    body: fc.string({ minLength: 0, maxLength: 500 }),
    placeholders: fc.constant([] as string[]),
  });
}

// ===== Property 1: propertyType未指定時は全テンプレートを返す =====

/**
 * **Validates: Requirements 2.2**
 *
 * Property 1: propertyType が undefined または空文字の場合、
 * filterTemplatesByPropertyType の戻り値は入力リストと同一でなければならない
 */
describe('Property 1: propertyType\u672a\u6307\u5b9a\u6642\u306f\u5168\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u8fd4\u3059', () => {
  it('propertyType \u304c undefined \u306e\u5834\u5408\u3001\u5168\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u8fd4\u3059', () => {
    fc.assert(
      fc.property(
        fc.array(templateArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
ilterTemplatesByPropertyType(templates, undefined);
          return result.length === templates.length &&
            result.every((t, i) => t.id === templates[i].id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType \u304c\u7a7a\u6587\u5b57\u306e\u5834\u5408\u3001\u5168\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u8fd4\u3059', () => {
    fc.assert(
      fc.property(
        fc.array(templateArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
   erTemplatesByPropertyType(templates, '');
          return result.length === templates.length &&
            result.every((t, i) => t.id === templates[i].id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 2: 戸建て物件フィルタリングの正確性 =====

/**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: propertyType が「戸」または「戸建て」の場合、
 * フィルタリング後のリストには括弧内に「土」を含むテンプレートが存在せず、
 * 括弧なしテンプレートは全て含まれる
 */
describe('Property 2:u306e\u6b63\u78ba\u6027', () => {
  const detachedHouseTypes = ['\u6238', '\u6238\u5efa\u3066'] as const;

  detachedHouseTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" \u306e\u3068\u304d\u3001\u62ec\u5f27\u5185\u306b\u300c\u571f\u300d\u3092\u542b\u3080\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u304c\u9664\u5916\u3055\u308c\u308b`, () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              templateWithFullWidthBracket('\u571f\u5730'),
plateWithHalfWidthBracket('\u571f\u5730'),
              templateWithFullWidthBracket('\u6238\u5efa\u3066'),
              templateWithoutBracketsArb
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            const hasExcluded = result.some((t) => {
              const fullWidth = t.name.match(/\uff08[^\uff09]*\uff09/g) || [];
           \)/g) || [];
              const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
              return allContent.includes('\u571f');
            });
            return !hasExcluded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it(`propertyType="${propertyType}" \u306e\u3068\u304d\u3001\u62ec\u5f27\u306a\u3057\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u5168\u3066\u542b\u307e\u308c\u308b`, () => {
      fc.assert(
        fc.property(
          flateWithoutBracketsArb, { minLength: 0, maxLength: 20 }),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            return templates.every((t) => result.some((r) => r.id === t.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ===== Property 3: 土地物件フィルタリングの正確性 =====

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * Property 3: propertyType が「土」の場合、
 * フィルタリング後のリストには括弧内に「戸」または「マ」を含むテンプレートが存在せず、
 * 括弧なしテンプレートは全て含まれる
 */
describe('Property 3: \u571f\u5730\u7269\u4ef6\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u306e\u6b63\u78ba\u6027', () => {
  it('propertyType="\u571f" \u306e\u3068\u304d\u3001\u62ec\u5f27\u5185\u306b\u300c\u6238\u300d\u3092\u542b\u3080\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u304c\u9664\u5916\u3055\u308c\u308b', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            templateWithFullWidthBracket('\u6238\u5efa\u3066'),
          u6238\u5efa\u3066'),
            templateWithoutBracketsArb
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '\u571f');
          const hasExcluded = result.some((t) => {
            const fullWidth = t.name.match(/\uff08[^\uff09]*\uff09/g) || [];
            const halfWidth = t.name.match(/\([^)]*\)/g) || [];

            return allContent.includes('\u6238');
          });
          return !hasExcluded;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType="\u571f" \u306e\u3068\u304d\u3001\u62ec\u5f27\u5185\u306b\u300c\u30de\u300d\u3092\u542b\u3080\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u304c\u9664\u5916\u3055\u308c\u308b', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            templateWithFullWidthBracket('\u30de\u30f3\u30b7\u30e7\u30f3'),
            lfWidthBracket('\u30de\u30f3\u30b7\u30e7\u30f3'),
            templateWithoutBracketsArb
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '\u571f');
          const hasExcluded = result.some((t) => {
            const fullWidth = t.name.match(/\uff08[^\uff09]*\uff09/g) || [];
            const halfWidth = t.name.match(/\([^)]*\)/g) || [];
            const allContent = [...fullWidth => m.slice(1, -1)).join('');
            return allContent.includes('\u30de');
          });
          return !hasExcluded;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType="\u571f" \u306e\u3068\u304d\u3001\u62ec\u5f27\u306a\u3057\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u5168\u3066\u542b\u307e\u308c\u308b', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithoutBracketsArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '\u571f');
          return templates.every((t) => result.some((r) => r.id === t.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== Property 4: マンション物件フィルタリングの正確性 =====

/**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * Property 4: propertyType が「マ」または「マンション」の場合、
 * フィルタリング後のリストには括弧内に「土」を含むテンプレートが存在せず、
 * 括弧なしテンプレートは全て含まれる
 */
describe('Property 4: \u30de\u30f3\u30b7\u30e7\u30\u6027', () => {
  const mansionTypes = ['\u30de', '\u30de\u30f3\u30b7\u30e7\u30f3'] as const;

  mansionTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" \u306e\u3068\u304d\u3001\u62ec\u5f27\u5185\u306b\u300c\u571f\u300d\u3092\u542b\u3080\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u304c\u9664\u5916\u3055\u308c\u308b`, () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              templateWithFullWidthBracket('\u571f\u5730'),
              templateWithHalfWidthBracket('\u571f\u5730'),
              templateWithFullWidthBracket('\u30de\u30f3\u30b7\u30e7\u30f3'),
              templateWithoutBracketsArb
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            const hasExcluded = result.some((t) => {
              const fullWidth = t.name.match(/\uff08[^\uff09]*\uff09/g) || [];
              const halfWidth = t.name.match(/\([^)]*\)/g) || [];
              const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
              return allContent.includes('\u571f');
            });
            return !hasExcluded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it(`propertyType="${propertyType}" \u306e\u3068\u304d\u3001\u62ec\u5f27\u306a\u3057\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u5168\u3066\u542b\u307e\u308c\u308b`, () => {
      fc.assert(
        fc.property(
          fc.arr(templateWithoutBracketsArb, { minLength: 0, maxLength: 20 }),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            return templates.every((t) => result.some((r) => r.id === t.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ===== Property 5: 括弧内文字列抽出の正確性 =====

/**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Property 5: 全角括弧（）および半角括弧()の両方の内容が正しくフィルタリングに使われること
 */
describe('Property 5: \u62ec\u5f27\u5185\u6587\u5b57\u5217\u62bd\u51fa\u306e\u6b63\u78ba\u6027', () => {
  it('\u5168\u89d2\u62ec\u5f27\u5185\u306e\u300c\u571f\u300d\u304c\u6238\u5efa\u3066\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u3067\u6b63\u3057\u304f\u9664\u5916\u3055\u308c\u308b', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithFullWidthBracket('\u571f\u5730'), { minLength: 1, maxLength: 10 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '\u6238');
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('\u534a\u89d2\u62ec\u5f27\u5185\u306e\u300c\u571f\u300d\u304c\u6238\u5efa\u3066\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u3067\u6b63\u3057\u304f\u9664\u5916\u3055\u308c\u308b', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithHalfWidthBracket('\u571f\u5730'), { minLength: 1, maxLength: 10 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '\u6238');
          return rult.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('\u8907\u6570\u306e\u62ec\u5f27\u304c\u3042\u308b\u5834\u5408\u3001\u5168\u3066\u306e\u62ec\u5f27\u5185\u5bb9\u304c\u5224\u5b9a\u5bfe\u8c61\u306b\u306a\u308b', () => {
    // 「テンプレート（戸建て）（土地）」は土地フィルタで除外される
    const templateWithMultipleBrackets: EmailTemplate = {
      id: 'test-1',
      name: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\uff08\u6238\u5efa\u3066\uff09\uff08\u571f\u5730\uff09',
      description: '',
      subject: '',
      body: '',
      placeholders: [],
    };

    // 土地フィルタ: 括弧内に「戸」を含むので除外
    const resultForLand = filterTemplatesByPropertyType([templateWithMultipleBrackets], '\u571f');
    expect(resultForLand.length).toBe(0);

    // 戸建てフィルタ: 括弧内に「土」を含むので除外
    const resultForDetached = filterTemplatesByPropertyType([templateWithMultipleBrackets], '\u6238');
    expect(resultForDetached.length).toBe(0);
  });
});

// ===== Property 6: 括弧なしテンプレートは常に表示 =====

/**
 * **Validates: Requirements 6.4, 3.3, 4.4, 5.3**
 *
 * ty 6: 任意の propertyType に対して、
 * テンプレート名に括弧が存在しないテンプレートはフィルタリング後のリストに必ず含まれる
 */
describe('Property 6: \u62ec\u5f27\u306a\u3057\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u5e38\u306b\u8868\u793a', () => {
  const allPropertyTypes = ['\u6238', '\u6238\u5efa\u3066', '\u571f', '\u30de', '\u30de\u30f3\u30b7\u30e7\u30f3', '\u53ce\u76ca\u7269\u4ef6', '\u4ed6'];

  allPropertyTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" \u3067\u3082\u62ec\u5f27\u306a\u3057\06f\u5168\u3066\u8868\u793a\u3055\u308c\u308b`, () => {
      fc.assert(
        fc.property(
          fc.array(templateWithoutBracketsArb, { minLength: 0, maxLength: 20 }),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            return templates.every((t) => result.some((r) => r.id === t.id));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  it('\u\u3057\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u5e38\u306b\u542b\u307e\u308c\u308b\uff08\u30e9\u30f3\u30c0\u30e0\u306a\u7a2e\u5225\uff09', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithoutBracketsArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (templates, propertyType) => {
          const result = filterTemplatesByPropertyType(templates, propertyType);
          return templates.every((t) => result.some((r) => r.id === t.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});
