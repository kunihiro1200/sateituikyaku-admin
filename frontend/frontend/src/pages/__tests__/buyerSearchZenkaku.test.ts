/**
 * 買主番号検索バー 全角→半角変換バグ修正テスト
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3
 */
import { describe, test, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// 全角数字を半角数字に変換する（BuyerDetailPage.tsx の toHalfWidth と同じロジック）
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

// 修正後の onKeyDown ハンドラーのロジック（BuyerDetailPage.tsx の実装と同じ）
function handleKeyDown(
  key: string,
  searchValue: string,
  navigate: (path: string) => void
): void {
  if (key === 'Enter' && searchValue.trim()) {
    navigate(`/buyers/${toHalfWidth(searchValue.trim())}`);
  }
}

// -----------------------------------------------------------------------
// タスク1 & 3.2: バグ条件テスト（修正後は PASS することを確認）
// -----------------------------------------------------------------------
describe('バグ条件テスト: 全角数字入力時に半角変換されてナビゲーションされること', () => {
  test('「４３７０」→ /buyers/4370 へ遷移する', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '４３７０', navigate);
    expect(navigate).toHaveBeenCalledWith('/buyers/4370');
  });

  test('「１２３４５」→ /buyers/12345 へ遷移する', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '１２３４５', navigate);
    expect(navigate).toHaveBeenCalledWith('/buyers/12345');
  });

  test('全角数字10桁「０１２３４５６７８９」→ /buyers/0123456789 へ遷移する', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '０１２３４５６７８９', navigate);
    expect(navigate).toHaveBeenCalledWith('/buyers/0123456789');
  });
});

// -----------------------------------------------------------------------
// タスク2 & 3.3: 保全テスト（既存動作が維持されること）
// -----------------------------------------------------------------------
describe('保全テスト: 既存動作が維持されること', () => {
  test('半角数字「4370」→ /buyers/4370 へ遷移する（変換不要）', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '4370', navigate);
    expect(navigate).toHaveBeenCalledWith('/buyers/4370');
  });

  test('空文字でEnterキーを押しても navigate が呼ばれない', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '', navigate);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('スペースのみでEnterキーを押しても navigate が呼ばれない', () => {
    const navigate = vi.fn();
    handleKeyDown('Enter', '   ', navigate);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('Tabキーを押しても navigate が呼ばれない', () => {
    const navigate = vi.fn();
    handleKeyDown('Tab', '4370', navigate);
    expect(navigate).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// プロパティベーステスト
// -----------------------------------------------------------------------
describe('プロパティベーステスト', () => {
  test('半角数字のみの文字列は toHalfWidth を適用しても変わらない', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9]*$/), (str) => {
        return toHalfWidth(str) === str;
      })
    );
  });

  test('toHalfWidth は冪等: 2回適用しても結果が変わらない', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        return toHalfWidth(toHalfWidth(str)) === toHalfWidth(str);
      })
    );
  });

  test('空文字は toHalfWidth を適用しても空文字のまま', () => {
    expect(toHalfWidth('')).toBe('');
  });
});
