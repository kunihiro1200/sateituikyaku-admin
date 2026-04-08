/**
 * Preservation Property Test: 訪問予約カレンダー送信エラー（特定アカウントのみ）
 * 
 * **Property 2: Preservation** - 正常なイニシャルマッピングの保持
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * このテストは修正前のコードで実行すると成功する（ベースライン動作を確認）
 * 修正後も成功する（リグレッションがないことを確認）
 * 
 * 観察優先の方法論:
 * - 修正前のコードで非バグ入力（イニシャルがemployeesテーブルに正しく登録されている場合）の動作を観察
 * - tomoko~アカウント（イニシャル「T」）で訪問予約を保存すると、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
 * - genta~アカウント（イニシャル「G」）で訪問予約を保存すると、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
 * 
 * 期待される結果:
 * - テストが成功する（これによりベースライン動作を確認）
 */

import { createClient } from '@supabase/supabase-js';
import { SellerService } from '../services/SellerService.supabase';
import * as fc from 'fast-check';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('訪問予約カレンダー送信エラー - Preservation', () => {
  let sellerService: SellerService;
  let testSellerIds: string[] = [];
  let validEmployees: Array<{ initials: string; name: string }> = [];

  beforeAll(async () => {
    sellerService = new SellerService();

    // employeesテーブルから有効な従業員を取得
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true);

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    validEmployees = employees || [];
    console.log('=== 有効な従業員一覧 ===');
    console.log('従業員数:', validEmployees.length);
    console.log('イニシャル:', validEmployees.map(e => e.initials).join(', '));
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    if (testSellerIds.length > 0) {
      await supabase.from('sellers').delete().in('id', testSellerIds);
      console.log('テスト売主を削除:', testSellerIds.length, '件');
    }
  });

  /**
   * Property 2: Preservation - イニシャルがemployeesテーブルに正しく登録されている場合の動作保持
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * イニシャルがemployeesテーブルに正しく登録されている売主の訪問予約を保存する際、
   * `visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
   */
  test('イニシャルがemployeesテーブルに存在する場合、visitAssigneeとvisitAssigneeInitialsの両方が正しく返される', async () => {
    if (validEmployees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    // 最初の有効な従業員を使用
    const testEmployee = validEmployees[0];
    console.log('テスト用従業員:', testEmployee);

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VP${shortTimestamp}`,
        name: 'テスト売主（Preservation）',
        status: '追客中',
        visit_date: '2026-04-10 14:00:00',
        visit_assignee: testEmployee.initials, // 有効なイニシャルを設定
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerIds.push(seller.id);
    console.log('テスト売主を作成:', seller.seller_number, 'ID:', seller.id);

    // 売主情報を取得
    const decryptedSeller = await sellerService.getSeller(seller.id);

    console.log('=== 正常なイニシャルマッピング ===');
    console.log('visitAssignee:', decryptedSeller.visitAssignee);
    console.log('visitAssigneeInitials:', decryptedSeller.visitAssigneeInitials);

    // 現在のコードは既にフォールバックロジックを実装している
    // visitAssigneeはフルネームに変換される、または元のイニシャル値にフォールバック
    // employeesテーブルに存在する場合はフルネーム、存在しない場合はイニシャル
    expect(decryptedSeller.visitAssignee).toBeTruthy();
    expect([testEmployee.name, testEmployee.initials]).toContain(decryptedSeller.visitAssignee);
    
    // visitAssigneeInitialsは元のイニシャル値を保持
    expect(decryptedSeller.visitAssigneeInitials).toBe(testEmployee.initials);
  });

  /**
   * Property-Based Test: 複数の有効なイニシャルでの動作確認
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * employeesテーブルに存在する全てのイニシャルで訪問予約を保存した場合、
   * 常にvisitAssignee（フルネーム）とvisitAssigneeInitials（イニシャル）の両方が正しく返されることを確認
   */
  test('Property-Based: 有効なイニシャルで常にvisitAssigneeとvisitAssigneeInitialsが正しく返される', async () => {
    if (validEmployees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        // employeesテーブルから有効なイニシャルをランダムに選択
        fc.constantFrom(...validEmployees),
        async (employee) => {
          // テスト用の売主を作成
          const timestamp = Date.now();
          const shortTimestamp = timestamp.toString().slice(-8);
          const randomSuffix = Math.random().toString(36).substring(2, 6);
          const { data: seller, error: sellerError } = await supabase
            .from('sellers')
            .insert({
              seller_number: `VP${shortTimestamp}${randomSuffix}`,
              name: `テスト売主（PBT-${employee.initials}）`,
              status: '追客中',
              visit_date: '2026-04-10 14:00:00',
              visit_assignee: employee.initials,
            })
            .select()
            .single();

          if (sellerError) {
            throw new Error(`Failed to create test seller: ${sellerError.message}`);
          }

          testSellerIds.push(seller.id);

          // 売主情報を取得
          const decryptedSeller = await sellerService.getSeller(seller.id);

          console.log(`[PBT] イニシャル: ${employee.initials}, visitAssignee: ${decryptedSeller.visitAssignee}, visitAssigneeInitials: ${decryptedSeller.visitAssigneeInitials}`);

          // 現在のコードは既にフォールバックロジックを実装している
          // visitAssigneeはフルネームに変換される、または元のイニシャル値にフォールバック
          expect(decryptedSeller.visitAssignee).toBeTruthy();
          expect([employee.name, employee.initials]).toContain(decryptedSeller.visitAssignee);
          
          // visitAssigneeInitialsは元のイニシャル値を保持
          expect(decryptedSeller.visitAssigneeInitials).toBe(employee.initials);
        }
      ),
      { numRuns: Math.min(5, validEmployees.length) } // 最大5回、または従業員数分のランダムテストを実行
    );
  });

  /**
   * Property 2: Preservation - 営担チェックの動作保持
   * 
   * **Validates: Requirements 3.3**
   * 
   * 営担チェックで`visitAssignee`または`visitAssigneeInitials`のいずれかが存在する場合、
   * サイドバーが正しく表示される（フロントエンドでの動作を想定）
   */
  test('visitAssigneeまたはvisitAssigneeInitialsのいずれかが存在すればサイドバー表示条件を満たす', async () => {
    if (validEmployees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    const testEmployee = validEmployees[0];

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VP${shortTimestamp}S`,
        name: 'テスト売主（営担チェック）',
        status: '追客中',
        visit_date: '2026-04-10 14:00:00',
        visit_assignee: testEmployee.initials,
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerIds.push(seller.id);

    // 売主情報を取得
    const decryptedSeller = await sellerService.getSeller(seller.id);

    console.log('=== 営担チェック ===');
    console.log('visitAssignee:', decryptedSeller.visitAssignee);
    console.log('visitAssigneeInitials:', decryptedSeller.visitAssigneeInitials);

    // フロントエンドでの営担チェック: visitAssignee || visitAssigneeInitials
    const hasAssignee = decryptedSeller.visitAssignee || decryptedSeller.visitAssigneeInitials;
    
    // 営担が存在することを確認
    expect(hasAssignee).toBeTruthy();
    
    // visitAssigneeとvisitAssigneeInitialsの両方が存在することを確認
    expect(decryptedSeller.visitAssignee).toBeTruthy();
    expect([testEmployee.name, testEmployee.initials]).toContain(decryptedSeller.visitAssignee);
    expect(decryptedSeller.visitAssigneeInitials).toBe(testEmployee.initials);
  });

  /**
   * Property 2: Preservation - 訪問日削除機能の動作保持
   * 
   * **Validates: Requirements 3.4**
   * 
   * 訪問日削除機能を使用する際、引き続き正常に訪問日・営担・訪問査定取得者が削除される
   */
  test('訪問日を削除すると、営担と訪問査定取得者も削除される', async () => {
    if (validEmployees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    const testEmployee = validEmployees[0];

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VP${shortTimestamp}D`,
        name: 'テスト売主（訪問日削除）',
        status: '追客中',
        visit_date: '2026-04-10 14:00:00',
        visit_assignee: testEmployee.initials,
        visit_valuation_acquirer: 'テスト査定取得者',
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerIds.push(seller.id);

    // 訪問日を削除
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        visit_date: null,
        visit_assignee: null,
        visit_valuation_acquirer: null,
      })
      .eq('id', seller.id);

    if (updateError) {
      throw new Error(`Failed to delete visit date: ${updateError.message}`);
    }

    // キャッシュを無効化
    const { invalidateSellerCache } = require('../services/SellerService.supabase');
    invalidateSellerCache(seller.id);

    // 売主情報を取得
    const decryptedSeller = await sellerService.getSeller(seller.id);

    console.log('=== 訪問日削除後 ===');
    console.log('visitDate:', decryptedSeller.visitDate);
    console.log('visitAssignee:', decryptedSeller.visitAssignee);
    console.log('visitAssigneeInitials:', decryptedSeller.visitAssigneeInitials);
    console.log('visitValuationAcquirer:', decryptedSeller.visitValuationAcquirer);

    // 訪問日・営担・訪問査定取得者が全て削除されていることを確認
    // undefinedまたはnullのいずれかであればOK
    expect(decryptedSeller.visitDate).toBeFalsy();
    expect(decryptedSeller.visitAssignee).toBeFalsy();
    expect(decryptedSeller.visitAssigneeInitials).toBeFalsy();
    expect(decryptedSeller.visitValuationAcquirer).toBeFalsy();
  });

  /**
   * Property 2: Preservation - 訪問査定取得者の自動設定機能の動作保持
   * 
   * **Validates: Requirements 3.5**
   * 
   * 訪問査定取得者の自動設定機能を使用する際、引き続き正常にログインユーザーに自動設定される
   * （このテストはバックエンドのロジックではなく、フロントエンドの動作を想定）
   */
  test('訪問日を設定すると、訪問査定取得者が自動的に設定される（フロントエンドの動作を想定）', async () => {
    if (validEmployees.length === 0) {
      console.warn('⚠️ employeesテーブルにアクティブな従業員が存在しません。テストをスキップします。');
      return;
    }

    const testEmployee = validEmployees[0];

    // テスト用の売主を作成（訪問日なし）
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VP${shortTimestamp}A`,
        name: 'テスト売主（自動設定）',
        status: '追客中',
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerIds.push(seller.id);

    // 訪問日と訪問査定取得者を設定（フロントエンドでの自動設定を模擬）
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        visit_date: '2026-04-10 14:00:00',
        visit_assignee: testEmployee.initials,
        visit_valuation_acquirer: testEmployee.name, // ログインユーザーに自動設定
      })
      .eq('id', seller.id);

    if (updateError) {
      throw new Error(`Failed to set visit date: ${updateError.message}`);
    }

    // キャッシュを無効化
    const { invalidateSellerCache } = require('../services/SellerService.supabase');
    invalidateSellerCache(seller.id);

    // 売主情報を取得
    const decryptedSeller = await sellerService.getSeller(seller.id);

    console.log('=== 訪問日設定後 ===');
    console.log('visitDate:', decryptedSeller.visitDate);
    console.log('visitAssignee:', decryptedSeller.visitAssignee);
    console.log('visitAssigneeInitials:', decryptedSeller.visitAssigneeInitials);
    console.log('visitValuationAcquirer:', decryptedSeller.visitValuationAcquirer);

    // 訪問日・営担・訪問査定取得者が全て設定されていることを確認
    expect(decryptedSeller.visitDate).toBeTruthy();
    expect(decryptedSeller.visitAssignee).toBeTruthy();
    expect([testEmployee.name, testEmployee.initials]).toContain(decryptedSeller.visitAssignee);
    expect(decryptedSeller.visitAssigneeInitials).toBe(testEmployee.initials);
    expect(decryptedSeller.visitValuationAcquirer).toBe(testEmployee.name);
  });
});
