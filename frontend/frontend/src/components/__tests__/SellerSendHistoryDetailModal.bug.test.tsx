// @vitest-environment jsdom
/**
 * バグ条件の探索テスト: SellerSendHistoryDetailModal <br>タグ表示バグ
 *
 * **Validates: Requirements 1.1**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件:
 *   `{item.message}` というReactのテキストノードとして描画されているため、
 *   `<br>` などのHTMLタグが文字列としてそのまま表示される。
 *
 * 期待される反例:
 *   `item.message = "村尾和彦様<br>お世話になっております。"` を渡すと、
 *   DOMに `<br>` 要素（HTMLタグ）が存在するはずだが、
 *   修正前のコードでは `<br>` がテキストノードとして表示されるため、
 *   `<br>` 要素が存在しない。
 *   → このアサーションが FAIL する（バグの存在を証明する）
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SellerSendHistoryDetailModal, { SellerSendHistoryItem } from '../SellerSendHistoryDetailModal';

// テスト用のデフォルトアイテム
const createItem = (message: string): SellerSendHistoryItem => ({
  id: 'test-id-1',
  property_number: 'AA001',
  chat_type: 'seller_email',
  subject: 'テスト件名',
  message,
  sender_name: '担当者名',
  sent_at: '2024-01-15T10:00:00Z',
});

describe('SellerSendHistoryDetailModal - バグ条件の探索テスト（<br>タグがプレーンテキストとして表示される）', () => {
  /**
   * テストケース1: 基本的な <br> タグ
   *
   * テスト内容:
   *   - `item.message = "村尾和彦様<br>お世話になっております。"` を渡してレンダリング
   *   - DOMに `<br>` 要素（HTMLタグ）が存在することをアサート
   *
   * 修正前のコードでは:
   *   `{item.message}` がテキストノードとして描画されるため、
   *   `<br>` がHTMLタグとして解釈されず、テキスト文字列として表示される。
   *   → DOMに `<br>` 要素が存在しないため、このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1**
   */
  test('メッセージ内の <br> タグが HTML 改行要素としてレンダリングされること（基本ケース）', () => {
    const message = '村尾和彦様<br>お世話になっております。';
    const item = createItem(message);

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // 本文エリアを取得
    // MUI Dialog はポータルを使うため document.body に描画される
    // DOMに <br> 要素（HTMLタグ）が存在することを確認
    // 修正前のコードでは <br> がテキストノードとして表示されるため、
    // <br> 要素が存在せず、このアサーションが FAIL する
    const brElements = document.body.querySelectorAll('br');
    expect(brElements.length).toBeGreaterThan(0);
  });

  /**
   * テストケース2: 複数の <br> タグ
   *
   * テスト内容:
   *   - `item.message = "行1<br><br>行3"` を渡してレンダリング
   *   - DOMに複数の `<br>` 要素（HTMLタグ）が存在することをアサート
   *
   * 修正前のコードでは:
   *   `{item.message}` がテキストノードとして描画されるため、
   *   `<br><br>` がHTMLタグとして解釈されず、テキスト文字列として表示される。
   *   → DOMに `<br>` 要素が存在しないため、このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1**
   */
  test('メッセージ内の複数の <br> タグが HTML 改行要素としてレンダリングされること（複数ケース）', () => {
    const message = '行1<br><br>行3';
    const item = createItem(message);

    render(
      <SellerSendHistoryDetailModal
        open={true}
        item={item}
        onClose={() => {}}
      />
    );

    // DOMに複数の <br> 要素（HTMLタグ）が存在することを確認
    // MUI Dialog はポータルを使うため document.body に描画される
    // 修正前のコードでは <br> がテキストノードとして表示されるため、
    // <br> 要素が存在せず、このアサーションが FAIL する
    const brElements = document.body.querySelectorAll('br');
    expect(brElements.length).toBeGreaterThanOrEqual(2);
  });
});
