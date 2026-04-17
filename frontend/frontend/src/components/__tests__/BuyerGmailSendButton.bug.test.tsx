// @vitest-environment jsdom
/**
 * バグ条件の探索テスト: BuyerGmailSendButton グレーアウトバグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件:
 *   `isDisabled = selectedCount === 0 || loading` という条件のため、
 *   `selectedPropertyIds` が空の場合にメールアドレスがあってもボタンがグレーアウトされる。
 *
 * 期待される反例:
 *   `buyerEmail: "test@example.com"` があり、`loading = false` であるにもかかわらず、
 *   `selectedPropertyIds` が空の Set のためボタンが `disabled` になる。
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import BuyerGmailSendButton from '../BuyerGmailSendButton';
import { InquiryHistoryItem } from '../InquiryHistoryTable';

// 外部モジュールのモック
vi.mock('../TemplateSelectionModal', () => ({
  default: () => null,
}));

vi.mock('../BuyerEmailCompositionModal', () => ({
  default: () => null,
}));

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    employee: { email: 'employee@example.com' },
  }),
}));

describe('BuyerGmailSendButton - バグ条件の探索テスト（selectedPropertyIds空でグレーアウト）', () => {
  /**
   * Property 1: Bug Condition - メールアドレスあり・selectedPropertyIds空の場合にボタンがグレーアウトされるバグ
   *
   * テスト内容:
   *   - `selectedPropertyIds` が空の `Set`（`status === 'current'` の物件が0件）
   *   - `buyerEmail` が有効なメールアドレス（`test@example.com`）
   *   - `loading = false`
   *   - `inquiryHistory` に1件以上のデータがある（コンポーネントが `null` を返さないようにするため）
   *   ボタンが `disabled` でないことをアサート
   *
   * 修正前のコードでは:
   *   `isDisabled = selectedCount === 0 || loading` が `true` になるため、
   *   ボタンが `disabled` になる。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('メールアドレスあり・selectedPropertyIds空・loading=false の場合、ボタンが disabled でないこと', () => {
    // バグ条件を満たす inquiryHistory:
    // status === 'current' の物件が0件 → selectedPropertyIds が空のまま
    const inquiryHistory: InquiryHistoryItem[] = [
      {
        buyerNumber: 'B7359',
        propertyNumber: 'AA001',
        propertyAddress: '大分市中央町1-1-1',
        inquiryDate: '2024-01-15',
        status: 'past', // 'current' でないため自動選択されない
        propertyId: 'prop-001',
        propertyListingId: 'listing-001',
      },
    ];

    // selectedPropertyIds が空の Set（status === 'current' の物件が0件のため）
    const selectedPropertyIds = new Set<string>();

    render(
      <BuyerGmailSendButton
        buyerId="buyer-7359"
        buyerEmail="test@example.com"
        buyerName="テスト太郎"
        inquiryHistory={inquiryHistory}
        selectedPropertyIds={selectedPropertyIds}
      />
    );

    // Gmail送信ボタンを取得
    const button = screen.getByRole('button', { name: /Gmail送信/i });

    // ボタンが disabled でないことをアサート
    // 修正前のコードでは isDisabled = selectedCount === 0 || loading = true になるため、
    // このアサーションが FAIL する（バグの存在を証明する）
    expect(button).not.toBeDisabled();
  });
});
