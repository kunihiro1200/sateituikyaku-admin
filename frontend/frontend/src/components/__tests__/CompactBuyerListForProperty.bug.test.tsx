// @vitest-environment jsdom
/**
 * バグ条件の探索テスト: 内覧日フィールド名不一致バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件:
 *   バックエンドは `latest_viewing_date` フィールドとして内覧日を返すが、
 *   フロントエンドの `BuyerWithDetails` インターフェースは `viewing_date` を参照するため、
 *   `latest_viewing_date` が非 null・非 undefined であっても内覧日が `undefined` になる。
 *
 * 期待される反例:
 *   `latest_viewing_date: "2025-03-15"` を持つ買主の内覧日列が
 *   `2025/03/15` ではなく `-` と表示される。
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import CompactBuyerListForProperty from '../CompactBuyerListForProperty';

// react-router-dom のモック
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('CompactBuyerListForProperty - バグ条件の探索テスト（内覧日フィールド名不一致）', () => {
  /**
   * Property 1: Bug Condition - 内覧日フィールド名不一致バグ
   *
   * テスト内容:
   *   `latest_viewing_date: "2025-03-15"` を持つ買主データを渡したとき、
   *   内覧日列に `2025/03/15` が表示されることを期待する。
   *
   * 修正前のコードでは:
   *   `BuyerWithDetails` インターフェースが `viewing_date` を参照するため、
   *   `latest_viewing_date` は無視され、内覧日列に `-` が表示される。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('latest_viewing_date が "2025-03-15" の買主の内覧日列に "2025/03/15" が表示されること', () => {
    // バグ条件を満たす買主データ:
    // latest_viewing_date が非 null・非 undefined であるにもかかわらず、
    // フロントエンドが viewing_date を参照するため undefined になる
    const buyerWithViewingDate = {
      latest_viewing_date: '2025-03-15',
      name: 'テスト太郎',
      buyer_number: 'B001',
    };

    render(
      <CompactBuyerListForProperty
        // @ts-ignore - 修正前のインターフェースは latest_viewing_date を持たないため型エラーを無視
        buyers={[buyerWithViewingDate]}
        propertyNumber="AA278"
        showCreateButton={false}
      />
    );

    // 内覧日列に "2025/03/15" が表示されることを期待する
    // 修正前のコードでは viewing_date が undefined のため "-" が表示され、
    // このアサーションが FAIL する（バグの存在を証明する）
    expect(screen.getByText('2025/03/15')).toBeInTheDocument();
  });
});
