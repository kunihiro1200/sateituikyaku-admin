/**
 * タスク1: バグ条件の探索テスト
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// api モジュールをモック
jest.mock('../services/api', () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  return {
    __esModule: true,
    default: {
      get: mockGet,
      post: mockPost,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    },
  };
});

// employeeService をモック
jest.mock('../services/employeeService', () => ({
  getActiveEmployees: jest.fn().mockResolvedValue([]),
}));

// EmailTemplateSelector をモック
jest.mock('../components/EmailTemplateSelector', () => ({
  __esModule: true,
  default: () => null,
}));

// BuyerFilterSummaryModal をモック
jest.mock('../components/BuyerFilterSummaryModal', () => ({
  __esModule: true,
  default: () => null,
}));

// DistributionConfirmationModal をモック
jest.mock('../components/DistributionConfirmationModal', () => ({
  __esModule: true,
  default: () => null,
}));

import api from '../services/api';
import GmailDistributionButton from '../components/GmailDistributionButton';
import PriceSection from '../components/PriceSection';

const mockApi = api as jest.Mocked<typeof api>;

describe('バグ条件の探索テスト（未修正コードで失敗することを確認）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * テスト1: GmailDistributionButton のボタンラベル確認
   * バグ: ボタンテキストが「公開前、値下げメール配信」になっている
   * 期待値: 「公開前、値下げメール」（「配信」なし）
   * 未修正コードでは失敗する（反例: ボタンテキストが「公開前、値下げメール配信」）
   */
  test('テスト1: GmailDistributionButton のボタンテキストが「公開前、値下げメール」であること', () => {
    render(
      <GmailDistributionButton
        propertyNumber="P001"
        propertyAddress="大分市中央町1-1-1"
        distributionAreas="001"
      />
    );

    // 未修正コードでは「公開前、値下げメール配信」と表示されるため失敗する
    expect(screen.getByText('公開前、値下げメール')).toBeInTheDocument();
  });

  /**
   * テスト2: PriceSection の scheduled-notifications API 呼び出し確認
   * バグ: propertyNumber が設定されると /scheduled-notifications への API 呼び出しが発生する
   * 期待値: API 呼び出しが発生しない
   * 未修正コードでは失敗する（反例: api.get が呼ばれる）
   */
  test('テスト2: PriceSection マウント後に /scheduled-notifications への API 呼び出しが発生しないこと', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue({
      response: { status: 404 },
      message: 'Request failed with status code 404',
    });

    render(
      <PriceSection
        propertyNumber="P001"
        onFieldChange={jest.fn()}
        editedData={{}}
        isEditMode={false}
        onChatSendSuccess={jest.fn()}
        onChatSendError={jest.fn()}
      />
    );

    await waitFor(() => {
      // 未修正コードでは api.get が呼ばれるため失敗する
      const scheduledNotificationsCall = (mockApi.get as jest.Mock).mock.calls.find(
        (call: string[]) => call[0]?.includes('/scheduled-notifications')
      );
      expect(scheduledNotificationsCall).toBeUndefined();
    });
  });

  /**
   * テスト3: PriceSection マウント後に console.error が呼ばれないこと
   * バグ: 存在しないエンドポイントへの API 呼び出しが失敗し console.error が出力される
   * 期待値: console.error が呼ばれない
   * 未修正コードでは失敗する（反例: console.error が呼ばれる）
   */
  test('テスト3: PriceSection マウント後に console.error が呼ばれないこと', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    (mockApi.get as jest.Mock).mockRejectedValue({
      response: { status: 404 },
      message: 'Request failed with status code 404',
    });

    render(
      <PriceSection
        propertyNumber="P001"
        onFieldChange={jest.fn()}
        editedData={{}}
        isEditMode={false}
        onChatSendSuccess={jest.fn()}
        onChatSendError={jest.fn()}
      />
    );

    // 修正後のコードでは api.get は呼ばれないため、単純に待機してから確認する
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 修正後のコードでは 'Failed to fetch scheduled notifications:' は出力されない
    const scheduledNotificationsError = consoleErrorSpy.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('Failed to fetch scheduled notifications')
    );
    expect(scheduledNotificationsError).toBeUndefined();
  });
});
