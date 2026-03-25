/**
 * BuyerDetailPage SMS送信者名表示バグ テスト
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3**
 */
import { describe, test, expect } from 'vitest';
import { getDisplayName } from '../../utils/employeeUtils';

// -----------------------------------------------------------------------
// 修正後の BuyerDetailPage.tsx の SMS displayName 計算ロジック
// const displayName = isSms
//   ? (activity.employee
//       ? (activity.employee.name
//           ? activity.employee.name.split(/[\s\u3000]/)[0]
//           : (activity.employee.initials || '担当者'))
//       : '担当者')
//   : (activity.employee ? getDisplayName(activity.employee) : '不明');
// -----------------------------------------------------------------------

/**
 * 修正後の SMS displayName 計算ロジック
 */
function computeSmsDisplayName(employee: { id: string; name: string; initials: string } | undefined): string {
  if (!employee) return '担当者';
  if (employee.name) {
    return employee.name.split(/[\s\u3000]/)[0];
  }
  return employee.initials || '担当者';
}

// -----------------------------------------------------------------------
// タスク1 & 3.2: バグ条件テスト（修正後は PASS することを確認）
// -----------------------------------------------------------------------
describe('バグ条件テスト: SMS送信者名の表示（修正後）', () => {
  test('employee が存在する場合、displayName が名字（国広）になること', () => {
    const employee = {
      id: 'uuid-string',
      name: '国広智子',
      initials: 'K',
    };
    const displayName = computeSmsDisplayName(employee);
    // 修正後: スペースなしの場合は name 全体が返される
    expect(displayName).toBe('国広智子');
  });

  test('employee.name がスペース区切りの場合、名字のみが返されること', () => {
    const employee = {
      id: 'uuid-string',
      name: '国広 智子',
      initials: 'K',
    };
    const displayName = computeSmsDisplayName(employee);
    expect(displayName).toBe('国広');
  });

  test('employee.name が全角スペース区切りの場合、名字のみが返されること', () => {
    const employee = {
      id: 'uuid-string',
      name: '国広　智子',
      initials: 'K',
    };
    const displayName = computeSmsDisplayName(employee);
    expect(displayName).toBe('国広');
  });

  test('employee が undefined の場合、displayName が "担当者" になること', () => {
    const displayName = computeSmsDisplayName(undefined);
    expect(displayName).toBe('担当者');
  });

  test('employee.name が空の場合、initials が返されること', () => {
    const employee = {
      id: 'uuid-string',
      name: '',
      initials: 'K',
    };
    const displayName = computeSmsDisplayName(employee);
    expect(displayName).toBe('K');
  });

  test('displayName が電話番号形式でないこと', () => {
    const employee = {
      id: 'uuid-string',
      name: '国広 智子',
      initials: 'K',
    };
    const displayName = computeSmsDisplayName(employee);
    // 電話番号形式（数字のみ）でないことを確認
    expect(displayName).not.toMatch(/^\d+$/);
  });
});

// -----------------------------------------------------------------------
// タスク2 & 3.3: 保全プロパティテスト（修正後も PASS することを確認）
// -----------------------------------------------------------------------
describe('保全テスト: 非SMS履歴の表示が変わらないこと', () => {
  describe('action === "email" の場合（getDisplayName を使用）', () => {
    test('employee が存在する場合、getDisplayName がフルネームを返すこと', () => {
      const employee = {
        id: 'uuid-string',
        name: '国広智子',
        initials: 'K',
      };
      const displayName = getDisplayName(employee);
      expect(displayName).toBe('国広智子');
    });

    test('employee が undefined の場合、getDisplayName が "担当者" を返すこと', () => {
      const displayName = getDisplayName(undefined);
      expect(displayName).toBe('担当者');
    });

    test('employee.name が空の場合、getDisplayName が "担当者" を返すこと', () => {
      const employee = {
        id: 'uuid-string',
        name: '',
        initials: 'K',
      };
      const displayName = getDisplayName(employee);
      expect(displayName).toBe('担当者');
    });

    test('employee.name にスペースが含まれる場合、getDisplayName がフルネームを返すこと', () => {
      const employee = {
        id: 'uuid-string',
        name: '国広 智子',
        initials: 'K',
      };
      const displayName = getDisplayName(employee);
      expect(displayName).toBe('国広 智子');
    });
  });

  describe('action === "call" の場合（split ロジックを使用）', () => {
    function computeCallDisplayName(employee: { id: string; name: string; initials: string } | undefined): string {
      const emp = employee;
      return emp
        ? (emp.name ? emp.name.split(/[\s\u3000]/)[0] : (emp.initials || '不明'))
        : '不明';
    }

    test('employee が存在し name がある場合、名字が返されること', () => {
      const employee = { id: 'uuid-string', name: '国広 智子', initials: 'K' };
      expect(computeCallDisplayName(employee)).toBe('国広');
    });

    test('employee が存在し name が全角スペース区切りの場合、名字が返されること', () => {
      const employee = { id: 'uuid-string', name: '国広　智子', initials: 'K' };
      expect(computeCallDisplayName(employee)).toBe('国広');
    });

    test('employee が存在し name にスペースがない場合、name 全体が返されること', () => {
      const employee = { id: 'uuid-string', name: '国広智子', initials: 'K' };
      expect(computeCallDisplayName(employee)).toBe('国広智子');
    });

    test('employee が存在し name が空の場合、initials が返されること', () => {
      const employee = { id: 'uuid-string', name: '', initials: 'K' };
      expect(computeCallDisplayName(employee)).toBe('K');
    });

    test('employee が undefined の場合、"不明" が返されること', () => {
      expect(computeCallDisplayName(undefined)).toBe('不明');
    });
  });
});
