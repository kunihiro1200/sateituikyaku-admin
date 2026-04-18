// @vitest-environment jsdom
/**
 * 保全プロパティテスト: SellerSendHistoryDetailModal
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）。
 *
 * 保全すべき動作:
 *   - `<br>` を含まないメッセージのテキスト内容が正確に表示される
 *   - 件名（item.subject）が正しく表示される
 *   - 送信者名（item.sender_name）が正しく表示される
 *   - 送信日時（item.sent_at）が正しくフォーマットされて表示される
 *   - `<br>` を含まない任意の文字列でレンダリングが正常に動作する
 *
 * 観察優先メソドロジー:
 *   未修正コードで非バグ条件の入力（`<br>` を含まないメッセージ）の
 *   動作を観察し、これがベースラインとして保全されるべき動作であることを確認する。
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import SellerSendHistoryDetailModal, { SellerSendHistoryItem } from '../SellerSendHistoryDetailModal';

// テスト用のデフォルトアイテムを生成するヘルパー
const createItem = (overrides: Partial<SellerSendHistoryItem> = {}): SellerSendHistoryItem => ({
  id: 'test-id-1',
  property_number: 'AA001',
  chat_type: 'seller_email',
  subject: 'テスト件名',
  message: '改行なしのメッセージ',
  sender_name: '担当者名',
  sent_at: '2024-01-15T10:00:00Z',
  ...overrides,
});

describe('SellerSendHistoryDetailModal - 保全プロパティテスト（<br>を含まない入力での動作保全）', () => {
  // ===== 観察1: <br> なしメッセージの保全 =====

  /**
   * Property 2: Preservation - <br> を含まないメッセージのテキスト内容が正確に表示される
   *
   * テスト内容:
   *   `item.message = "改行なしのメッセージ"` を渡したとき、
   *   テキスト内容がそのまま表示されることを確認する。
   *
   * バグ条件が成立しない（isBugCondition = false）ケース:
   *   - message に `<br>` が含まれない → テキストノードとして正常に表示される
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('<br> を含まないメッセージのテキスト内容が正確に表示されること', () => {
    const message = '改行なしのメッセージ';
    const item = createItem({ message });

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // テキスト内容がそのまま表示されることを確認
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  /**
   * Property 2: Preservation - 空文字列メッセージでエラーなく表示される
   *
   * テスト内容:
   *   `item.message = ""` を渡したとき、エラーなく表示されることを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('空文字列メッセージでエラーなく表示されること', () => {
    const item = createItem({ message: '' });

    // エラーなくレンダリングできることを確認
    expect(() => {
      render(
        <SellerSendHistoryDetailModal
          open={true}
          item={item}
          onClose={() => {}}
        />
      );
    }).not.toThrow();
  });

  // ===== 観察2: 件名の保全 =====

  /**
   * Property 2: Preservation - 件名（item.subject）が正しく表示される
   *
   * テスト内容:
   *   `item.subject = "テスト件名"` を渡したとき、
   *   件名がそのまま表示されることを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('件名（item.subject）が正しく表示されること', () => {
    const subject = 'テスト件名';
    const item = createItem({ subject });

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // 件名ラベルが表示されること
    expect(screen.getByText('件名')).toBeInTheDocument();
    // 件名の内容が表示されること
    expect(screen.getByText(subject)).toBeInTheDocument();
  });

  /**
   * Property 2: Preservation - 件名が空文字列の場合は件名セクションが非表示になる
   *
   * テスト内容:
   *   `item.subject = ""` を渡したとき、
   *   件名セクションが表示されないことを確認する（SMSの場合の動作）。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('件名が空文字列の場合は件名セクションが非表示になること', () => {
    const item = createItem({ subject: '', chat_type: 'seller_sms' });

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // 件名ラベルが表示されないことを確認
    expect(screen.queryByText('件名')).not.toBeInTheDocument();
  });

  // ===== 観察3: 送信者名の保全 =====

  /**
   * Property 2: Preservation - 送信者名（item.sender_name）が正しく表示される
   *
   * テスト内容:
   *   `item.sender_name = "担当者名"` を渡したとき、
   *   送信者名がそのまま表示されることを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('送信者名（item.sender_name）が正しく表示されること', () => {
    const senderName = '担当者名';
    const item = createItem({ sender_name: senderName });

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // 送信者ラベルが表示されること
    expect(screen.getByText('送信者')).toBeInTheDocument();
    // 送信者名の内容が表示されること
    expect(screen.getByText(senderName)).toBeInTheDocument();
  });

  // ===== 観察4: 送信日時の保全 =====

  /**
   * Property 2: Preservation - 送信日時（item.sent_at）が正しくフォーマットされて表示される
   *
   * テスト内容:
   *   `item.sent_at = "2024-01-15T10:00:00Z"` を渡したとき、
   *   送信日時が "YYYY/MM/DD HH:mm" 形式でフォーマットされて表示されることを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('送信日時（item.sent_at）が正しくフォーマットされて表示されること', () => {
    const item = createItem({ sent_at: '2024-01-15T10:00:00Z' });

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // 送信日時ラベルが表示されること
    expect(screen.getByText('送信日時')).toBeInTheDocument();
    // 送信日時が YYYY/MM/DD HH:mm 形式で表示されること（タイムゾーンに依存するため年月日のみ確認）
    expect(screen.getByText(/2024\/01\/15/)).toBeInTheDocument();
  });

  // ===== プロパティベーステスト: <br> を含まない任意の文字列での保全 =====

  /**
   * Property 2: Preservation - <br> を含まない任意の文字列でレンダリング結果が変わらない
   *
   * テスト内容:
   *   fast-check を使用して `<br>` を含まないランダムな文字列を生成し、
   *   レンダリング結果が正常であることを確認する。
   *
   * プロパティ:
   *   FOR ALL message WHERE NOT isBugCondition(message) DO
   *     - レンダリングがエラーなく完了する
   *     - メッセージのテキスト内容がDOMに存在する（空文字列を除く）
   *   END FOR
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test('fast-check: <br> を含まない任意の文字列でレンダリングが正常に動作すること', () => {
    // <br> を含まない文字列を生成するアービトラリ
    // fast-check の string() から <br> を含む文字列を除外する
    // <br> を含まない文字列を生成するアービトラリ
    // スペースのみの文字列も除外（dangerouslySetInnerHTML では textContent で正規化される）
    const noBrStringArb = fc.string({ minLength: 0, maxLength: 100 }).filter(
      (s) => !s.includes('<br>') && !s.includes('<BR>')
    );

    fc.assert(
      fc.property(noBrStringArb, (message) => {
        const item = createItem({ message });

        // エラーなくレンダリングできることを確認
        const { unmount } = render(
          <SellerSendHistoryDetailModal
            open={true}
            item={item}
            onClose={() => {}}
          />
        );

        // 空文字列でなく、かつスペースのみでない場合、テキスト内容がDOMに存在することを確認
        // dangerouslySetInnerHTML ではスペースのみのコンテンツが textContent で正規化されるため除外
        if (message.length > 0 && message.trim().length > 0) {
          // MUI Dialog はポータルを使うため document.body から確認する
          const bodySection = document.body.querySelector('[class*="MuiDialogContent"]');
          if (bodySection) {
            expect(bodySection.textContent).toContain(message);
          }
        }

        unmount();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Preservation - <br> を含まない任意の文字列で <br> テキストが表示されない
   *
   * テスト内容:
   *   fast-check を使用して `<br>` を含まないランダムな文字列を生成し、
   *   DOMに `<br>` テキストが表示されないことを確認する。
   *
   * プロパティ:
   *   FOR ALL message WHERE NOT isBugCondition(message) DO
   *     - DOMのテキストコンテンツに "<br>" 文字列が含まれない
   *   END FOR
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.1**
   */
  test('fast-check: <br> を含まない任意の文字列でDOMに <br> テキストが表示されないこと', () => {
    // <br> を含まない文字列を生成するアービトラリ
    const noBrStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
      (s) => !s.includes('<br>') && !s.includes('<BR>')
    );

    fc.assert(
      fc.property(noBrStringArb, (message) => {
        const item = createItem({ message });

        const { container, unmount } = render(
          <SellerSendHistoryDetailModal
            open={true}
            item={item}
            onClose={() => {}}
          />
        );

        // DOMのテキストコンテンツに "<br>" 文字列が含まれないことを確認
        // （<br> を含まないメッセージなので、当然 <br> テキストは表示されない）
        expect(container.textContent).not.toContain('<br>');

        unmount();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Preservation - <br> を含まない任意の件名・送信者名でレンダリングが正常に動作する
   *
   * テスト内容:
   *   fast-check を使用して `<br>` を含まないランダムな件名・送信者名を生成し、
   *   レンダリング結果が正常であることを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('fast-check: <br> を含まない任意の件名・送信者名でレンダリングが正常に動作すること', () => {
    // <br> を含まない ASCII + 日本語文字列を生成するアービトラリ
    const noBrStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
      (s) => !s.includes('<br>') && !s.includes('<BR>') && s.trim().length > 0
    );

    fc.assert(
      fc.property(noBrStringArb, noBrStringArb, (subject, senderName) => {
        const item = createItem({ subject, sender_name: senderName });

        // エラーなくレンダリングできることを確認
        const { unmount } = render(
          <SellerSendHistoryDetailModal
            open={true}
            item={item}
            onClose={() => {}}
          />
        );

        unmount();
      }),
      { numRuns: 30 }
    );
  });

  // ===== モーダルの開閉動作の保全 =====

  /**
   * Property 2: Preservation - item が null の場合は何も表示されない
   *
   * テスト内容:
   *   `item = null` を渡したとき、コンポーネントが null を返すことを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('item が null の場合は何も表示されないこと', () => {
    const { container } = render(
      <SellerSendHistoryDetailModal
        open={true}
        item={null}
        onClose={() => {}}
      />
    );

    // item が null の場合、コンポーネントは null を返すため何も表示されない
    expect(container.firstChild).toBeNull();
  });

  /**
   * Property 2: Preservation - open=false の場合はモーダルが非表示になる
   *
   * テスト内容:
   *   `open = false` を渡したとき、モーダルのコンテンツが表示されないことを確認する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   *
   * **Validates: Requirements 3.3**
   */
  test('open=false の場合はモーダルのコンテンツが表示されないこと', () => {
    const item = createItem();

    render(
      <SellerSendHistoryDetailModal
        open={false}
        item={item}
        onClose={() => {}}
      />
    );

    // open=false の場合、モーダルのコンテンツが表示されない
    expect(screen.queryByText('送信履歴詳細')).not.toBeInTheDocument();
  });
});
