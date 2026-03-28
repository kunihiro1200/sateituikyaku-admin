/**
 * プロパティテスト: getPropertyNonReportTemplates のフィルタリング
 *
 * タスク 1.1: 非報告テンプレートのフィルタリング プロパティテスト
 *
 * **Validates: Requirements 1.1, 1.2**
 */

import * as fc from 'fast-check';

// ===== テスト対象のフィルタリングロジックを抽出 =====
// EmailTemplateService.getPropertyNonReportTemplates() の核心ロジックを
// 純粋関数として抽出してテストする

/**
 * スプレッドシートの行データを表す型
 * C列: 区分, D列: 種別, E列: 件名, F列: 本文
 */
interface TemplateRow {
  category: string; // C列: 区分
  type: string;     // D列: 種別
  subject: string;  // E列: 件名
  body: string;     // F列: 本文
}

/**
 * EmailTemplateService.getPropertyNonReportTemplates() と同等のフィルタリングロジック
 * 区分が「物件」かつ種別に「報告」を含まない行のみを返す
 */
function filterPropertyNonReportTemplates(rows: TemplateRow[]): TemplateRow[] {
  return rows.filter((row) => {
    const category = row.category.trim();
    const type = row.type.trim();
    // 区分が「物件」かつ種別が空でなく、かつ種別に「報告」を含まない
    return category === '物件' && type !== '' && !type.includes('報告');
  });
}

// ===== fast-check ジェネレーター =====

/**
 * 任意の区分文字列を生成するアービトラリー
 * 「物件」「売主」「買主」「その他」などを含む
 */
const categoryArb = fc.oneof(
  fc.constant('物件'),
  fc.constant('売主'),
  fc.constant('買主'),
  fc.constant('その他'),
  fc.constant(''),
  fc.string({ minLength: 0, maxLength: 10 })
);

/**
 * 任意の種別文字列を生成するアービトラリー
 * 「報告」を含むものと含まないものを混在させる
 */
const typeArb = fc.oneof(
  // 「報告」を含む種別
  fc.constant('月次報告'),
  fc.constant('週次報告'),
  fc.constant('報告書'),
  fc.constant('進捗報告'),
  // 「報告」を含まない種別
  fc.constant('内覧案内'),
  fc.constant('価格変更通知'),
  fc.constant('契約書送付'),
  fc.constant(''),
  fc.string({ minLength: 0, maxLength: 20 })
);

/**
 * 任意のテンプレート行を生成するアービトラリー
 */
const templateRowArb = fc.record({
  category: categoryArb,
  type: typeArb,
  subject: fc.string({ minLength: 0, maxLength: 50 }),
  body: fc.string({ minLength: 0, maxLength: 200 }),
});

/**
 * 任意のテンプレート行配列を生成するアービトラリー
 */
const templateRowsArb = fc.array(templateRowArb, { minLength: 0, maxLength: 50 });

// ===== プロパティテスト =====

describe('Property 1: 非報告テンプレートのフィルタリング（タスク 1.1）', () => {
  /**
   * プロパティ1: 返却結果は全て category === '物件' かつ !type.includes('報告') であること
   *
   * Validates: Requirements 1.1, 1.2
   */
  it('任意のテンプレート行配列に対して、返却結果が全て category=物件 かつ type に報告を含まないこと', () => {
    fc.assert(
      fc.property(templateRowsArb, (rows) => {
        const result = filterPropertyNonReportTemplates(rows);

        // 全ての結果が条件を満たすこと
        for (const template of result) {
          // 区分が「物件」であること（Requirements 1.1）
          expect(template.category.trim()).toBe('物件');
          // 種別に「報告」を含まないこと（Requirements 1.2）
          expect(template.type.trim()).not.toContain('報告');
          // 種別が空でないこと
          expect(template.type.trim()).not.toBe('');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ2: 「物件」かつ「報告」を含まない行は必ず結果に含まれること（完全性）
   *
   * Validates: Requirements 1.1, 1.2
   */
  it('区分が物件かつ種別に報告を含まない行は必ず結果に含まれること', () => {
    fc.assert(
      fc.property(templateRowsArb, (rows) => {
        const result = filterPropertyNonReportTemplates(rows);

        // 条件を満たす行が全て結果に含まれること
        const expectedRows = rows.filter(
          (row) =>
            row.category.trim() === '物件' &&
            row.type.trim() !== '' &&
            !row.type.trim().includes('報告')
        );

        expect(result.length).toBe(expectedRows.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ3: 「報告」を含む種別の行は結果に含まれないこと
   *
   * Validates: Requirements 1.2
   */
  it('種別に報告を含む行は結果に含まれないこと', () => {
    fc.assert(
      fc.property(templateRowsArb, (rows) => {
        const result = filterPropertyNonReportTemplates(rows);

        // 「報告」を含む行が結果に含まれていないこと
        for (const template of result) {
          expect(template.type).not.toContain('報告');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ4: 区分が「物件」以外の行は結果に含まれないこと
   *
   * Validates: Requirements 1.1
   */
  it('区分が物件以外の行は結果に含まれないこと', () => {
    fc.assert(
      fc.property(templateRowsArb, (rows) => {
        const result = filterPropertyNonReportTemplates(rows);

        // 「物件」以外の区分の行が結果に含まれていないこと
        for (const template of result) {
          expect(template.category.trim()).toBe('物件');
        }
      }),
      { numRuns: 100 }
    );
  });
});
