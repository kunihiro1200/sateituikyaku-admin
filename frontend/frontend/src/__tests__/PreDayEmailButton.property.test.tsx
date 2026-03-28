/**
 * Property-Based Tests for PreDayEmailButton
 *
 * Feature: buyer-viewing-pre-day-email
 * テストライブラリ: fast-check
 *
 * DOM レンダリングを使わず、ロジック関数のみをテストする。
 * （vite.config.ts の environment: 'node' に対応）
 */

import * as fc from 'fast-check';

// ---- テスト対象のロジック関数（コンポーネントから抽出） ----

const PRE_DAY_TEMPLATE_NAME = '★内覧前日通知メール';

/**
 * BuyerViewingResultPage の表示条件ロジック
 * `buyer.calculated_status === '内覧日前日'` の場合のみ true
 */
function shouldShowButton(calculatedStatus: string): boolean {
  return calculatedStatus === '内覧日前日';
}

/**
 * PreDayEmailButton のテンプレートフィルタリングロジック
 */
function filterPreDayTemplate(templates: Array<{ id: string; name: string }>) {
  return templates.filter((t) => t.name === PRE_DAY_TEMPLATE_NAME);
}

/**
 * PreDayEmailButton のボタン無効化ロジック
 */
function isButtonDisabled(selectedPropertyIds: Set<string>, loading: boolean): boolean {
  return selectedPropertyIds.size === 0 || loading;
}

/**
 * PreDayEmailButton のエラー判定ロジック
 * テンプレート一覧に ★内覧前日通知メール が含まれない場合はエラー
 */
function getTemplateError(templates: Array<{ id: string; name: string }>): string | null {
  const found = templates.find((t) => t.name === PRE_DAY_TEMPLATE_NAME);
  return found ? null : `${PRE_DAY_TEMPLATE_NAME}テンプレートが見つかりません`;
}

// ---- アービトラリー ----

const calculatedStatusArb = fc.string({ minLength: 0, maxLength: 30 });

const nonPreDayStatusArb = fc
  .string({ minLength: 0, maxLength: 30 })
  .filter((s) => s !== '内覧日前日');

const templateArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
});

const templateListArb = fc.array(templateArb, { minLength: 0, maxLength: 10 });

const templateListWithoutPreDayArb = fc.array(
  templateArb.filter((t) => t.name !== PRE_DAY_TEMPLATE_NAME),
  { minLength: 0, maxLength: 10 }
);

const emptyPropertyIdsArb = fc.constant(new Set<string>());

const nonEmptyPropertyIdsArb = fc
  .array(fc.uuid(), { minLength: 1, maxLength: 5 })
  .map((ids) => new Set(ids));

// ---- テスト ----

/**
 * Property 1: ステータスによるボタン表示の排他性
 * Feature: buyer-viewing-pre-day-email, Property 1: ステータスによるボタン表示の排他性
 * Validates: Requirements 1.1, 1.2
 */
describe('Property 1: ステータスによるボタン表示の排他性', () => {
  it('calculated_status === "内覧日前日" の場合のみ shouldShowButton が true を返す', () => {
    fc.assert(
      fc.property(calculatedStatusArb, (status) => {
        const result = shouldShowButton(status);
        if (status === '内覧日前日') {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('"内覧日前日" 以外の任意のステータスに対して shouldShowButton は false を返す', () => {
    fc.assert(
      fc.property(nonPreDayStatusArb, (status) => {
        expect(shouldShowButton(status)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 2: テンプレートフィルタリングの正確性
 * Feature: buyer-viewing-pre-day-email, Property 2: テンプレートフィルタリングの正確性
 * Validates: Requirements 2.2
 */
describe('Property 2: テンプレートフィルタリングの正確性', () => {
  it('任意のテンプレート一覧に対して、フィルタ後は ★内覧前日通知メール のみが残る', () => {
    fc.assert(
      fc.property(templateListArb, (templates) => {
        const filtered = filterPreDayTemplate(templates);
        expect(filtered.every((t) => t.name === PRE_DAY_TEMPLATE_NAME)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('元のリストに ★内覧前日通知メール が含まれる場合のみフィルタ後に1件以上残る', () => {
    fc.assert(
      fc.property(templateListArb, (templates) => {
        const hasPreDay = templates.some((t) => t.name === PRE_DAY_TEMPLATE_NAME);
        const filtered = filterPreDayTemplate(templates);
        if (hasPreDay) {
          expect(filtered.length).toBeGreaterThan(0);
        } else {
          expect(filtered.length).toBe(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});

/**
 * Property 3: 物件未選択時のボタン無効化
 * Feature: buyer-viewing-pre-day-email, Property 3: 物件未選択時のボタン無効化
 * Validates: Requirements 2.5
 */
describe('Property 3: 物件未選択時のボタン無効化', () => {
  it('selectedPropertyIds が空の場合、isButtonDisabled は true を返す', () => {
    fc.assert(
      fc.property(emptyPropertyIdsArb, (emptyIds) => {
        expect(isButtonDisabled(emptyIds, false)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('selectedPropertyIds が1件以上の場合、loading が false なら isButtonDisabled は false を返す', () => {
    fc.assert(
      fc.property(nonEmptyPropertyIdsArb, (ids) => {
        expect(isButtonDisabled(ids, false)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('loading が true の場合、selectedPropertyIds に関わらず isButtonDisabled は true を返す', () => {
    fc.assert(
      fc.property(
        fc.oneof(emptyPropertyIdsArb, nonEmptyPropertyIdsArb),
        (ids) => {
          expect(isButtonDisabled(ids, true)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: テンプレート不在時のエラー表示
 * Feature: buyer-viewing-pre-day-email, Property 4: テンプレート不在時のエラー表示
 * Validates: Requirements 3.1
 */
describe('Property 4: テンプレート不在時のエラー表示', () => {
  it('★内覧前日通知メールを含まない任意のテンプレート一覧に対して、getTemplateError はエラー文字列を返す', () => {
    fc.assert(
      fc.property(templateListWithoutPreDayArb, (templates) => {
        const error = getTemplateError(templates);
        expect(error).not.toBeNull();
        expect(error).toContain(PRE_DAY_TEMPLATE_NAME);
      }),
      { numRuns: 200 }
    );
  });

  it('★内覧前日通知メールを含むテンプレート一覧に対して、getTemplateError は null を返す', () => {
    const preDayTemplate = { id: 'pre-day-id', name: PRE_DAY_TEMPLATE_NAME };
    fc.assert(
      fc.property(templateListArb, (templates) => {
        const withPreDay = [...templates, preDayTemplate];
        const error = getTemplateError(withPreDay);
        expect(error).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
