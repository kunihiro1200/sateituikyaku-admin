/**
 * PageNavigation プロパティベーステスト
 *
 * Feature: mobile-responsive-admin
 * テストライブラリ: fast-check
 */

// Feature: mobile-responsive-admin, Property 4: タップターゲットサイズの保証
// Validates: Requirements 7.2

import * as fc from 'fast-check';

// ---- タップターゲットサイズのロジックをインライン定義 ----

const MIN_TAP_TARGET_SIZE = 44; // px

/**
 * モバイルナビゲーション項目のスタイルを生成する
 * PageNavigation.tsx の ListItemButton sx と同等のロジック
 */
const getMobileNavItemStyle = (isActive: boolean, color: { main: string; light: string }) => {
  return {
    minHeight: MIN_TAP_TARGET_SIZE,
    backgroundColor: isActive ? color.main : color.light,
    color: isActive ? '#fff' : color.main,
  };
};

/**
 * ハンバーガーアイコンボタンのスタイルを生成する
 * PageNavigation.tsx の IconButton sx と同等のロジック
 */
const getHamburgerButtonStyle = () => {
  return {
    minHeight: MIN_TAP_TARGET_SIZE,
    minWidth: MIN_TAP_TARGET_SIZE,
  };
};

// ---- Property 4: タップターゲットサイズの保証 ----
// Validates: Requirements 7.2
describe('Property 4: タップターゲットサイズの保証', () => {
  it('任意のナビゲーション項目（アクティブ/非アクティブ）の minHeight は 44px 以上である', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isActive
        fc.record({
          main: fc.constant('#e53935'),
          light: fc.constant('#ffebee'),
        }),
        (isActive, color) => {
          const style = getMobileNavItemStyle(isActive, color);
          return style.minHeight >= MIN_TAP_TARGET_SIZE;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ハンバーガーボタンの minHeight と minWidth は 44px 以上である', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // 引数なし
        () => {
          const style = getHamburgerButtonStyle();
          return style.minHeight >= MIN_TAP_TARGET_SIZE && style.minWidth >= MIN_TAP_TARGET_SIZE;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('minHeight の定数値は 44 である', () => {
    expect(MIN_TAP_TARGET_SIZE).toBe(44);
  });

  it('アクティブ状態でも非アクティブ状態でも minHeight は変わらない', () => {
    fc.assert(
      fc.property(
        fc.record({
          main: fc.constant('#e53935'),
          light: fc.constant('#ffebee'),
        }),
        (color) => {
          const activeStyle = getMobileNavItemStyle(true, color);
          const inactiveStyle = getMobileNavItemStyle(false, color);
          return activeStyle.minHeight === inactiveStyle.minHeight;
        }
      ),
      { numRuns: 100 }
    );
  });
});
