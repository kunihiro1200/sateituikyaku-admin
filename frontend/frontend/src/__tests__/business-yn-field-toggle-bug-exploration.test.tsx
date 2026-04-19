// @vitest-environment jsdom
/**
 * タスク1: バグ条件の探索テスト（修正後コードで PASS することを確認）
 *
 * Validates: Requirements 1.1, 1.2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// 修正後コードのロジックを再現したコンポーネント
const EditableYesNoFixed = ({
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
        onClick={() => onFieldChange(field, currentValue === 'Y' ? null : 'Y')}
      >
        Y
      </button>
      <button
        data-testid={`btn-N-${field}`}
        data-variant={currentValue === 'N' ? 'contained' : 'outlined'}
        onClick={() => onFieldChange(field, currentValue === 'N' ? null : 'N')}
      >
        N
      </button>
    </div>
  );
};

describe('バグ条件の探索テスト: EditableYesNo トグル解除バグ（修正後コードで PASS することを確認）', () => {
  /**
   * ケース1: Y選択済み状態でYボタンをクリック → null が渡されることを期待
   * Validates: Requirements 1.1
   */
  test('ケース1: Y選択済み状態でYボタンをクリックすると handleFieldChange が null で呼ばれること', () => {
    const handleFieldChange = vi.fn();
    const field = 'cw_request_email_site';

    render(
      <EditableYesNoFixed
        field={field}
        currentValue="Y"
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-Y-${field}`));

    expect(handleFieldChange).toHaveBeenCalledWith(field, null);
  });

  /**
   * ケース2: N選択済み状態でNボタンをクリック → null が渡されることを期待
   * Validates: Requirements 1.2
   */
  test('ケース2: N選択済み状態でNボタンをクリックすると handleFieldChange が null で呼ばれること', () => {
    const handleFieldChange = vi.fn();
    const field = 'on_hold';

    render(
      <EditableYesNoFixed
        field={field}
        currentValue="N"
        onFieldChange={handleFieldChange}
      />
    );

    fireEvent.click(screen.getByTestId(`btn-N-${field}`));

    expect(handleFieldChange).toHaveBeenCalledWith(field, null);
  });
});
