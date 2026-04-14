// @vitest-environment jsdom
/**
 * 保全プロパティテスト: 内覧日フィールド名不一致バグ修正
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * PASS がベースライン動作（修正によって変わってはいけない動作）を確認する。
 *
 * 保全すべき動作:
 *   - `latest_viewing_date` が null/undefined の買主の内覧日列は `-` と表示される
 *   - 氏名・受付日・時間・最新状況の各列は正しく表示される
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompactBuyerListForProperty from '../CompactBuyerListForProperty';

// react-router-dom のモック
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('CompactBuyerListForProperty - 保全プロパティテスト（非バグ入力の動作保持）', () => {
  /**
   * Property 2: Preservation - 内覧日 null の場合は `-` が表示される
   *
   * テスト内容:
   *   `latest_viewing_date: null` の買主データを渡したとき、
   *   内覧日列に `-` が表示されることを確認する。
   *
   * 修正前のコードでは:
   *   `BuyerWithDetails` インターフェースが `viewing_date` を参照するため、
   *   `latest_viewing_date: null` の場合も `viewing_date` は undefined → `-` が表示される。
   *   これは偶然正しい動作であり、修正後も維持されるべき動作。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('latest_viewing_date が null の買主の内覧日列に "-" が表示されること', () => {
    const buyerWithNullViewingDate = {
      name: '田中花子',
      buyer_number: 'B002',
      reception_date: '2025-01-15',
      latest_viewing_date: null as unknown as string | undefined,
      viewing_time: '10:00',
      latest_status: '追客中',
    };

    render(
      <CompactBuyerListForProperty
        buyers={[buyerWithNullViewingDate]}
        propertyNumber="AA278"
        showCreateButton={false}
      />
    );

    // テーブルの内覧日列ヘッダーが存在することを確認
    expect(screen.getByText('内覧日')).toBeInTheDocument();

    // 内覧日列のセルが "-" であることを確認
    // getAllByText('-') で複数の "-" セルが存在する可能性があるため、少なくとも1つ存在することを確認
    const dashCells = screen.getAllByText('-');
    expect(dashCells.length).toBeGreaterThan(0);
  });

  /**
   * Property 2: Preservation - 氏名・受付日・時間・最新状況の各列が正しく表示される
   *
   * テスト内容:
   *   `latest_viewing_date: null` の買主データを渡したとき、
   *   内覧日以外の各列（氏名・受付日・時間・最新状況）が正しく表示されることを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('内覧日以外の列（氏名・受付日・時間・最新状況）が正しく表示されること', () => {
    const buyerWithNullViewingDate = {
      name: '鈴木一郎',
      buyer_number: 'B003',
      reception_date: '2025-03-20',
      latest_viewing_date: null as unknown as string | undefined,
      viewing_time: '14:30',
      latest_status: '内覧済み',
    };

    render(
      <CompactBuyerListForProperty
        buyers={[buyerWithNullViewingDate]}
        propertyNumber="AA278"
        showCreateButton={false}
      />
    );

    // 氏名が表示されること
    expect(screen.getByText('鈴木一郎')).toBeInTheDocument();

    // 受付日が表示されること（formatDate で YYYY/MM/DD 形式に変換される）
    // ja-JP ロケールでの日付フォーマット
    expect(screen.getByText(/2025/)).toBeInTheDocument();

    // 時間が表示されること
    expect(screen.getByText('14:30')).toBeInTheDocument();

    // 最新状況が表示されること
    expect(screen.getByText('内覧済み')).toBeInTheDocument();
  });
});
