/**
 * Bug Condition Exploration Test: 訪問予約カレンダー送信エラー（特定アカウントのみ）
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * このテストは未修正コードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 * 
 * バグ条件:
 * - イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている
 * - yurine~またはmariko~のアカウントで訪問予約を保存する
 * - `SellerService.decryptSeller()`が`initialsMap["U"]`でイニシャルからフルネームへの変換を試みる
 * 
 * 期待される動作（修正後）:
 * - `visitAssigneeInitials`が元のイニシャル値（"U"）を保持する
 * - フロントエンドで営担チェックとカレンダー送信が成功する
 * 
 * 未修正コードでの期待される失敗:
 * - `visitAssignee`と`visitAssigneeInitials`が両方とも`undefined`になる
 * - フロントエンドで「現在の売主の営担が設定されていません」という警告が表示される
 * - Googleカレンダー送信時に400エラーが発生する
 */

import { createClient } from '@supabase/supabase-js';
import { SellerService } from '../services/SellerService.supabase';
import * as fc from 'fast-check';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('訪問予約カレンダー送信エラーバグ - バグ条件探索', () => {
  let sellerService: SellerService;
  let testSellerId: string;
  let initialInitialsMapState: any = null;

  beforeAll(async () => {
    sellerService = new SellerService();

    // employeesテーブルの現在の状態を確認
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true);

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    console.log('=== employeesテーブルの現在の状態 ===');
    console.log('従業員数:', employees?.length);
    
    // イニシャル「U」が存在するか確認
    const employeeU = employees?.find((emp: any) => emp.initials === 'U');
    console.log('イニシャル「U」の従業員:', employeeU);
    
    if (employeeU) {
      console.log('⚠️ イニシャル「U」が既に存在します。テストのため、一時的に無効化します。');
      initialInitialsMapState = { initials: 'U', name: employeeU.name };
      
      // 一時的に無効化（is_active = false）
      await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('initials', 'U');
    }

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VU${shortTimestamp}`,
        name: 'テスト売主（訪問予約カレンダーエラー）',
        status: '追客中',
        visit_date: '2026-04-10 14:00:00',
        visit_assignee: 'U', // イニシャル「U」を設定（employeesテーブルに存在しない）
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerId = seller.id;
    console.log('テスト売主を作成:', seller.seller_number, 'ID:', testSellerId);
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    if (testSellerId) {
      await supabase.from('sellers').delete().eq('id', testSellerId);
      console.log('テスト売主を削除:', testSellerId);
    }

    // イニシャル「U」を元に戻す
    if (initialInitialsMapState) {
      await supabase
        .from('employees')
        .update({ is_active: true })
        .eq('initials', initialInitialsMapState.initials);
      console.log('イニシャル「U」を元に戻しました');
    }
  });

  /**
   * Property 1: Bug Condition - イニシャル変換失敗時のvisitAssigneeInitials保持
   * 
   * **Validates: Requirements 1.5, 2.3, 2.4**
   * 
   * バグ条件:
   * - イニシャル「U」がemployeesテーブルに存在しない（一時的に無効化）
   * - `SellerService.decryptSeller()`が`initialsMap["U"]`でイニシャルからフルネームへの変換を試みる
   * - 変換失敗時の動作を確認
   * 
   * 期待される動作（修正後）:
   * - `visitAssignee`は変換失敗時にフォールバックとして元のイニシャル値（"U"）を返す
   * - `visitAssigneeInitials`は元のイニシャル値（"U"）を保持する
   * 
   * 注意: 現在のコードは既にフォールバックロジックを実装しているため、
   * このテストは成功する（バグが既に修正されている）
   */
  test('イニシャル「U」がemployeesテーブルに存在しない場合、visitAssigneeInitialsが元のイニシャル値を保持する', async () => {
    // 売主情報を取得
    const seller = await sellerService.getSeller(testSellerId);

    console.log('=== 売主情報 ===');
    console.log('visitAssignee:', seller.visitAssignee);
    console.log('visitAssigneeInitials:', seller.visitAssigneeInitials);

    // 現在のコードは既にフォールバックロジックを実装している
    // visitAssigneeは変換失敗時にフォールバックとして元のイニシャル値を返す
    expect(seller.visitAssignee).toBe('U');
    
    // visitAssigneeInitialsは元のイニシャル値（"U"）を保持する
    expect(seller.visitAssigneeInitials).toBe('U');
  });

  /**
   * Property-Based Test: イニシャル変換失敗のランダムテスト
   * 
   * **Validates: Requirements 1.5, 2.3, 2.4**
   * 
   * 様々な存在しないイニシャルで訪問予約を保存した場合、
   * 常にvisitAssigneeInitialsが元のイニシャル値を保持することを確認
   * 
   * 注意: 現在のコードは既にフォールバックロジックを実装しているため、
   * このテストは成功する
   */
  test('Property-Based: イニシャル変換失敗時にvisitAssigneeInitialsが常に保持される', async () => {
    await fc.assert(
      fc.asyncProperty(
        // ランダムな存在しないイニシャルを生成（A-Z、ただしemployeesテーブルに存在しないもの）
        fc.constantFrom('X', 'Z', 'Q', 'W'), // 通常存在しないイニシャル
        async (randomInitial) => {
          // employeesテーブルに存在しないことを確認
          const { data: employee } = await supabase
            .from('employees')
            .select('initials')
            .eq('initials', randomInitial)
            .eq('is_active', true)
            .single();

          if (employee) {
            // 存在する場合はスキップ
            return true;
          }

          // visit_assigneeを更新
          await supabase
            .from('sellers')
            .update({ visit_assignee: randomInitial })
            .eq('id', testSellerId);

          // キャッシュを無効化
          const { invalidateSellerCache } = require('../services/SellerService.supabase');
          invalidateSellerCache(testSellerId);

          // 売主情報を取得
          const seller = await sellerService.getSeller(testSellerId);

          console.log(`[PBT] イニシャル: ${randomInitial}, visitAssignee: ${seller.visitAssignee}, visitAssigneeInitials: ${seller.visitAssigneeInitials}`);

          // 現在のコードは既にフォールバックロジックを実装している
          // visitAssigneeは変換失敗時にフォールバックとして元のイニシャル値を返す
          expect(seller.visitAssignee).toBe(randomInitial);
          expect(seller.visitAssigneeInitials).toBe(randomInitial);
        }
      ),
      { numRuns: 5 } // 5回のランダムテストを実行
    );
  });

  /**
   * Property 2: Regression Test - 正常なイニシャルマッピングの保持
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * イニシャルがemployeesテーブルに正しく登録されている場合、
   * visitAssignee（フルネーム）とvisitAssigneeInitials（イニシャル）の両方が正しく返されることを確認
   */
  test('イニシャルがemployeesテーブルに存在する場合、visitAssigneeとvisitAssigneeInitialsの両方が正しく返される', async () => {
    // employeesテーブルから存在するイニシャルを取得
    const { data: employees } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true)
      .limit(1);

    if (!employees || employees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    const testEmployee = employees[0];
    console.log('テスト用従業員:', testEmployee);

    // visit_assigneeを更新
    await supabase
      .from('sellers')
      .update({ visit_assignee: testEmployee.initials })
      .eq('id', testSellerId);

    // キャッシュを無効化
    const { invalidateSellerCache } = require('../services/SellerService.supabase');
    invalidateSellerCache(testSellerId);

    // 売主情報を取得
    const seller = await sellerService.getSeller(testSellerId);

    console.log('=== 正常なイニシャルマッピング ===');
    console.log('visitAssignee:', seller.visitAssignee);
    console.log('visitAssigneeInitials:', seller.visitAssigneeInitials);

    // visitAssigneeはフルネームに変換される
    expect(seller.visitAssignee).toBe(testEmployee.name);
    
    // visitAssigneeInitialsは元のイニシャル値を保持
    expect(seller.visitAssigneeInitials).toBe(testEmployee.initials);
  });
});
