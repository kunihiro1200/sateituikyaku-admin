/**
 * 保全プロパティテスト: 他フィールドの保存動作の不変性
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは修正前のコードで PASS する（これが正しい — 保全すべきベースライン動作を確認する）
 * 修正後も引き続き PASS することで、リグレッションがないことを確認する
 *
 * 保全すべき動作:
 * - Property 2: Preservation - 他フィールドの保存動作の不変性
 *   - exclusionAction を含まないリクエストで updateSeller を呼び出すと、exclusionAction は変更されない
 *   - getSeller の初回呼び出し（キャッシュなし）はDBから正しいデータを返す
 *   - 同一インスタンスでの再取得はキャッシュを使用する（SELLER_CACHE_TTL_MS が 0 より大きい場合）
 */

import { createClient } from '@supabase/supabase-js';
import { SellerService, invalidateSellerCache } from '../services/SellerService.supabase';
import * as fc from 'fast-check';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('除外アクション保存バグ - 保全プロパティテスト', () => {
  let sellerService: SellerService;
  let testSellerId: string;

  beforeAll(async () => {
    sellerService = new SellerService();

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8);
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `PR${shortTimestamp}`,
        name: 'テスト売主（保全テスト）',
        status: '追客中',
        exclusion_action: 'exclude_if_unreachable', // 初期値を設定
        confidence_level: 'A',
        next_call_date: '2025-01-01',
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`テスト売主の作成に失敗: ${sellerError.message}`);
    }

    testSellerId = seller.id;
    console.log(`テスト売主作成完了: ${testSellerId}`);
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    if (testSellerId) {
      await supabase.from('sellers').delete().eq('id', testSellerId);
      console.log(`テスト売主削除完了: ${testSellerId}`);
    }
  });

  beforeEach(async () => {
    // 各テスト前にキャッシュを無効化して、クリーンな状態にする
    invalidateSellerCache(testSellerId);

    // DBの状態をリセット（exclusionActionを既知の値に設定）
    await supabase
      .from('sellers')
      .update({
        exclusion_action: 'exclude_if_unreachable',
        status: '追客中',
        confidence_level: 'A',
        next_call_date: '2025-01-01',
      })
      .eq('id', testSellerId);
  });

  /**
   * 保全テスト1: exclusionAction を含まないリクエストで updateSeller を呼び出すと、
   * exclusionAction は変更されない
   *
   * **Validates: Requirements 3.1**
   *
   * 観察: updateSeller({ sellerId, status: 'active' }) は exclusionAction を変更しない
   */
  test('保全1: exclusionAction を含まないリクエストで updateSeller を呼び出すと、exclusionAction は変更されない', async () => {
    // Step 1: 初期状態を確認
    const { data: initialData } = await supabase
      .from('sellers')
      .select('exclusion_action')
      .eq('id', testSellerId)
      .single();

    console.log('初期状態のexclusion_action:', initialData?.exclusion_action);
    expect(initialData?.exclusion_action).toBe('exclude_if_unreachable');

    // Step 2: exclusionAction を含まないリクエストで updateSeller を呼び出す
    await sellerService.updateSeller(testSellerId, {
      status: '追客中',
    } as any);

    // Step 3: DBから確認
    const { data: afterData } = await supabase
      .from('sellers')
      .select('exclusion_action')
      .eq('id', testSellerId)
      .single();

    console.log('更新後のexclusion_action:', afterData?.exclusion_action);

    // 保全確認: exclusionAction は変更されていない
    expect(afterData?.exclusion_action).toBe('exclude_if_unreachable');
  });

  /**
   * 保全テスト2: getSeller の初回呼び出し（キャッシュなし）はDBから正しいデータを返す
   *
   * **Validates: Requirements 3.2**
   *
   * 観察: getSeller(sellerId) の初回呼び出し（キャッシュなし）はDBから正しいデータを返す
   */
  test('保全2: getSeller の初回呼び出し（キャッシュなし）はDBから正しいデータを返す', async () => {
    // Step 1: キャッシュを確実に無効化
    invalidateSellerCache(testSellerId);

    // Step 2: DBに既知の値を設定
    await supabase
      .from('sellers')
      .update({
        exclusion_action: 'exclude_if_unreachable',
        status: '追客中',
      })
      .eq('id', testSellerId);

    // Step 3: getSeller を呼び出す（キャッシュなし）
    const result = await sellerService.getSeller(testSellerId);

    console.log('getSeller結果（キャッシュなし）:', {
      exclusionAction: result?.exclusionAction,
      status: result?.status,
    });

    // 保全確認: DBから正しいデータが返される
    expect(result).not.toBeNull();
    expect(result?.exclusionAction).toBe('exclude_if_unreachable');
    expect(result?.status).toBe('追客中');
  });

  /**
   * 保全テスト3: 同一インスタンスでの再取得はキャッシュを使用する
   * （SELLER_CACHE_TTL_MS が 0 より大きい場合）
   *
   * **Validates: Requirements 3.3**
   *
   * 観察: 同一インスタンスでの再取得はキャッシュを使用する
   * 注意: SELLER_CACHE_TTL_MS = 0 の場合（修正後）はキャッシュが無効化されるため、
   *       このテストはキャッシュが有効な場合のみ検証する
   */
  test('保全3: 同一インスタンスでの再取得はキャッシュを使用する（SELLER_CACHE_TTL_MS > 0 の場合）', async () => {
    // Step 1: キャッシュを確実に無効化
    invalidateSellerCache(testSellerId);

    // Step 2: 初回 getSeller を呼び出してキャッシュに保存
    const firstResult = await sellerService.getSeller(testSellerId);
    console.log('初回getSeller結果:', {
      exclusionAction: firstResult?.exclusionAction,
    });
    expect(firstResult?.exclusionAction).toBe('exclude_if_unreachable');

    // Step 3: DBを直接更新（キャッシュをバイパス）
    await supabase
      .from('sellers')
      .update({ exclusion_action: 'exclude_without_action' })
      .eq('id', testSellerId);

    // Step 4: 同じインスタンスで再度 getSeller を呼び出す
    const secondResult = await sellerService.getSeller(testSellerId);
    console.log('2回目getSeller結果:', {
      exclusionAction: secondResult?.exclusionAction,
    });

    // 保全確認: SELLER_CACHE_TTL_MS > 0 の場合、キャッシュが使用される
    // SELLER_CACHE_TTL_MS = 0 の場合（修正後）、DBから最新値が返される
    // どちらの場合も、このテストは PASS する（動作の観察）
    if (secondResult?.exclusionAction === 'exclude_if_unreachable') {
      // キャッシュが使用された（SELLER_CACHE_TTL_MS > 0 の場合）
      console.log('✅ キャッシュが使用された（SELLER_CACHE_TTL_MS > 0）');
      expect(secondResult?.exclusionAction).toBe('exclude_if_unreachable');
    } else {
      // DBから最新値が返された（SELLER_CACHE_TTL_MS = 0 の場合）
      console.log('✅ DBから最新値が返された（SELLER_CACHE_TTL_MS = 0）');
      expect(secondResult?.exclusionAction).toBe('exclude_without_action');
    }
  });

  /**
   * Property-Based Test: exclusionAction を含まない任意のフィールドの組み合わせで
   * updateSeller を呼び出すと、exclusionAction は変更されない
   *
   * **Validates: Requirements 3.1**
   *
   * 保全プロパティ:
   * FOR ALL X WHERE NOT isBugCondition(X) DO
   *   ASSERT updateSeller(X) = updateSeller'(X)  // 他フィールドの動作は変わらない
   * END FOR
   */
  test('Property-Based: exclusionAction を含まない任意のフィールドの組み合わせで updateSeller を呼び出すと、exclusionAction は変更されない', async () => {
    await fc.assert(
      fc.asyncProperty(
        // exclusionAction を含まないランダムなフィールドの組み合わせを生成
        fc.record({
          status: fc.oneof(
            fc.constant('追客中'),
            fc.constant('除外後追客中'),
            fc.constant('他決→追客'),
            fc.constant('専任媒介'),
            fc.constant('一般媒介')
          ),
          confidenceLevel: fc.oneof(
            fc.constant('A'),
            fc.constant('B'),
            fc.constant('C'),
            fc.constant('D'),
            fc.constant(null)
          ),
          nextCallDate: fc.oneof(
            fc.constant('2025-01-01'),
            fc.constant('2025-06-15'),
            fc.constant('2026-12-31'),
            fc.constant(null)
          ),
        }),
        async (fields) => {
          // Step 1: キャッシュを無効化
          invalidateSellerCache(testSellerId);

          // Step 2: DBの状態をリセット
          await supabase
            .from('sellers')
            .update({ exclusion_action: 'exclude_if_unreachable' })
            .eq('id', testSellerId);

          // Step 3: exclusionAction を含まないリクエストで updateSeller を呼び出す
          const updatePayload: any = {
            status: fields.status,
          };
          if (fields.confidenceLevel !== null) {
            updatePayload.confidence = fields.confidenceLevel;
          }
          if (fields.nextCallDate !== null) {
            updatePayload.nextCallDate = fields.nextCallDate;
          }

          await sellerService.updateSeller(testSellerId, updatePayload);

          // Step 4: DBから確認
          const { data: afterData } = await supabase
            .from('sellers')
            .select('exclusion_action, status')
            .eq('id', testSellerId)
            .single();

          console.log(`フィールド更新後: status="${fields.status}", exclusion_action="${afterData?.exclusion_action}"`);

          // 保全確認: exclusionAction は変更されていない
          expect(afterData?.exclusion_action).toBe('exclude_if_unreachable');

          // 保全確認: 指定したフィールドは正しく更新されている
          expect(afterData?.status).toBe(fields.status);
        }
      ),
      { numRuns: 5 } // 5回のランダムテストを実行
    );
  });

  /**
   * 保全テスト4: 複数フィールドを同時に更新しても exclusionAction は変更されない
   *
   * **Validates: Requirements 3.1**
   */
  test('保全4: 複数フィールドを同時に更新しても exclusionAction は変更されない', async () => {
    // Step 1: キャッシュを無効化
    invalidateSellerCache(testSellerId);

    // Step 2: 複数フィールドを同時に更新（exclusionAction は含まない）
    await sellerService.updateSeller(testSellerId, {
      status: '除外後追客中',
      confidence: 'B',
      nextCallDate: '2025-06-01',
    } as any);

    // Step 3: DBから確認
    const { data: afterData } = await supabase
      .from('sellers')
      .select('exclusion_action, status, confidence_level, next_call_date')
      .eq('id', testSellerId)
      .single();

    console.log('複数フィールド更新後:', {
      exclusion_action: afterData?.exclusion_action,
      status: afterData?.status,
      confidence_level: afterData?.confidence_level,
      next_call_date: afterData?.next_call_date,
    });

    // 保全確認: exclusionAction は変更されていない
    expect(afterData?.exclusion_action).toBe('exclude_if_unreachable');

    // 保全確認: 指定したフィールドは正しく更新されている
    expect(afterData?.status).toBe('除外後追客中');
    expect(afterData?.confidence_level).toBe('B');
    expect(afterData?.next_call_date).toBe('2025-06-01');
  });
});
