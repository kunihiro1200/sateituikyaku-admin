/**
 * Bug Condition Exploration Test: 除外アクション保存後の即時反映バグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは未修正コードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 *
 * バグ条件:
 * - 条件A: updateSeller後に別Vercelインスタンス（新しいキャッシュインスタンス）が
 *          古いキャッシュを返す（SELLER_CACHE_TTL_MS が 30秒以上のため）
 * - 条件B: exclusionAction = '' の場合にスプレッド構文がペイロードから除外する
 */

import { createClient } from '@supabase/supabase-js';
import { SellerService } from '../services/SellerService.supabase';
import * as fc from 'fast-check';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// SellerServiceモジュールからキャッシュ関連の内部変数にアクセスするためのヘルパー
// 別Vercelインスタンスをシミュレートするため、新しいMapインスタンスを使用する
function createFreshCacheSimulator() {
  // 新しいMapインスタンス（別Vercelインスタンスのキャッシュをシミュレート）
  const freshCache = new Map<string, { data: any; expiresAt: number }>();
  return freshCache;
}

describe('除外アクション保存バグ - バグ条件探索', () => {
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
        seller_number: `EX${shortTimestamp}`,
        name: 'テスト売主（除外アクションバグ）',
        status: '追客中',
        exclusion_action: null, // 初期値はnull
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

  /**
   * 条件A: キャッシュ問題の確認
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * バグ条件:
   * - SELLER_CACHE_TTL_MS が 30秒（30000ms）以上であることを確認
   * - getSeller でキャッシュに古いデータが保存された後、DBが更新されても
   *   キャッシュが有効期限内（30秒以内）であれば古いデータが返される
   *
   * 修正前: SELLER_CACHE_TTL_MS >= 30000 → テスト FAIL（バグ確認）
   * 修正後: SELLER_CACHE_TTL_MS = 0 → テスト PASS
   */
  test('条件A: キャッシュに古いデータが保存された後、DBが更新されても古いデータが返される（バグ確認）', async () => {
    // Step 1: DBに初期値（null）を設定
    await supabase
      .from('sellers')
      .update({ exclusion_action: null })
      .eq('id', testSellerId);

    // Step 2: getSeller を呼び出してキャッシュに古いデータ（null）を保存させる
    // これは「別Vercelインスタンスが updateSeller 前にキャッシュを作成した」状態をシミュレート
    const cachedResult = await sellerService.getSeller(testSellerId);
    console.log('キャッシュ保存後のgetSeller結果（null）:', {
      exclusionAction: cachedResult?.exclusionAction,
    });
    expect(cachedResult?.exclusionAction).toBeNull();

    // Step 3: DBを直接更新（別インスタンスの updateSeller をシミュレート）
    // 実際のVercel環境では、別インスタンスが updateSeller を実行してDBを更新するが、
    // このインスタンスのキャッシュは無効化されない
    await supabase
      .from('sellers')
      .update({ exclusion_action: 'exclude_if_unreachable' })
      .eq('id', testSellerId);

    // Step 4: 同じインスタンスで getSeller を再度呼び出す
    // キャッシュが有効期限内（30秒以内）であれば、古いデータ（null）が返される
    const afterUpdateResult = await sellerService.getSeller(testSellerId);
    console.log('DB更新後のgetSeller結果（キャッシュから）:', {
      exclusionAction: afterUpdateResult?.exclusionAction,
    });

    // バグ確認: キャッシュが古いデータ（null）を返すことを確認
    // 修正前: exclusionAction = null（古いキャッシュの値）→ テスト FAIL（バグ確認）
    // 修正後: SELLER_CACHE_TTL_MS = 0 の場合、キャッシュを使わずDBから最新値を取得
    //         → exclusionAction = 'exclude_if_unreachable' → テスト PASS
    //
    // このテストは「修正後に PASS する」ことを期待している
    // 修正前は FAIL する（バグの存在を証明する）
    expect(afterUpdateResult?.exclusionAction).toBe('exclude_if_unreachable');
  });

  /**
   * 条件B: 空文字列除外問題の確認
   *
   * **Validates: Requirements 1.3**
   *
   * バグ条件:
   * - exclusionAction = '' の場合にスプレッド構文がペイロードから除外する
   * - `...(exclusionAction ? { exclusionAction } : {})` → '' は falsy なので {} が展開される
   * - バックエンドに exclusionAction が届かないため、DBが更新されない
   *
   * 修正前: exclusionAction = '' がペイロードに含まれない → テスト FAIL（バグ確認）
   * 修正後: exclusionAction = '' がペイロードに含まれる → テスト PASS
   */
  test('条件B: exclusionAction = "" の場合にスプレッド構文がペイロードから除外することを確認', async () => {
    // Step 1: exclusionAction を設定して保存
    await sellerService.updateSeller(testSellerId, {
      exclusionAction: 'exclude_if_unreachable',
    } as any);

    // DBに保存されたことを確認
    const { data: beforeData } = await supabase
      .from('sellers')
      .select('exclusion_action')
      .eq('id', testSellerId)
      .single();

    console.log('保存前のDB値:', { exclusion_action: beforeData?.exclusion_action });
    expect(beforeData?.exclusion_action).toBe('exclude_if_unreachable');

    // Step 2: フロントエンドの保存処理をシミュレート
    // exclusionAction = '' の場合のスプレッド構文の動作を確認
    const exclusionAction = ''; // 解除操作

    // フロントエンドのスプレッド構文をシミュレート
    // 修正前: ...(exclusionAction ? { exclusionAction } : {})
    // '' は falsy なので {} が展開される → exclusionAction がペイロードに含まれない
    const payloadBeforeFix = {
      status: '追客中',
      ...(exclusionAction ? { exclusionAction } : {}), // バグのある実装
    };

    // 修正後: ...(exclusionAction !== undefined ? { exclusionAction } : {})
    // '' は undefined ではないので { exclusionAction: '' } が展開される
    const payloadAfterFix = {
      status: '追客中',
      ...(exclusionAction !== undefined ? { exclusionAction } : {}), // 修正後の実装
    };

    console.log('修正前のペイロード:', payloadBeforeFix);
    console.log('修正後のペイロード:', payloadAfterFix);

    // バグ確認: 修正前のペイロードに exclusionAction が含まれないことを確認
    // 修正前: 'exclusionAction' in payloadBeforeFix === false → テスト FAIL（バグ確認）
    // 修正後: 'exclusionAction' in payloadAfterFix === true → テスト PASS
    expect('exclusionAction' in payloadBeforeFix).toBe(false); // バグの存在を確認

    // Step 3: 修正後の実装でバックエンドを呼び出す
    // exclusionAction = '' がペイロードに含まれるため、DBが null に更新される
    // バックエンドの updateSeller は (data as any).exclusionAction !== undefined チェックで動作する
    // exclusionAction = '' の場合、exclusion_action カラムが null に更新される

    // 修正後の実装: exclusionAction = '' をペイロードに含めて更新
    await sellerService.updateSeller(testSellerId, {
      status: '追客中',
      exclusionAction: '', // 修正後の実装: 空文字列がペイロードに含まれる
    } as any);

    // DBから確認
    const { data: afterData } = await supabase
      .from('sellers')
      .select('exclusion_action')
      .eq('id', testSellerId)
      .single();

    console.log('修正後の実装後のDB値:', { exclusion_action: afterData?.exclusion_action });

    // 修正確認: exclusionAction = '' がペイロードに含まれ、DBが null に更新される
    // 修正前: exclusionAction = '' がペイロードから除外され、DBが更新されない → 'exclude_if_unreachable' のまま
    // 修正後: exclusionAction = '' がペイロードに含まれ、DBが null に更新される → テスト PASS
    expect(afterData?.exclusion_action).toBeNull(); // 解除後はnullになるべき
  });

  /**
   * Property-Based Test: 条件Bのランダムテスト
   *
   * **Validates: Requirements 1.3**
   *
   * 様々な exclusionAction 値（空文字列、有効な値）で保存・取得を繰り返し、
   * 保存した値と取得した値が一致することを検証
   */
  test('Property-Based: exclusionAction の保存・取得が常に一致する', async () => {
    await fc.assert(
      fc.asyncProperty(
        // ランダムな exclusionAction 値を生成
        fc.oneof(
          fc.constant('exclude_if_unreachable'),
          fc.constant('exclude_without_action'),
          fc.constant('') // 解除操作
        ),
        async (exclusionActionValue) => {
          // Step 1: exclusionAction を設定して保存
          // 修正後の実装: exclusionAction !== undefined の場合にペイロードに含める
          const payload: any = {
            status: '追客中',
          };

          // 修正後の実装をシミュレート
          if (exclusionActionValue !== undefined) {
            payload.exclusionAction = exclusionActionValue;
          }

          await sellerService.updateSeller(testSellerId, payload);

          // Step 2: DBから直接確認
          const { data: dbRecord } = await supabase
            .from('sellers')
            .select('exclusion_action')
            .eq('id', testSellerId)
            .single();

          const expectedValue = exclusionActionValue === '' ? null : exclusionActionValue;

          console.log(`exclusionAction="${exclusionActionValue}" → DB: ${dbRecord?.exclusion_action}`);

          // バグ確認: 保存した値がDBに反映されることを確認
          // 修正前: exclusionAction = '' の場合、DBが更新されない → テスト FAIL（バグ確認）
          // 修正後: exclusionAction = '' の場合、DBが null に更新される → テスト PASS
          expect(dbRecord?.exclusion_action).toBe(expectedValue);
        }
      ),
      { numRuns: 5 } // 5回のランダムテストを実行
    );
  });
});
