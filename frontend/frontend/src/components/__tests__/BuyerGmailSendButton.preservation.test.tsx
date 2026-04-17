// @vitest-environment jsdom
/**
 * 保全プロパティテスト: BuyerGmailSendButton
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）。
 * バグ条件が成立しない入力での既存動作を観察・記録し、
 * 修正後も同じ動作が保持されることを確認するためのベースラインを作成する。
 */

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import BuyerGmailSendButton from '../BuyerGmailSendButton';
import { InquiryHistoryItem } from '../InquiryHistoryTable';

// 外部モジュールのモック（BuyerGmailSendButton.bug.test.tsx と同じ）
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

describe('BuyerGmailSendButton - 保全プロパティテスト（バグ条件が成立しない入力での既存動作）', () => {
  /**
   * Property 2-1: selectedPropertyIds に物件IDが1件以上ある場合、ボタンが有効化される
   *
   * バグ条件が成立しない（isBugCondition = false）ケース:
   *   - status === 'current' の物件が1件以上存在する → selectedPropertyIds に物件IDが入る
   *   - ボタンが有効化されることを確認
   *
   * **Validates: Requirements 3.1**
   */
  test('selectedPropertyIds に物件IDが1件以上ある場合（isBugCondition が false）、ボタンが有効化される', () => {
    const inquiryHistory: InquiryHistoryItem[] = [
      {
        buyerNumber: 'B0001',
        propertyNumber: 'AA100',
        propertyAddress: '東京都渋谷区1-1-1',
        inquiryDate: '2024-03-01',
        status: 'current', // status === 'current' → selectedPropertyIds に自動選択される
        propertyId: 'prop-100',
        propertyListingId: 'listing-100',
      },
    ];

    // status === 'current' の物件が1件あるため selectedPropertyIds に物件IDが入る
    const selectedPropertyIds = new Set<string>(['prop-100']);

    render(
      <BuyerGmailSendButton
        buyerId="buyer-0001"
        buyerEmail="test@example.com"
        buyerName="テスト花子"
        inquiryHistory={inquiryHistory}
        selectedPropertyIds={selectedPropertyIds}
      />
    );

    const button = screen.getByRole('button', { name: /Gmail送信/i });

    // ボタンが有効化されていることを確認（バグ条件が成立しないため）
    expect(button).not.toBeDisabled();
  });

  /**
   * Property 2-2: selectedPropertyIds が空でも loading=false の場合、ボタンが有効化される（修正後の動作）
   *
   * 修正後: isDisabled = loading のみ。selectedPropertyIds の状態に関わらず loading=false ならボタンは有効。
   *
   * **Validates: Requirements 2.1, 3.1**
   */
  test('selectedPropertyIds が空でも loading=false の場合、ボタンが有効化される（修正後の動作）', () => {
    const inquiryHistory: InquiryHistoryItem[] = [
      {
        buyerNumber: 'B0002',
        propertyNumber: 'AA200',
        propertyAddress: '大阪府大阪市2-2-2',
        inquiryDate: '2024-03-02',
        status: 'past', // status !== 'current' → selectedPropertyIds は空のまま
        propertyId: 'prop-200',
        propertyListingId: 'listing-200',
      },
    ];

    const emptySelectedPropertyIds = new Set<string>();

    render(
      <BuyerGmailSendButton
        buyerId="buyer-0002"
        buyerEmail="test2@example.com"
        buyerName="テスト次郎"
        inquiryHistory={inquiryHistory}
        selectedPropertyIds={emptySelectedPropertyIds}
      />
    );

    const button = screen.getByRole('button', { name: /Gmail送信/i });

    // 修正後: isDisabled = loading = false → ボタンは有効化される
    expect(button).not.toBeDisabled();
  });

  /**
   * Property 2-3: selectedPropertyIds が空の状態でボタンをクリックすると「物件を選択してください」が表示される
   *
   * 修正後: ボタンは有効化されているため、クリックすると handleClick が呼ばれ
   * 「物件を選択してください」エラーメッセージが表示される。
   *
   * **Validates: Requirements 3.2**
   */
  test('selectedPropertyIds が空の状態でボタンをクリックすると「物件を選択してください」が表示される', async () => {
    const inquiryHistory: InquiryHistoryItem[] = [
      {
        buyerNumber: 'B0003',
        propertyNumber: 'AA300',
        propertyAddress: '名古屋市中区3-3-3',
        inquiryDate: '2024-03-03',
        status: 'past', // status !== 'current' → selectedPropertyIds は空のまま
        propertyId: 'prop-300',
        propertyListingId: 'listing-300',
      },
    ];

    // selectedPropertyIds が空（status === 'current' の物件が0件）
    const selectedPropertyIds = new Set<string>();

    render(
      <BuyerGmailSendButton
        buyerId="buyer-0003"
        buyerEmail="test3@example.com"
        buyerName="テスト三郎"
        inquiryHistory={inquiryHistory}
        selectedPropertyIds={selectedPropertyIds}
      />
    );

    const button = screen.getByRole('button', { name: /Gmail送信/i });

    // 修正後: ボタンは有効化されている
    expect(button).not.toBeDisabled();

    // クリックすると handleClick が呼ばれ「物件を選択してください」が表示される
    fireEvent.click(button);
    expect(screen.getByText('物件を選択してください')).toBeInTheDocument();
  });

  /**
   * Property 2-4: inquiryHistory が空配列の場合、コンポーネントが null を返す（ボタンが表示されない）
   *
   * 問い合わせ履歴が0件の場合、BuyerGmailSendButton は null を返す動作は修正前後で変わらない。
   *
   * **Validates: Requirements 3.4**
   */
  test('inquiryHistory が空配列の場合、コンポーネントが null を返す（ボタンが表示されない）', () => {
    const emptyInquiryHistory: InquiryHistoryItem[] = [];
    const selectedPropertyIds = new Set<string>();

    render(
      <BuyerGmailSendButton
        buyerId="buyer-0004"
        buyerEmail="test4@example.com"
        buyerName="テスト四郎"
        inquiryHistory={emptyInquiryHistory}
        selectedPropertyIds={selectedPropertyIds}
      />
    );

    // inquiryHistory が空の場合、コンポーネントは null を返すためボタンが表示されない
    expect(screen.queryByRole('button', { name: /Gmail送信/i })).not.toBeInTheDocument();
  });
});
