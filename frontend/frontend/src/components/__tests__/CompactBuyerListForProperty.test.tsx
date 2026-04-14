/**
 * バグ条件の探索テスト
 *
 * 目的: 未修正コードで CompactBuyerListForProperty に showCreateButton={false} を渡しても
 * 「新規作成」ボタンが非表示にならないことを確認する（バグの存在を証明する）
 *
 * CRITICAL: このテストは未修正コードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。コードを修正しないこと。
 *
 * Validates: Requirements 1.1, 1.2
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompactBuyerListForProperty from '../CompactBuyerListForProperty';

// react-router-dom のモック
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// テスト用の買主データ
const sampleBuyers = [
  {
    buyer_id: 'buyer-001',
    name: 'テスト買主',
    buyer_number: 'B001',
    reception_date: '2026-01-01',
    latest_status: '追客中',
  },
];

describe('CompactBuyerListForProperty バグ条件の探索テスト', () => {
  /**
   * テスト: showCreateButton={false} を渡しても「新規作成」ボタンが非表示にならないバグ
   *
   * 未修正コードでは showCreateButton プロパティが存在しないため、
   * false を渡しても「新規作成」ボタンが常にレンダリングされる。
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   * （showCreateButton プロパティが存在しないため、ボタンが非表示にならない）
   */
  test('showCreateButton={false} を渡した場合、「新規作成」ボタンが DOM に存在しないこと', () => {
    render(
      <CompactBuyerListForProperty
        buyers={sampleBuyers}
        propertyNumber="P001"
        // @ts-ignore - 未修正コードではこのプロパティが存在しないため型エラーを無視
        showCreateButton={false}
      />
    );

    // 「新規作成」ボタンが DOM に存在しないことをアサートする
    // 未修正コードでは showCreateButton プロパティが実装されていないため、
    // ボタンが常に表示され、このアサーションが FAIL する（バグの証明）
    expect(screen.queryByText('新規作成')).not.toBeInTheDocument();
  });
});

/**
 * 保全プロパティテスト（修正前に実施）
 *
 * 目的: 未修正コードで showCreateButton が未指定（undefined）または true の場合、
 * 「新規作成」ボタンが DOM に存在することを確認する（保全すべきベースライン動作の確認）
 *
 * IMPORTANT: このテストは未修正コードで PASS することが期待される。
 * PASS がベースライン動作の確認を意味する。
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import * as fc from 'fast-check';

describe('CompactBuyerListForProperty 保全プロパティテスト', () => {
  /**
   * Property 2: Preservation
   * showCreateButton が未指定（undefined）の場合、「新規作成」ボタンが DOM に存在すること
   *
   * 未修正コードでは showCreateButton プロパティが存在しないため、
   * 常に「新規作成」ボタンがレンダリングされる（デフォルト動作）。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('showCreateButton が未指定の場合、「新規作成」ボタンが DOM に存在すること', () => {
    render(
      <CompactBuyerListForProperty
        buyers={sampleBuyers}
        propertyNumber="P001"
      />
    );

    // 「新規作成」ボタンが DOM に存在することをアサートする
    // 未修正コードでは showCreateButton プロパティが存在しないため、
    // ボタンが常に表示される（ベースライン動作）
    expect(screen.getByText('新規作成')).toBeInTheDocument();
  });

  /**
   * Property 2: Preservation (プロパティベーステスト)
   * showCreateButton が undefined または true の場合、常に「新規作成」ボタンが DOM に存在すること
   *
   * 様々な buyers 配列と propertyNumber の組み合わせで検証する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('showCreateButton が undefined または true の場合、常に「新規作成」ボタンが DOM に存在すること', () => {
    fc.assert(
      fc.property(
        // showCreateButton: undefined または true のいずれか
        fc.oneof(fc.constant(undefined), fc.constant(true as boolean | undefined)),
        // propertyNumber: 任意の文字列
        fc.string({ minLength: 1, maxLength: 20 }),
        (showCreateButton, propertyNumber) => {
          const { unmount } = render(
            <CompactBuyerListForProperty
              buyers={sampleBuyers}
              propertyNumber={propertyNumber}
              // @ts-ignore - 未修正コードではこのプロパティが存在しないため型エラーを無視
              showCreateButton={showCreateButton}
            />
          );

          // 「新規作成」ボタンが DOM に存在することをアサートする
          const button = screen.queryByText('新規作成');
          const result = button !== null;

          unmount();
          return result;
        }
      ),
      { numRuns: 20 }
    );
  });
});
