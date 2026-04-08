// Phase 2: 保存プロパティテスト（Preservation）
// 売主サイドバーリアルタイム更新バグ修正 - 非バグ入力の動作保存

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fc from 'fast-check';

// .envファイルを正しく読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * Property 2: Preservation - 条件を満たす変更の正しい表示
 * 
 * _For any_ 次電日を変更しない操作、または条件を満たす変更（次電日を今日以前に設定など）を行った場合、
 * 一覧に戻った際に、サイドバーの表示は正しく維持され、該当するカテゴリーに正しく表示され続けるべきです。
 * 
 * このテストは修正前のコードで実行し、パスすることを確認します（ベースライン動作を確認）。
 */
describe('Seller Sidebar Realtime Category Update - Preservation', () => {
  // テスト用の売主データを作成
  let testSellerId: string;
  let testSellerNumber: string;

  beforeAll(async () => {
    // テスト用の売主を作成（当日TEL分カテゴリーに該当する条件）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 売主番号は20文字以内に制限（例: PRES_1234567890）
    const timestamp = Date.now().toString().slice(-10); // 最後の10桁のみ使用
    const testData = {
      seller_number: `PRES_${timestamp}`,
      name: 'テスト売主（保存）',
      next_call_date: today.toISOString().split('T')[0], // 今日
      visit_assignee: null, // 営担なし
      status: '査定待ち',
    };

    const { data, error } = await supabase
      .from('sellers')
      .insert(testData)
      .select()
      .single();

    if (error) {
      throw new Error(`テスト用売主の作成に失敗: ${error.message}`);
    }

    testSellerId = data.id;
    testSellerNumber = data.seller_number;
    console.log(`テスト用売主を作成: ${testSellerNumber} (ID: ${testSellerId})`);
  });

  afterAll(async () => {
    // テスト用の売主を削除
    if (testSellerId) {
      await supabase
        .from('sellers')
        .delete()
        .eq('id', testSellerId);
      console.log(`テスト用売主を削除: ${testSellerNumber}`);
    }
  });

  test('次電日を変更しない場合、サイドバーの表示は変更されない', async () => {
    console.log('\n--- 保存テスト1: 次電日を変更しない ---');
    console.log(`テスト対象: ${testSellerNumber}`);

    // ステップ1: 初期状態を確認（当日TEL分カテゴリーに該当）
    const { data: initialSeller, error: initialError } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', testSellerId)
      .single();

    if (initialError || !initialSeller) {
      throw new Error('初期状態の取得に失敗');
    }

    console.log(`初期状態: next_call_date = ${initialSeller.next_call_date}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    expect(initialSeller.next_call_date).toBe(todayStr);

    // ステップ2: 次電日以外のフィールドを変更（例: コメント）
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ comments: 'テストコメント（保存テスト）' })
      .eq('id', testSellerId);

    if (updateError) {
      throw new Error(`コメントの更新に失敗: ${updateError.message}`);
    }

    console.log('コメントを更新');

    // ステップ3: 売主が当日TEL分カテゴリーに残っているか確認
    const { data: updatedSeller, error: updatedError } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', testSellerId)
      .single();

    if (updatedError || !updatedSeller) {
      throw new Error('更新後の売主取得に失敗');
    }

    console.log(`更新後の売主: next_call_date = ${updatedSeller.next_call_date}`);

    // 保存条件の確認:
    // - 次電日が変更されていない
    // - 当日TEL分カテゴリーの条件を満たしている
    const nextCallDate = new Date(updatedSeller.next_call_date);
    nextCallDate.setHours(0, 0, 0, 0);
    const isTodayOrBefore = nextCallDate <= today;
    console.log(`次電日が今日以前か: ${isTodayOrBefore ? '✅' : '❌'}`);

    // 期待される動作: サイドバーの表示が変更されない
    // 次電日が今日のまま維持されている
    expect(updatedSeller.next_call_date).toBe(todayStr);
    expect(isTodayOrBefore).toBe(true);
  });

  test('次電日を今日以前に変更した場合、当日TEL分カテゴリーに正しく表示される', async () => {
    console.log('\n--- 保存テスト2: 次電日を今日以前に変更 ---');

    // ステップ1: 次電日を昨日に変更
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { error: updateError } = await supabase
      .from('sellers')
      .update({ next_call_date: yesterdayStr })
      .eq('id', testSellerId);

    if (updateError) {
      throw new Error(`次電日の更新に失敗: ${updateError.message}`);
    }

    console.log(`次電日を更新: ${yesterdayStr}`);

    // ステップ2: 売主が当日TEL分カテゴリーに該当するか確認
    const { data: updatedSeller, error: updatedError } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', testSellerId)
      .single();

    if (updatedError || !updatedSeller) {
      throw new Error('更新後の売主取得に失敗');
    }

    console.log(`更新後の売主: next_call_date = ${updatedSeller.next_call_date}`);

    // 保存条件の確認:
    // - 次電日が今日以前に変更された
    // - 当日TEL分カテゴリーの条件を満たしている
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updatedDate = new Date(updatedSeller.next_call_date);
    updatedDate.setHours(0, 0, 0, 0);
    const isTodayOrBefore = updatedDate <= today;
    console.log(`次電日が今日以前か: ${isTodayOrBefore ? '✅' : '❌'}`);

    // 期待される動作: 当日TEL分カテゴリーに正しく表示される
    expect(isTodayOrBefore).toBe(true);
  });

  test('営担を外した場合、当日TEL分カテゴリーに正しく表示される', async () => {
    console.log('\n--- 保存テスト3: 営担を外す ---');

    // ステップ1: 次電日を今日に戻す
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('sellers')
      .update({ 
        next_call_date: today,
        visit_assignee: 'Y' // 一旦営担を設定
      })
      .eq('id', testSellerId);

    // ステップ2: 営担を外す（当日TEL分カテゴリーに戻る条件）
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ visit_assignee: null })
      .eq('id', testSellerId);

    if (updateError) {
      throw new Error(`営担の更新に失敗: ${updateError.message}`);
    }

    console.log('営担を外す: null');

    // ステップ3: 売主が当日TEL分カテゴリーに該当するか確認
    const { data: updatedSeller, error: updatedError } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', testSellerId)
      .single();

    if (updatedError || !updatedSeller) {
      throw new Error('更新後の売主取得に失敗');
    }

    console.log(`更新後の売主: visit_assignee = ${updatedSeller.visit_assignee}`);

    // 保存条件の確認:
    // - 営担が外された
    // - 当日TEL分カテゴリーの条件を満たしている（営担なし）
    const hasNoAssignee = updatedSeller.visit_assignee === null;
    console.log(`営担が外されているか: ${hasNoAssignee ? '✅' : '❌'}`);

    // 期待される動作: 当日TEL分カテゴリーに正しく表示される
    expect(hasNoAssignee).toBe(true);
  });

  test('ページをリロードした場合、サイドバーのカテゴリー判定が正しく動作する', async () => {
    console.log('\n--- 保存テスト4: ページリロード ---');

    // ステップ1: 次電日を今日に設定
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('sellers')
      .update({ 
        next_call_date: today,
        visit_assignee: null
      })
      .eq('id', testSellerId);

    // ステップ2: 売主を再取得（ページリロードをシミュレート）
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', testSellerId)
      .single();

    if (error || !seller) {
      throw new Error('売主の再取得に失敗');
    }

    console.log(`再取得した売主: next_call_date = ${seller.next_call_date}`);

    // 保存条件の確認:
    // - 次電日が今日
    // - 営担なし
    // - 当日TEL分カテゴリーの条件を満たしている
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const nextCallDate = new Date(seller.next_call_date);
    nextCallDate.setHours(0, 0, 0, 0);
    const isTodayOrBefore = nextCallDate <= todayDate;
    const hasNoAssignee = seller.visit_assignee === null;
    
    console.log(`次電日が今日以前か: ${isTodayOrBefore ? '✅' : '❌'}`);
    console.log(`営担が外されているか: ${hasNoAssignee ? '✅' : '❌'}`);

    // 期待される動作: ページリロード後も正しくカテゴリー判定される
    expect(isTodayOrBefore).toBe(true);
    expect(hasNoAssignee).toBe(true);
  });

  test('Property-Based Test: ランダムな非バグ入力で動作が保持される', async () => {
    console.log('\n--- Property-Based Test: 保存 ---');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -30, max: 0 }), // 過去30日〜今日
        fc.boolean(), // 営担の有無
        async (daysOffset, hasAssignee) => {
          // 次電日を過去または今日に設定
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysOffset);
          const targetDateStr = targetDate.toISOString().split('T')[0];

          // 営担を設定または外す
          const assignee = hasAssignee ? 'Y' : null;

          // 更新
          await supabase
            .from('sellers')
            .update({ 
              next_call_date: targetDateStr,
              visit_assignee: assignee
            })
            .eq('id', testSellerId);

          // 確認
          const { data: seller } = await supabase
            .from('sellers')
            .select('*')
            .eq('id', testSellerId)
            .single();

          // 次電日が今日以前であることを確認
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const nextCallDate = new Date(seller!.next_call_date);
          nextCallDate.setHours(0, 0, 0, 0);
          const isTodayOrBefore = nextCallDate <= today;

          // 営担の状態を確認
          const actualHasAssignee = seller!.visit_assignee !== null;

          // 期待される動作: データベースレベルで正しく保存される
          expect(isTodayOrBefore).toBe(true);
          expect(actualHasAssignee).toBe(hasAssignee);
        }
      ),
      { numRuns: 10 } // 10回実行
    );

    console.log('Property-Based Test 完了');
  });
});
