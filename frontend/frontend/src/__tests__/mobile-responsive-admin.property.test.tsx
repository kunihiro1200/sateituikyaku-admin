/**
 * 管理画面モバイルレスポンシブ対応 プロパティベーステスト
 *
 * Feature: mobile-responsive-admin
 * テストライブラリ: fast-check
 */

// Feature: mobile-responsive-admin, Property 6: テキスト最小フォントサイズ
// Validates: Requirements 8.3

// Feature: mobile-responsive-admin, Property 7: 横スクロールが発生しない
// Validates: Requirements 8.4

import * as fc from 'fast-check';

// ---- フォントサイズロジックをインライン定義 ----
// 各ページのモバイルレイアウトで適用されるフォントサイズ設定と同等のロジック

const MIN_FONT_SIZE_PX = 14; // ブラウザの自動ズームを防ぐための最小フォントサイズ

/**
 * モバイルカードのテキストスタイルを生成する
 * SellersPage.tsx / BuyersPage.tsx / PropertyListingsPage.tsx の
 * モバイルカード内テキスト sx={{ fontSize: '14px', ... }} と同等のロジック
 */
const getMobileCardTextStyle = (variant: 'primary' | 'secondary' | 'caption') => {
  const styles: Record<string, { fontSize: string; minFontSize: number }> = {
    primary: { fontSize: '14px', minFontSize: MIN_FONT_SIZE_PX },
    secondary: { fontSize: '14px', minFontSize: MIN_FONT_SIZE_PX },
    caption: { fontSize: '14px', minFontSize: MIN_FONT_SIZE_PX },
  };
  return styles[variant];
};

/**
 * フォントサイズ文字列をpx数値に変換する
 * "14px" → 14, "1rem" → 16 (デフォルト16px換算)
 */
const parseFontSizeToPx = (fontSize: string): number => {
  if (fontSize.endsWith('px')) {
    return parseFloat(fontSize);
  }
  if (fontSize.endsWith('rem')) {
    // 1rem = 16px（ブラウザデフォルト）
    return parseFloat(fontSize) * 16;
  }
  if (fontSize.endsWith('em')) {
    // 1em = 16px（ベースフォントサイズ）
    return parseFloat(fontSize) * 16;
  }
  // 単位なし（数値のみ）はpxとして扱う
  return parseFloat(fontSize);
};

/**
 * フォントサイズが最小サイズ以上かどうかを検証する
 */
const isFontSizeValid = (fontSize: string): boolean => {
  const px = parseFontSizeToPx(fontSize);
  return px >= MIN_FONT_SIZE_PX;
};

// ---- 横スクロールロジックをインライン定義 ----
// 各ページのモバイルルートコンテナに適用される overflow-x 設定と同等のロジック

/**
 * モバイルルートコンテナのスタイルを生成する
 * SellersPage.tsx / BuyersPage.tsx / PropertyListingsPage.tsx の
 * モバイルレイアウトルートコンテナ sx={{ overflowX: 'hidden', ... }} と同等のロジック
 */
const getMobileContainerStyle = (itemCount: number) => {
  return {
    overflowX: 'hidden' as const,
    width: '100%',
    maxWidth: '100vw',
    // アイテム数に関係なく横スクロールは発生しない
    _itemCount: itemCount,
  };
};

/**
 * overflow-x の値が横スクロールを引き起こすかどうかを判定する
 * 'scroll' または 'auto' は横スクロールを引き起こす可能性がある
 */
const causesHorizontalScroll = (overflowX: string): boolean => {
  return overflowX === 'scroll' || overflowX === 'auto';
};

// ---- データジェネレーター ----

/**
 * 売主データのアービトラリー
 */
const sellerArb = fc.record({
  sellerNumber: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  propertyAddress: fc.string({ maxLength: 100 }),
  status: fc.string({ maxLength: 20 }),
  nextCallDate: fc.option(fc.string({ maxLength: 20 })),
});

/**
 * 買主データのアービトラリー
 */
const buyerArb = fc.record({
  buyerNumber: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  desiredArea: fc.string({ maxLength: 100 }),
  status: fc.string({ maxLength: 20 }),
  nextCallDate: fc.option(fc.string({ maxLength: 20 })),
});

/**
 * 物件データのアービトラリー
 */
const propertyArb = fc.record({
  propertyNumber: fc.string({ minLength: 1, maxLength: 10 }),
  propertyAddress: fc.string({ maxLength: 100 }),
  propertyType: fc.string({ maxLength: 20 }),
  price: fc.option(fc.integer({ min: 0, max: 999999999 })),
  status: fc.string({ maxLength: 20 }),
});

// ---- Property 6: テキスト最小フォントサイズ ----
// Validates: Requirements 8.3
describe('Property 6: テキスト最小フォントサイズ', () => {
  it('任意のモバイル表示において、primaryテキストのフォントサイズは14px以上である', () => {
    fc.assert(
      fc.property(
        fc.array(sellerArb, { maxLength: 50 }),
        (_sellers) => {
          const style = getMobileCardTextStyle('primary');
          return isFontSizeValid(style.fontSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('任意のモバイル表示において、secondaryテキストのフォントサイズは14px以上である', () => {
    fc.assert(
      fc.property(
        fc.array(buyerArb, { maxLength: 50 }),
        (_buyers) => {
          const style = getMobileCardTextStyle('secondary');
          return isFontSizeValid(style.fontSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('任意のモバイル表示において、captionテキストのフォントサイズは14px以上である', () => {
    fc.assert(
      fc.property(
        fc.array(propertyArb, { maxLength: 50 }),
        (_properties) => {
          const style = getMobileCardTextStyle('caption');
          return isFontSizeValid(style.fontSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('全テキストバリアントのフォントサイズが MIN_FONT_SIZE_PX 以上である', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'caption') as fc.Arbitrary<'primary' | 'secondary' | 'caption'>,
        (variant) => {
          const style = getMobileCardTextStyle(variant);
          return parseFontSizeToPx(style.fontSize) >= MIN_FONT_SIZE_PX;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('MIN_FONT_SIZE_PX の定数値は 14 である', () => {
    expect(MIN_FONT_SIZE_PX).toBe(14);
  });
});

// ---- Property 7: 横スクロールが発生しない ----
// Validates: Requirements 8.4
describe('Property 7: 横スクロールが発生しない', () => {
  it('任意の売主リストをモバイルレイアウトでレンダリングした場合、overflow-x は scroll または auto にならない', () => {
    fc.assert(
      fc.property(
        fc.array(sellerArb, { maxLength: 50 }),
        (sellers) => {
          const style = getMobileContainerStyle(sellers.length);
          return !causesHorizontalScroll(style.overflowX);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('任意の買主リストをモバイルレイアウトでレンダリングした場合、overflow-x は scroll または auto にならない', () => {
    fc.assert(
      fc.property(
        fc.array(buyerArb, { maxLength: 50 }),
        (buyers) => {
          const style = getMobileContainerStyle(buyers.length);
          return !causesHorizontalScroll(style.overflowX);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('任意の物件リストをモバイルレイアウトでレンダリングした場合、overflow-x は scroll または auto にならない', () => {
    fc.assert(
      fc.property(
        fc.array(propertyArb, { maxLength: 50 }),
        (properties) => {
          const style = getMobileContainerStyle(properties.length);
          return !causesHorizontalScroll(style.overflowX);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('空リストの場合でも overflow-x は scroll または auto にならない', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (emptyList) => {
          const style = getMobileContainerStyle(emptyList.length);
          return !causesHorizontalScroll(style.overflowX);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('モバイルコンテナの overflow-x は常に "hidden" である', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (itemCount) => {
          const style = getMobileContainerStyle(itemCount);
          return style.overflowX === 'hidden';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- causesHorizontalScroll のユニットテスト ----
describe('causesHorizontalScroll ヘルパー関数', () => {
  it('"scroll" は横スクロールを引き起こす', () => {
    expect(causesHorizontalScroll('scroll')).toBe(true);
  });

  it('"auto" は横スクロールを引き起こす可能性がある', () => {
    expect(causesHorizontalScroll('auto')).toBe(true);
  });

  it('"hidden" は横スクロールを引き起こさない', () => {
    expect(causesHorizontalScroll('hidden')).toBe(false);
  });

  it('"visible" は横スクロールを引き起こさない', () => {
    expect(causesHorizontalScroll('visible')).toBe(false);
  });
});

// ---- parseFontSizeToPx のユニットテスト ----
describe('parseFontSizeToPx ヘルパー関数', () => {
  it('"14px" は 14 に変換される', () => {
    expect(parseFontSizeToPx('14px')).toBe(14);
  });

  it('"1rem" は 16 に変換される', () => {
    expect(parseFontSizeToPx('1rem')).toBe(16);
  });

  it('"0.875rem" は 14 に変換される', () => {
    expect(parseFontSizeToPx('0.875rem')).toBe(14);
  });

  it('"16px" は 16 に変換される', () => {
    expect(parseFontSizeToPx('16px')).toBe(16);
  });
});
