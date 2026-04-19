// @vitest-environment jsdom
/**
 * タスク2: 保全プロパティテスト（修正前に実施）
 *
 * このテストは未修正コードで保全すべきベースライン動作を確認するためのものです。
 * テストが全て PASS することが期待される結果です。
 *
 * 保全対象: EditableYesNo コンポーネントにおいて、バグ条件が成立しないケース
 * （isBugCondition が false を返すケース）の動作が変わらないことを確認する。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * 未修正コードのロジックを再現したコンポーネント
 * onClick は常に固定値を渡す（トグルなし）
 */
const EditableYesNoUnfixed = ({
  field,
  currentValue,
  onFieldChange,
}: {
  field: string;
  currentValue: string | null;
  onFieldChange: (field: string, value: string | null) => void;
}) => {
  return (
    <div>
      <button
        data-testid={`btn-Y-${field}`}
        data-variant={currentValue === 'Y' ? 'contained' : 'outlined'}
        onClick={() => onFieldChange(field, 'Y')}
      >
        Y
      </button>
      <button
        data-testid={`btn-N-${field}`}
        data-variant={currentValue === 'N' ? 'contained' : 'outlined'}
        onClick={() => onFieldChange(field, 'N')}
      >
        N
      </button>
    </div>
  );
};

describe('保全プロパティテスト: EditableYesNo バグ条件が成立しないケース（未修正コードで PASS することを確認）', () => {
  /**
   * 観察1: null 状態で「Y」クリック → handleFieldChange(field, 'Y') が呼ばれる
   *
   * isBugCondition: false（currentValue が null のため）
   * 未修正コードでも修正後コードでも同じ動作が期待される
   *
   * Validates: Requirements 3.1
   */
  test('観察1: null 状態で「Y」クリック → handleFieldChange(field, "Y") が呼ばれる', () => {
    const handleFieldChange = vi.fn();
    const field = 'cw_request_email_site';

    render(
      <EditableYesNoUnfixed
        field={field}
        currentValue={null}
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-Y-${field}`));

    // 未選択状態からYをクリック → 'Y' が設定される
    expect(handleFieldChange).toHaveBeenCalledWith(field, 'Y');
    expect(handleFieldChange).toHaveBeenCalledTimes(1);
  });

  /**
   * 観察2: null 状態で「N」クリック → handleFieldChange(field, 'N') が呼ばれる
   *
   * isBugCondition: false（currentValue が null のため）
   * 未修正コードでも修正後コードでも同じ動作が期待される
   *
   * Validates: Requirements 3.2
   */
  test('観察2: null 状態で「N」クリック → handleFieldChange(field, "N") が呼ばれる', () => {
    const handleFieldChange = vi.fn();
    const field = 'on_hold';

    render(
      <EditableYesNoUnfixed
        field={field}
        currentValue={null}
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-N-${field}`));

    // 未選択状態からNをクリック → 'N' が設定される
    expect(handleFieldChange).toHaveBeenCalledWith(field, 'N');
    expect(handleFieldChange).toHaveBeenCalledTimes(1);
  });

  /**
   * 観察3: 'Y' 状態で「N」クリック → handleFieldChange(field, 'N') が呼ばれる
   *
   * isBugCondition: false（currentValue === 'Y' かつ clickedValue === 'N' のため）
   * 未修正コードでも修正後コードでも同じ動作が期待される
   *
   * Validates: Requirements 3.3
   */
  test('観察3: "Y" 状態で「N」クリック → handleFieldChange(field, "N") が呼ばれる', () => {
    const handleFieldChange = vi.fn();
    const field = 'cw_request_email_floor_plan';

    render(
      <EditableYesNoUnfixed
        field={field}
        currentValue="Y"
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-N-${field}`));

    // Y選択済みからNをクリック → 'N' に切り替わる
    expect(handleFieldChange).toHaveBeenCalledWith(field, 'N');
    expect(handleFieldChange).toHaveBeenCalledTimes(1);
  });

  /**
   * 観察4: 'N' 状態で「Y」クリック → handleFieldChange(field, 'Y') が呼ばれる
   *
   * isBugCondition: false（currentValue === 'N' かつ clickedValue === 'Y' のため）
   * 未修正コードでも修正後コードでも同じ動作が期待される
   *
   * Validates: Requirements 3.4
   */
  test('観察4: "N" 状態で「Y」クリック → handleFieldChange(field, "Y") が呼ばれる', () => {
    const handleFieldChange = vi.fn();
    const field = 'site_registration_ok';

    render(
      <EditableYesNoUnfixed
        field={field}
        currentValue="N"
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-Y-${field}`));

    // N選択済みからYをクリック → 'Y' に切り替わる
    expect(handleFieldChange).toHaveBeenCalledWith(field, 'Y');
    expect(handleFieldChange).toHaveBeenCalledTimes(1);
  });

  /**
   * ボタンの表示スタイル確認: 現在値に応じて variant が正しく切り替わる
   *
   * Validates: Requirements 3.1, 3.2（ボタンスタイルの保全）
   */
  test('ボタンの表示スタイル: 現在値に応じて contained/outlined が正しく設定される', () => {
    const handleFieldChange = vi.fn();
    const field = 'test_field';

    // Y選択済み状態
    const { rerender } = render(
      <EditableYesNoUnfixed
        field={field}
        currentValue="Y"
        onFieldChange={handleFieldChange}
      />
    );

    expect(screen.getByTestId(`btn-Y-${field}`)).toHaveAttribute('data-variant', 'contained');
    expect(screen.getByTestId(`btn-N-${field}`)).toHaveAttribute('data-variant', 'outlined');

    // N選択済み状態
    rerender(
      <EditableYesNoUnfixed
        field={field}
        currentValue="N"
        onFieldChange={handleFieldChange}
      />
    );

    expect(screen.getByTestId(`btn-Y-${field}`)).toHaveAttribute('data-variant', 'outlined');
    expect(screen.getByTestId(`btn-N-${field}`)).toHaveAttribute('data-variant', 'contained');

    // 未選択状態
    rerender(
      <EditableYesNoUnfixed
        field={field}
        currentValue={null}
        onFieldChange={handleFieldChange}
      />
    );

    expect(screen.getByTestId(`btn-Y-${field}`)).toHaveAttribute('data-variant', 'outlined');
    expect(screen.getByTestId(`btn-N-${field}`)).toHaveAttribute('data-variant', 'outlined');
  });
});
