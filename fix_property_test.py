#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
templatePropertyTypeFilter.property.test.ts を正しい EmailTemplate 型で書き直す
"""

content = '''/**
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
  placeholders: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
});

/**
 * 括弧なしのテンプレート名を生成するアービトラリー
 * 全角括弧（）と半角括弧()を含まない文字列
 */
const nameWithoutBracketsArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => !s.includes('（') && !s.includes('）') && !s.includes('(') && !s.includes(')')
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
 * 全角括弧内に指定文字を含むテンプレートを生成する
 */
function templateWithFullWidthBracket(content: string): fc.Arbitrary<EmailTemplate> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant(`テンプレート（${content}）`),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    subject: fc.string({ minLength: 0, maxLength: 100 }),
    body: fc.string({ minLength: 0, maxLength: 500 }),
    placeholders: fc.constant([] as string[]),
  });
}

/**
 * 半角括弧内に指定文字を含むテンプレートを生成する
 */
function templateWithHalfWidthBracket(content: string): fc.Arbitrary<EmailTemplate> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant(`テンプレート(${content})`),
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
describe('Property 1: propertyType未指定時は全テンプレートを返す', () => {
  it('propertyType が undefined の場合、全テンプレートを返す', () => {
    fc.assert(
      fc.property(
        fc.array(templateArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, undefined);
          return result.length === templates.length &&
            result.every((t, i) => t.id === templates[i].id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType が空文字の場合、全テンプレートを返す', () => {
    fc.assert(
      fc.property(
        fc.array(templateArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '');
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
describe('Property 2: 戸建て物件フィルタリングの正確性', () => {
  const detachedHouseTypes = ['戸', '戸建て'] as const;

  detachedHouseTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" のとき、括弧内に「土」を含むテンプレートが除外される`, () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              templateWithFullWidthBracket('土地'),
              templateWithHalfWidthBracket('土地'),
              templateWithFullWidthBracket('戸建て'),
              templateWithoutBracketsArb
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            const hasExcluded = result.some((t) => {
              const fullWidth = t.name.match(/（[^）]*）/g) || [];
              const halfWidth = t.name.match(/\\([^)]*\\)/g) || [];
              const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
              return allContent.includes('土');
            });
            return !hasExcluded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it(`propertyType="${propertyType}" のとき、括弧なしテンプレートは全て含まれる`, () => {
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
});

// ===== Property 3: 土地物件フィルタリングの正確性 =====

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * Property 3: propertyType が「土」の場合、
 * フィルタリング後のリストには括弧内に「戸」または「マ」を含むテンプレートが存在せず、
 * 括弧なしテンプレートは全て含まれる
 */
describe('Property 3: 土地物件フィルタリングの正確性', () => {
  it('propertyType="土" のとき、括弧内に「戸」を含むテンプレートが除外される', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            templateWithFullWidthBracket('戸建て'),
            templateWithHalfWidthBracket('戸建て'),
            templateWithoutBracketsArb
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '土');
          const hasExcluded = result.some((t) => {
            const fullWidth = t.name.match(/（[^）]*）/g) || [];
            const halfWidth = t.name.match(/\\([^)]*\\)/g) || [];
            const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
            return allContent.includes('戸');
          });
          return !hasExcluded;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType="土" のとき、括弧内に「マ」を含むテンプレートが除外される', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            templateWithFullWidthBracket('マンション'),
            templateWithHalfWidthBracket('マンション'),
            templateWithoutBracketsArb
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '土');
          const hasExcluded = result.some((t) => {
            const fullWidth = t.name.match(/（[^）]*）/g) || [];
            const halfWidth = t.name.match(/\\([^)]*\\)/g) || [];
            const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
            return allContent.includes('マ');
          });
          return !hasExcluded;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propertyType="土" のとき、括弧なしテンプレートは全て含まれる', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithoutBracketsArb, { minLength: 0, maxLength: 20 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '土');
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
describe('Property 4: マンション物件フィルタリングの正確性', () => {
  const mansionTypes = ['マ', 'マンション'] as const;

  mansionTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" のとき、括弧内に「土」を含むテンプレートが除外される`, () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              templateWithFullWidthBracket('土地'),
              templateWithHalfWidthBracket('土地'),
              templateWithFullWidthBracket('マンション'),
              templateWithoutBracketsArb
            ),
            { minLength: 0, maxLength: 20 }
          ),
          (templates) => {
            const result = filterTemplatesByPropertyType(templates, propertyType);
            const hasExcluded = result.some((t) => {
              const fullWidth = t.name.match(/（[^）]*）/g) || [];
              const halfWidth = t.name.match(/\\([^)]*\\)/g) || [];
              const allContent = [...fullWidth, ...halfWidth].map(m => m.slice(1, -1)).join('');
              return allContent.includes('土');
            });
            return !hasExcluded;
          }
        ),
        { numRuns: 100 }
      );
    });

    it(`propertyType="${propertyType}" のとき、括弧なしテンプレートは全て含まれる`, () => {
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
});

// ===== Property 5: 括弧内文字列抽出の正確性 =====

/**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Property 5: 全角括弧（）および半角括弧()の両方の内容が正しくフィルタリングに使われること
 */
describe('Property 5: 括弧内文字列抽出の正確性', () => {
  it('全角括弧内の「土」が戸建てフィルタリングで正しく除外される', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithFullWidthBracket('土地'), { minLength: 1, maxLength: 10 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '戸');
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('半角括弧内の「土」が戸建てフィルタリングで正しく除外される', () => {
    fc.assert(
      fc.property(
        fc.array(templateWithHalfWidthBracket('土地'), { minLength: 1, maxLength: 10 }),
        (templates) => {
          const result = filterTemplatesByPropertyType(templates, '戸');
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('複数の括弧がある場合、全ての括弧内容が判定対象になる', () => {
    const templateWithMultipleBrackets: EmailTemplate = {
      id: 'test-1',
      name: 'テンプレート（戸建て）（土地）',
      description: '',
      subject: '',
      body: '',
      placeholders: [],
    };

    // 土地フィルタ: 括弧内に「戸」を含むので除外
    const resultForLand = filterTemplatesByPropertyType([templateWithMultipleBrackets], '土');
    expect(resultForLand.length).toBe(0);

    // 戸建てフィルタ: 括弧内に「土」を含むので除外
    const resultForDetached = filterTemplatesByPropertyType([templateWithMultipleBrackets], '戸');
    expect(resultForDetached.length).toBe(0);
  });
});

// ===== Property 6: 括弧なしテンプレートは常に表示 =====

/**
 * **Validates: Requirements 6.4, 3.3, 4.4, 5.3**
 *
 * Property 6: 任意の propertyType に対して、
 * テンプレート名に括弧が存在しないテンプレートはフィルタリング後のリストに必ず含まれる
 */
describe('Property 6: 括弧なしテンプレートは常に表示', () => {
  const allPropertyTypes = ['戸', '戸建て', '土', 'マ', 'マンション', '収益物件', '他'];

  allPropertyTypes.forEach((propertyType) => {
    it(`propertyType="${propertyType}" でも括弧なしテンプレートは全て表示される`, () => {
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

  it('任意の propertyType に対して括弧なしテンプレートは常に含まれる（ランダムな種別）', () => {
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
'''

file_path = 'frontend/frontend/src/__tests__/templatePropertyTypeFilter.property.test.ts'

with open(file_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')

with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])}')
print(f'File size: {len(content)} chars')
