/**
 * プロパティテスト: seller_email が空の場合のEmail送信ボタン無効化
 *
 * タスク 4.1: seller_email が空の場合のボタン無効化プロパティテスト
 *
 * **Validates: Requirements 2.2**
 *
 * PropertyListingDetailPage.tsx の Email送信ボタンの disabled 条件:
 *   disabled={!data.seller_email || propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
 * さらに {data.seller_email && (...)} でラップされているため、
 * seller_email が空・undefined・null の場合はボタン自体が非表示になる。
 */

import * as fc from 'fast-check';

// ===== テスト対象のロジックを純粋関数として抽出 =====

/**
 * Email送信ボタンの表示条件
 * PropertyListingDetailPage.tsx の {data.seller_email && (...)} に対応
 */
const isEmailButtonVisible = (sellerEmail: string | null | undefined): boolean => {
  return Boolean(sellerEmail);
};

/**
 * Email送信ボタンの disabled 条件
 * PropertyListingDetailPage.tsx の disabled 属性に対応:
 *   disabled={!data.seller_email || propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
 */
const isEmailButtonDisabled = (
  sellerEmail: string | null | undefined,
  templatesLoading: boolean,
  templatesCount: number
): boolean => {
  return !sellerEmail || templatesLoading || templatesCount === 0;
};

/**
 * ボタンが操作可能（表示かつ非disabled）かどうか
 */
const isEmailButtonEnabled = (
  sellerEmail: string | null | undefined,
  templatesLoading: boolean,
  templatesCount: number
): boolean => {
  return isEmailButtonVisible(sellerEmail) && !isEmailButtonDisabled(sellerEmail, templatesLoading, templatesCount);
};

// ===== fast-check ジェネレーター =====

/**
 * 空のseller_emailを表すアービトラリー（空文字列・undefined・null）
 */
const emptySellerEmailArb = fc.oneof(
  fc.constant(''),
  fc.constant(undefined),
  fc.constant(null)
);

/**
 * 有効なメールアドレスを表すアービトラリー
 */
const validEmailArb = fc.emailAddress();

/**
 * テンプレートのローディング状態アービトラリー
 */
const loadingArb = fc.boolean();

/**
 * テンプレート件数アービトラリー（0件以上）
 */
const templatesCountArb = fc.integer({ min: 0, max: 20 });

// ===== プロパティテスト =====

describe('Property 2: seller_email が空の場合のEmail送信ボタン無効化（タスク 4.1）', () => {
  /**
   * プロパティ2-1: seller_email が空文字列・undefined・null の場合、
   * ボタンは表示されない（または disabled になる）こと
   *
   * Validates: Requirements 2.2
   */
  it('seller_email が空・undefined・null の場合、Email送信ボタンは非表示または disabled であること', () => {
    fc.assert(
      fc.property(
        emptySellerEmailArb,
        loadingArb,
        templatesCountArb,
        (sellerEmail, templatesLoading, templatesCount) => {
          // ボタンが表示されない、またはdisabledであること
          const visible = isEmailButtonVisible(sellerEmail);
          const disabled = isEmailButtonDisabled(sellerEmail, templatesLoading, templatesCount);

          // seller_email が空の場合、ボタンは非表示（visible=false）
          // または disabled=true のいずれかであること
          return !visible || disabled;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ2-2: seller_email が空の場合、ボタンは必ず非表示になること
   *
   * Validates: Requirements 2.2
   */
  it('seller_email が空・undefined・null の場合、Email送信ボタンは必ず非表示になること', () => {
    fc.assert(
      fc.property(
        emptySellerEmailArb,
        (sellerEmail) => {
          // seller_email が空の場合、ボタンは非表示
          return !isEmailButtonVisible(sellerEmail);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ2-3: seller_email が空の場合、ボタンは操作不可であること
   *
   * Validates: Requirements 2.2
   */
  it('seller_email が空・undefined・null の場合、Email送信ボタンは操作不可であること', () => {
    fc.assert(
      fc.property(
        emptySellerEmailArb,
        loadingArb,
        templatesCountArb,
        (sellerEmail, templatesLoading, templatesCount) => {
          // seller_email が空の場合、ボタンは操作不可（enabled=false）
          return !isEmailButtonEnabled(sellerEmail, templatesLoading, templatesCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ2-4: 有効な seller_email がある場合でも、
   * ローディング中またはテンプレートが0件の場合は disabled になること
   *
   * Validates: Requirements 2.2, 2.4
   */
  it('有効なseller_emailがあっても、ローディング中またはテンプレート0件の場合はdisabledになること', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        fc.oneof(
          // ローディング中
          fc.record({ loading: fc.constant(true), count: templatesCountArb }),
          // テンプレート0件
          fc.record({ loading: fc.constant(false), count: fc.constant(0) })
        ),
        (sellerEmail, { loading, count }) => {
          const disabled = isEmailButtonDisabled(sellerEmail, loading, count);
          return disabled;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ2-5: 有効な seller_email があり、ローディング中でなく、
   * テンプレートが1件以上ある場合はボタンが操作可能であること
   *
   * Validates: Requirements 2.2
   */
  it('有効なseller_emailがあり、ローディング中でなく、テンプレートが1件以上ある場合はボタンが操作可能であること', () => {
    fc.assert(
      fc.property(
        validEmailArb,
        fc.integer({ min: 1, max: 20 }),
        (sellerEmail, templatesCount) => {
          const enabled = isEmailButtonEnabled(sellerEmail, false, templatesCount);
          return enabled;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 具体的なエッジケーステスト =====

describe('seller_email の具体的なエッジケース', () => {
  it('空文字列の場合はボタンが非表示になること', () => {
    expect(isEmailButtonVisible('')).toBe(false);
  });

  it('undefined の場合はボタンが非表示になること', () => {
    expect(isEmailButtonVisible(undefined)).toBe(false);
  });

  it('null の場合はボタンが非表示になること', () => {
    expect(isEmailButtonVisible(null)).toBe(false);
  });

  it('有効なメールアドレスの場合はボタンが表示されること', () => {
    expect(isEmailButtonVisible('seller@example.com')).toBe(true);
  });

  it('空文字列の場合はdisabledになること', () => {
    expect(isEmailButtonDisabled('', false, 5)).toBe(true);
  });

  it('有効なメールアドレスでローディング中の場合はdisabledになること', () => {
    expect(isEmailButtonDisabled('seller@example.com', true, 5)).toBe(true);
  });

  it('有効なメールアドレスでテンプレート0件の場合はdisabledになること', () => {
    expect(isEmailButtonDisabled('seller@example.com', false, 0)).toBe(true);
  });

  it('有効なメールアドレスでローディング中でなくテンプレートが1件以上の場合はenabledになること', () => {
    expect(isEmailButtonDisabled('seller@example.com', false, 3)).toBe(false);
  });
});
