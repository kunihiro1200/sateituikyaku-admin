import { describe, test, expect } from 'vitest';
import { generateCalendarTitle, generateCalendarDescription } from '../pages/BuyerViewingResultPage';
import * as fc from 'fast-check';

describe('generateCalendarTitle', () => {
  // 具体例テスト
  test('専任物件・自社物件の場合', () => {
    expect(generateCalendarTitle('【内覧_専（自社物件）】', null, '大分市中央町1-1-1', null))
      .toBe('【内覧_専（自社物件）】大分市中央町1-1-1');
  });

  test('一般媒介・立会不要の場合（買主氏名なし）', () => {
    expect(generateCalendarTitle(null, '準不【内覧_一般（立会不要）】', '別府市光町8-7（海月不動産）', '山田太郎'))
      .toBe('準不【内覧_一般（立会不要）】別府市光町8-7（海月不動産）');
  });

  test('専任・立会の場合（買主氏名あり）', () => {
    expect(generateCalendarTitle('準不【内覧_専（立会）】', null, '大分市中央町1-1-1', '山田太郎'))
      .toBe('準不【内覧_専（立会）】大分市中央町1-1-1（山田太郎）');
  });

  test('一般媒介・立会の場合（買主氏名あり）', () => {
    expect(generateCalendarTitle(null, '準不【内覧_一般（立会）】', '別府市光町8-7', '田中花子'))
      .toBe('準不【内覧_一般（立会）】別府市光町8-7（田中花子）');
  });

  test('立会だが名前が空の場合（）を付けない', () => {
    expect(generateCalendarTitle('準不【内覧_専（立会）】', null, '大分市中央町1-1-1', null))
      .toBe('準不【内覧_専（立会）】大分市中央町1-1-1');
  });

  test('viewing_typeが空の場合はviewing_type_generalを使用', () => {
    expect(generateCalendarTitle('', '【内覧_一般（自社物件）】', '大分市中央町1-1-1', null))
      .toBe('【内覧_一般（自社物件）】大分市中央町1-1-1');
  });

  // プロパティベーステスト（numRuns: 20 で高速化）
  test('Property 1: タイトルはviewingTypeValue+propertyAddrで始まる', () => {
    /**
     * Validates: Requirements 1.1, 1.5
     */
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (vt, vtg, addr, name) => {
          const result = generateCalendarTitle(vt, vtg, addr, name);
          const viewingTypeValue = vt || vtg || '';
          const propertyAddr = addr || '';
          const expected = `${viewingTypeValue}${propertyAddr}`.trim();
          return result.startsWith(expected.substring(0, Math.min(expected.length, 10)));
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: 立会不要の場合は買主氏名を追加しない', () => {
    /**
     * Validates: Requirements 2.1, 2.2, 2.4
     */
    fc.assert(
      fc.property(
        fc.constantFrom('準不【内覧_専（立会不要）】', '準不【内覧_一般（立会不要）】'),
        fc.string().filter(s => s.length > 0),
        fc.string().filter(s => s.length > 0),
        (vt, addr, name) => {
          const result = generateCalendarTitle(vt, null, addr, name);
          return !result.includes(`（${name}）`);
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('generateCalendarDescription', () => {
  test('Property 4: 説明欄末尾に買主詳細URLが含まれる', () => {
    /**
     * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
     */
    fc.assert(
      fc.property(
        fc.string().filter(s => s.length > 0 && !s.includes('\n')),
        (buyerNumber) => {
          const result = generateCalendarDescription(null, null, null, buyerNumber, null, null);
          return result.includes(`買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/${buyerNumber}`);
        }
      ),
      { numRuns: 20 }
    );
  });
});
