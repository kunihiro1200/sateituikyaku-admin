/**
 * 保全プロパティテスト（Preservation Property Test）
 * seller-sidebar-today-tel-sync-bug
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation - 次電日が今日以前の売主は「当日TEL分」に引き続き含まれる
 *
 * このテストは未修正コードで実行し、**成功することを確認する**（ベースライン動作の確認）
 *
 * テスト内容:
 * 1. 次電日が今日以前の売主（追客中・コミュニケーション情報が全て空・営担なし）が「当日TEL分」に含まれることを確認
 * 2. 次電日が今日より未来の売主はDBを直接クエリした場合「当日TEL分」に含まれないことを確認
 * 3. プロパティベーステスト: ランダムな next_call_date に対して isTodayCall() の判定ロジックが正しいことを確認
 * 4. 次電日以外のフィールド（状況、営担など）の条件が正常に機能することを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fc from 'fast-check';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// JST今日の日付を取得
function getTodayJST(): string {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 日付を加算するヘルパー
function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * isTodayCall() のロジックをバックエンドで再現
 * （フロントエンドの sellerStatusFilters.ts の isTodayCall() と同等のロジック）
 *
 * 「当日TEL分」の条件:
 * - 状況（当社）に「追客中」が含まれる
 * - 次電日が今日以前
 * - コミュニケーション情報（contact_method, preferred_contact_time, phone_contact_person）が全て空
 * - 営担（visit_assignee）が空
 */
function isTodayCallLogic(seller: {
  status: string | null;
  next_call_date: string | null;
  contact_method: string | null;
  preferred_contact_time: string | null;
  phone_contact_person: string | null;
  visit_assignee: string | null;
}): boolean {
  const todayJST = getTodayJST();

  // 営担に入力がある場合は除外
  const visitAssignee = seller.visit_assignee || '';
  if (visitAssignee.trim() !== '') {
    return false;
  }

  // 状況（当社）に「追客」が含まれるかチェック
  const status = seller.status || '';
  if (!status.includes('追客')) {
    return false;
  }

  // 「追客不要」「専任媒介」「一般媒介」が含まれる場合は除外
  if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) {
    return false;
  }

  // 次電日が空の場合は除外
  if (!seller.next_call_date) {
    return false;
  }

  // 次電日が今日以前かチェック（文字列比較）
  const nextCallDate = String(seller.next_call_date).substring(0, 10);
  if (nextCallDate > todayJST) {
    return false;
  }

  // コミュニケーション情報が全て空かチェック
  const isValid = (v: string | null): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
  if (isValid(seller.contact_method) || isValid(seller.preferred_contact_time) || isValid(seller.phone_contact_person)) {
    return false;
  }

  return true;
}

describe('seller-sidebar-today-tel-sync-bug: 保全プロパティテスト', () => {
  let testSellerId: string;
  let testSellerNumber: string;

  beforeAll(async () => {
    // テスト用売主を作成（当日TEL分の条件を満たす）
    const todayJST = getTodayJST();
    testSellerNumber = `PRSV${Date.now()}`;

    const { data, error } = await supabase
      .from('sellers')
      .insert({
        seller_number: testSellerNumber,
        name: 'テスト売主（保全テスト）',
        status: '追客中',
        next_call_date: todayJST, // 今日 → 当日TEL分の条件を満たす
        visit_assignee: null,     // 営担なし
        phone_contact_person: null,
        preferred_contact_time: null,
        contact_method: null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`テスト用売主の作成に失敗: ${error?.message}`);
    }

    testSellerId = data.id;
    console.log(`✅ テスト用売主を作成: ${testSellerNumber} (ID: ${testSellerId})`);
  });

  afterAll(async () => {
    if (testSellerId) {
      await supabase.from('sellers').delete().eq('id', testSellerId);
      console.log(`🗑️ テスト用売主を削除: ${testSellerNumber}`);
    }
  });

  /**
   * テスト1: 次電日が今日以前の売主が「当日TEL分」に含まれることを確認
   *
   * 保全要件: 次電日が今日以前の売主（追客中・コミュニケーション情報が全て空・営担なし）は
   * 「当日TEL分」に引き続き含まれること
   *
   * 未修正コードで成功することが期待される（ベースライン動作）
   */
  test('テスト1: 次電日が今日以前の売主（追客中・コミュニケーション情報なし・営担なし）が「当日TEL分」に含まれる', async () => {
    console.log('\n--- テスト1: 当日TEL分の保全確認 ---');

    const todayJST = getTodayJST();
    const yesterdayJST = addDays(todayJST, -1);

    // テスト用売主を今日の次電日に設定
    await supabase
      .from('sellers')
      .update({
        status: '追客中',
        next_call_date: todayJST,
        visit_assignee: null,
        phone_contact_person: null,
        preferred_contact_time: null,
        contact_method: null,
      })
      .eq('id', testSellerId);

    // DBを直接クエリして「当日TEL分」の条件を確認
    const { data: todayCallSellers, error } = await supabase
      .from('sellers')
      .select('seller_number, next_call_date, status, visit_assignee, phone_contact_person, preferred_contact_time, contact_method')
      .eq('status', '追客中')
      .lte('next_call_date', todayJST)
      .is('visit_assignee', null)
      .is('phone_contact_person', null)
      .is('preferred_contact_time', null)
      .is('contact_method', null)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`DBクエリに失敗: ${error.message}`);
    }

    console.log(`当日TEL分の売主数（DBクエリ）: ${todayCallSellers?.length ?? 0}`);

    const isIncluded = todayCallSellers?.some(s => s.seller_number === testSellerNumber);
    console.log(`テスト用売主が当日TEL分に含まれるか: ${isIncluded}`);

    // 保全確認: 次電日が今日の売主は当日TEL分に含まれるべき
    expect(isIncluded).toBe(true);
    console.log('✅ 保全確認: 次電日が今日の売主は当日TEL分に含まれる');

    // 昨日の次電日でも確認
    await supabase
      .from('sellers')
      .update({ next_call_date: yesterdayJST })
      .eq('id', testSellerId);

    const { data: yesterdayCallSellers } = await supabase
      .from('sellers')
      .select('seller_number, next_call_date')
      .eq('status', '追客中')
      .lte('next_call_date', todayJST)
      .is('visit_assignee', null)
      .is('phone_contact_person', null)
      .is('preferred_contact_time', null)
      .is('contact_method', null)
      .is('deleted_at', null);

    const isIncludedYesterday = yesterdayCallSellers?.some(s => s.seller_number === testSellerNumber);
    console.log(`次電日が昨日の売主が当日TEL分に含まれるか: ${isIncludedYesterday}`);
    expect(isIncludedYesterday).toBe(true);
    console.log('✅ 保全確認: 次電日が昨日の売主も当日TEL分に含まれる');
  });

  /**
   * テスト2: 次電日が今日より未来の売主はDBを直接クエリした場合「当日TEL分」に含まれない
   *
   * 保全要件: DBが正しい場合（next_call_date > today）、
   * DBを直接クエリすると「当日TEL分」に含まれないことを確認
   *
   * 未修正コードで成功することが期待される（DBクエリは正しく動作する）
   */
  test('テスト2: 次電日が今日より未来の売主はDBを直接クエリした場合「当日TEL分」に含まれない', async () => {
    console.log('\n--- テスト2: 未来の次電日の売主が除外されることを確認 ---');

    const todayJST = getTodayJST();
    const futureDate = addDays(todayJST, 30); // 30日後

    // テスト用売主の次電日を未来に設定
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ next_call_date: futureDate })
      .eq('id', testSellerId);

    if (updateError) {
      throw new Error(`next_call_date の更新に失敗: ${updateError.message}`);
    }

    console.log(`テスト用売主の next_call_date を未来(${futureDate})に設定`);

    // DBを直接クエリして「当日TEL分」の条件を確認
    const { data: todayCallSellers, error } = await supabase
      .from('sellers')
      .select('seller_number, next_call_date, status')
      .eq('status', '追客中')
      .lte('next_call_date', todayJST)
      .is('visit_assignee', null)
      .is('phone_contact_person', null)
      .is('preferred_contact_time', null)
      .is('contact_method', null)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`DBクエリに失敗: ${error.message}`);
    }

    const isIncluded = todayCallSellers?.some(s => s.seller_number === testSellerNumber);
    console.log(`テスト用売主が当日TEL分に含まれるか（DBクエリ）: ${isIncluded}`);

    // 保全確認: 次電日が未来の売主はDBクエリでは除外されるべき
    expect(isIncluded).toBe(false);
    console.log('✅ 保全確認: 次電日が未来の売主はDBを直接クエリした場合「当日TEL分」に含まれない');
  });

  /**
   * テスト3: プロパティベーステスト - isTodayCall() の判定ロジックが正しいことを確認
   *
   * ランダムな next_call_date（今日以前・今日・今日以降・null）に対して
   * isTodayCall() の判定ロジックが正しいことを確認する
   *
   * **Validates: Requirements 3.1**
   *
   * 未修正コードで成功することが期待される（ベースライン動作）
   */
  test('テスト3: プロパティベーステスト - isTodayCall() の判定ロジックが正しい', () => {
    console.log('\n--- テスト3: isTodayCall() プロパティベーステスト ---');

    const todayJST = getTodayJST();

    // 今日以前の日付を生成するアービトラリー
    const pastDateArb = fc.integer({ min: 1, max: 365 }).map(days => addDays(todayJST, -days));
    // 今日の日付
    const todayArb = fc.constant(todayJST);
    // 今日以降の日付を生成するアービトラリー
    const futureDateArb = fc.integer({ min: 1, max: 365 }).map(days => addDays(todayJST, days));
    // null
    const nullArb = fc.constant(null);

    // プロパティ1: 次電日が今日以前の場合、isTodayCall() は true を返す（他の条件が全て満たされている場合）
    fc.assert(
      fc.property(
        fc.oneof(pastDateArb, todayArb),
        (nextCallDate) => {
          const seller = {
            status: '追客中',
            next_call_date: nextCallDate,
            contact_method: null,
            preferred_contact_time: null,
            phone_contact_person: null,
            visit_assignee: null,
          };
          const result = isTodayCallLogic(seller);
          if (!result) {
            console.log(`❌ 失敗: next_call_date=${nextCallDate}, result=${result}`);
          }
          return result === true;
        }
      ),
      { numRuns: 100, verbose: false }
    );
    console.log('✅ プロパティ1: 次電日が今日以前の場合、isTodayCall() は true を返す');

    // プロパティ2: 次電日が今日より未来の場合、isTodayCall() は false を返す
    fc.assert(
      fc.property(
        futureDateArb,
        (nextCallDate) => {
          const seller = {
            status: '追客中',
            next_call_date: nextCallDate,
            contact_method: null,
            preferred_contact_time: null,
            phone_contact_person: null,
            visit_assignee: null,
          };
          const result = isTodayCallLogic(seller);
          if (result) {
            console.log(`❌ 失敗: next_call_date=${nextCallDate}, result=${result}`);
          }
          return result === false;
        }
      ),
      { numRuns: 100, verbose: false }
    );
    console.log('✅ プロパティ2: 次電日が今日より未来の場合、isTodayCall() は false を返す');

    // プロパティ3: 次電日が null の場合、isTodayCall() は false を返す
    fc.assert(
      fc.property(
        nullArb,
        (nextCallDate) => {
          const seller = {
            status: '追客中',
            next_call_date: nextCallDate,
            contact_method: null,
            preferred_contact_time: null,
            phone_contact_person: null,
            visit_assignee: null,
          };
          return isTodayCallLogic(seller) === false;
        }
      ),
      { numRuns: 10, verbose: false }
    );
    console.log('✅ プロパティ3: 次電日が null の場合、isTodayCall() は false を返す');

    console.log('✅ 全プロパティテスト成功: isTodayCall() の判定ロジックは正しい');
  });

  /**
   * テスト4: 次電日以外のフィールド（状況、営担など）の条件が正常に機能することを確認
   *
   * 保全要件:
   * - 状況が「追客中」でない場合は除外される
   * - 営担がある場合は除外される
   * - コミュニケーション情報がある場合は除外される
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * 未修正コードで成功することが期待される（ベースライン動作）
   */
  test('テスト4: 次電日以外のフィールド（状況、営担など）の条件が正常に機能する', async () => {
    console.log('\n--- テスト4: 次電日以外のフィールドの条件確認 ---');

    const todayJST = getTodayJST();

    // テスト用売主を当日TEL分の条件に設定
    await supabase
      .from('sellers')
      .update({
        status: '追客中',
        next_call_date: todayJST,
        visit_assignee: null,
        phone_contact_person: null,
        preferred_contact_time: null,
        contact_method: null,
      })
      .eq('id', testSellerId);

    // ケース1: 状況が「追客中」の場合 → 当日TEL分に含まれる
    const seller1 = {
      status: '追客中',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller1)).toBe(true);
    console.log('✅ ケース1: 状況が「追客中」の場合、当日TEL分に含まれる');

    // ケース2: 状況が「追客不要」の場合 → 当日TEL分に含まれない
    const seller2 = {
      status: '追客不要',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller2)).toBe(false);
    console.log('✅ ケース2: 状況が「追客不要」の場合、当日TEL分に含まれない');

    // ケース3: 営担がある場合 → 当日TEL分に含まれない
    const seller3 = {
      status: '追客中',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: 'Y',
    };
    expect(isTodayCallLogic(seller3)).toBe(false);
    console.log('✅ ケース3: 営担がある場合、当日TEL分に含まれない');

    // ケース4: コミュニケーション情報（contact_method）がある場合 → 当日TEL分に含まれない
    const seller4 = {
      status: '追客中',
      next_call_date: todayJST,
      contact_method: 'Eメール',
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller4)).toBe(false);
    console.log('✅ ケース4: contact_method がある場合、当日TEL分に含まれない');

    // ケース5: コミュニケーション情報（preferred_contact_time）がある場合 → 当日TEL分に含まれない
    const seller5 = {
      status: '追客中',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: '午前中',
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller5)).toBe(false);
    console.log('✅ ケース5: preferred_contact_time がある場合、当日TEL分に含まれない');

    // ケース6: コミュニケーション情報（phone_contact_person）がある場合 → 当日TEL分に含まれない
    const seller6 = {
      status: '追客中',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: 'Y',
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller6)).toBe(false);
    console.log('✅ ケース6: phone_contact_person がある場合、当日TEL分に含まれない');

    // ケース7: 「除外後追客中」の場合 → 当日TEL分に含まれる（「追客」が含まれるため）
    const seller7 = {
      status: '除外後追客中',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller7)).toBe(true);
    console.log('✅ ケース7: 「除外後追客中」の場合、当日TEL分に含まれる');

    // ケース8: 「専任媒介」の場合 → 当日TEL分に含まれない
    const seller8 = {
      status: '専任媒介',
      next_call_date: todayJST,
      contact_method: null,
      preferred_contact_time: null,
      phone_contact_person: null,
      visit_assignee: null,
    };
    expect(isTodayCallLogic(seller8)).toBe(false);
    console.log('✅ ケース8: 「専任媒介」の場合、当日TEL分に含まれない');

    console.log('\n✅ テスト4完了: 次電日以外のフィールドの条件が正常に機能する');
  });

  /**
   * テスト5: プロパティベーステスト - 次電日以外のフィールドの条件が任意の入力で正しく機能する
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * 未修正コードで成功することが期待される（ベースライン動作）
   */
  test('テスト5: プロパティベーステスト - 次電日以外のフィールドの条件が任意の入力で正しく機能する', () => {
    console.log('\n--- テスト5: 次電日以外のフィールドのプロパティベーステスト ---');

    const todayJST = getTodayJST();

    // プロパティ4: 営担がある場合、isTodayCall() は常に false を返す
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim() !== ''),
        (visitAssignee) => {
          const seller = {
            status: '追客中',
            next_call_date: todayJST,
            contact_method: null,
            preferred_contact_time: null,
            phone_contact_person: null,
            visit_assignee: visitAssignee,
          };
          return isTodayCallLogic(seller) === false;
        }
      ),
      { numRuns: 50, verbose: false }
    );
    console.log('✅ プロパティ4: 営担がある場合、isTodayCall() は常に false を返す');

    // プロパティ5: contact_method がある場合、isTodayCall() は常に false を返す
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim() !== '' && s.toLowerCase() !== 'null'),
        (contactMethod) => {
          const seller = {
            status: '追客中',
            next_call_date: todayJST,
            contact_method: contactMethod,
            preferred_contact_time: null,
            phone_contact_person: null,
            visit_assignee: null,
          };
          return isTodayCallLogic(seller) === false;
        }
      ),
      { numRuns: 50, verbose: false }
    );
    console.log('✅ プロパティ5: contact_method がある場合、isTodayCall() は常に false を返す');

    // プロパティ6: 「追客不要」「専任媒介」「一般媒介」を含む状況の場合、isTodayCall() は常に false を返す
    const excludedStatuses = ['追客不要', '専任媒介', '一般媒介', '除外後追客不要'];
    for (const status of excludedStatuses) {
      const seller = {
        status,
        next_call_date: todayJST,
        contact_method: null,
        preferred_contact_time: null,
        phone_contact_person: null,
        visit_assignee: null,
      };
      expect(isTodayCallLogic(seller)).toBe(false);
    }
    console.log('✅ プロパティ6: 除外ステータスの場合、isTodayCall() は常に false を返す');

    console.log('\n✅ テスト5完了: 次電日以外のフィールドのプロパティベーステスト成功');
  });
});
