// nearbyBuyersPrintUtils のプロパティベーステスト
// Feature: seller-callmode-nearby-buyers-table-enhancements

import * as fc from 'fast-check';
import { buildPrintContent, NearbyBuyer } from './nearbyBuyersPrintUtils';

// 英数字のみの buyer_number を生成（HTMLの他の部分と混同しないよう）
const buyerNumberArb = fc.stringMatching(/^[A-Z0-9]{4,10}$/);

// 任意の NearbyBuyer を生成するアービトラリ
const nearbyBuyerArb = (buyerNumber: string): fc.Arbitrary<NearbyBuyer> =>
  fc.record<NearbyBuyer>({
    buyer_number: fc.constant(buyerNumber),
    name: fc.string({ minLength: 0, maxLength: 50 }),
    distribution_areas: fc.array(fc.string({ minLength: 1, maxLength: 20 })),
    latest_status: fc.string({ minLength: 0, maxLength: 30 }),
    viewing_date: fc.string(),
    reception_date: fc.option(fc.string(), { nil: undefined }),
    inquiry_hearing: fc.option(fc.string(), { nil: undefined }),
    viewing_result_follow_up: fc.option(fc.string(), { nil: undefined }),
    email: fc.option(fc.string(), { nil: undefined }),
    phone_number: fc.option(fc.string(), { nil: undefined }),
    property_address: fc.option(fc.string(), { nil: null }),
    inquiry_property_type: fc.option(fc.string(), { nil: null }),
    inquiry_price: fc.option(fc.integer({ min: 0, max: 100000000 }), { nil: null }),
  });

// buyer_number が一意な買主リストを生成するアービトラリ（英数字IDのみ）
const uniqueBuyersArb = fc
  .uniqueArray(buyerNumberArb, { minLength: 1, maxLength: 10 })
  .chain(buyerNumbers =>
    fc.tuple(...buyerNumbers.map(bn => nearbyBuyerArb(bn)))
  )
  .map(buyers => buyers as NearbyBuyer[]);

/**
 * Property 3: 印刷対象の選択フィルタリング
 * Validates: Requirements 2.3, 2.4
 *
 * 任意の買主リストと任意の選択セット（1件以上）に対して、
 * 選択行のみが含まれ非選択行が含まれないことを検証する
 */
describe('Property 3: 印刷対象の選択フィルタリング', () => {
  it('選択された買主番号のみが印刷コンテンツに含まれる', () => {
    fc.assert(
      fc.property(
        uniqueBuyersArb,
        fc.integer({ min: 0, max: 100 }),
        (buyers, seed) => {
          // 1件以上を選択（seedを使って決定的に選択）
          const count = Math.max(1, (seed % buyers.length) + 1);
          const selectedBuyerNumbers = new Set(
            buyers.slice(0, count).map(b => b.buyer_number)
          );

          const html = buildPrintContent(buyers, selectedBuyerNumbers, false);

          // 選択された買主番号が全て含まれる（要件 2.3）
          for (const buyerNumber of selectedBuyerNumbers) {
            expect(html).toContain(buyerNumber);
          }

          // 選択されていない買主番号が含まれない（要件 2.4）
          const unselectedBuyers = buyers.filter(
            b => !selectedBuyerNumbers.has(b.buyer_number)
          );
          for (const buyer of unselectedBuyers) {
            expect(html).not.toContain(buyer.buyer_number);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('選択セットが空の場合、テーブル本体に行が含まれない', () => {
    fc.assert(
      fc.property(uniqueBuyersArb, buyers => {
        const emptySelection = new Set<string>();
        const html = buildPrintContent(buyers, emptySelection, false);

        // tbody が空（<tr> が含まれない）
        const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
        expect(tbodyMatch).not.toBeNull();
        const tbodyContent = tbodyMatch![1].trim();
        expect(tbodyContent).toBe('');
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: 印刷レイアウトの会社情報
 * Validates: Requirements 2.5
 *
 * 任意の選択状態でも、印刷用コンテンツに会社情報3項目が全て含まれることを検証する
 */
describe('Property 4: 印刷レイアウトの会社情報', () => {
  it('印刷コンテンツに会社情報が必ず含まれる', () => {
    fc.assert(
      fc.property(
        uniqueBuyersArb,
        fc.integer({ min: 0, max: 100 }),
        (buyers, seed) => {
          const count = Math.max(1, (seed % buyers.length) + 1);
          const selectedBuyerNumbers = new Set(
            buyers.slice(0, count).map(b => b.buyer_number)
          );

          const html = buildPrintContent(buyers, selectedBuyerNumbers, false);

          // 会社情報3項目が全て含まれる（要件 2.5）
          expect(html).toContain('株式会社いふう');
          expect(html).toContain('大分市舞鶴町1-3-30 STビル１F');
          expect(html).toContain('097-533-2022');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('選択が空でも会社情報が含まれる', () => {
    fc.assert(
      fc.property(uniqueBuyersArb, buyers => {
        const html = buildPrintContent(buyers, new Set<string>(), false);

        expect(html).toContain('株式会社いふう');
        expect(html).toContain('大分市舞鶴町1-3-30 STビル１F');
        expect(html).toContain('097-533-2022');
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: 名前非表示状態での印刷
 * Validates: Requirements 2.8
 *
 * isNameHidden = true のとき、印刷用コンテンツの名前セルに黒塗りスタイルが適用されていることを検証する
 */
describe('Property 5: 名前非表示状態での印刷', () => {
  it('isNameHidden=true のとき名前セルに黒塗りスタイルが適用される', () => {
    fc.assert(
      fc.property(
        uniqueBuyersArb,
        fc.integer({ min: 0, max: 100 }),
        (buyers, seed) => {
          const count = Math.max(1, (seed % buyers.length) + 1);
          const selectedBuyerNumbers = new Set(
            buyers.slice(0, count).map(b => b.buyer_number)
          );

          const html = buildPrintContent(buyers, selectedBuyerNumbers, true);

          // 選択された買主が1件以上ある場合、黒塗りスタイルが含まれる（要件 2.8）
          if (selectedBuyerNumbers.size > 0) {
            expect(html).toContain('background-color:black;color:black;');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isNameHidden=false のとき黒塗りスタイルが適用されない', () => {
    fc.assert(
      fc.property(
        uniqueBuyersArb,
        fc.integer({ min: 0, max: 100 }),
        (buyers, seed) => {
          const count = Math.max(1, (seed % buyers.length) + 1);
          const selectedBuyerNumbers = new Set(
            buyers.slice(0, count).map(b => b.buyer_number)
          );

          const html = buildPrintContent(buyers, selectedBuyerNumbers, false);

          // 黒塗りスタイルが含まれない
          expect(html).not.toContain('background-color:black;color:black;');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isNameHidden=true と false で生成されるHTMLが異なる（選択行あり）', () => {
    fc.assert(
      fc.property(
        uniqueBuyersArb,
        fc.integer({ min: 0, max: 100 }),
        (buyers, seed) => {
          const count = Math.max(1, (seed % buyers.length) + 1);
          const selectedBuyerNumbers = new Set(
            buyers.slice(0, count).map(b => b.buyer_number)
          );

          const htmlHidden = buildPrintContent(buyers, selectedBuyerNumbers, true);
          const htmlVisible = buildPrintContent(buyers, selectedBuyerNumbers, false);

          // 選択行がある場合、2つのHTMLは異なる
          if (selectedBuyerNumbers.size > 0) {
            expect(htmlHidden).not.toBe(htmlVisible);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
