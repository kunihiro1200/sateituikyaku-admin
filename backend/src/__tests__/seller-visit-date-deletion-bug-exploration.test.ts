/**
 * Bug Condition Exploration Test: 訪問日削除時のデータベース更新失敗
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * このテストは未修正コードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 */

import { createClient } from '@supabase/supabase-js';
import { SellerService } from '../services/SellerService.supabase';
import * as fc from 'fast-check';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('訪問日削除バグ - バグ条件探索', () => {
  let sellerService: SellerService;
  let testSellerId: string;

  beforeAll(async () => {
    sellerService = new SellerService();

    // テスト用の売主を作成
    const timestamp = Date.now();
    const shortTimestamp = timestamp.toString().slice(-8); // 最後の8桁のみ使用
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        seller_number: `VD${shortTimestamp}`, // 10文字以内に収める
        name: 'テスト売主（訪問日削除バグ）',
        status: '追客中',
        visit_date: '2026-04-10 14:00:00', // 初期値として訪問日を設定
        visit_acquisition_date: '2026-04-08', // 訪問取得日も設定
      })
      .select()
      .single();

    if (sellerError) {
      throw new Error(`Failed to create test seller: ${sellerError.message}`);
    }

    testSellerId = seller.id;
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    if (testSellerId) {
      await supabase.from('sellers').delete().eq('id', testSellerId);
    }
  });

  /**
   * Property 1: Bug Condition - 訪問日削除時のデータベース更新失敗
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * バグ条件:
   * - 訪問日フィールドを「2026-04-10 14:00」から空欄に変更して保存
   * - `visitDate: null`が送信される
   * 
   * 期待される動作（修正後）:
   * - データベースの`visit_date`カラムが`null`に更新される
   * - 訪問取得日（`visit_acquisition_date`）も`null`にクリアされる
   * 
   * 未修正コードでの期待される失敗:
   * - データベースの`visit_date`カラムが`null`に更新されない
   * - 訪問取得日（`visit_acquisition_date`）も`null`にクリアされない
   */
  test('訪問日を空欄にして保存すると、データベースのvisit_dateとvisit_acquisition_dateがnullに更新される', async () => {
    // 訪問日を削除（null を送信）
    const updateData = {
      visitDate: null,
      visitAcquisitionDate: null,
    };

    // 売主情報を更新
    const result = await sellerService.updateSeller(testSellerId, updateData as any);

    // 結果を確認（修正後は成功する）
    expect(result).not.toBeNull();

    // データベースから直接取得して確認
    const { data: databaseRecord, error } = await supabase
      .from('sellers')
      .select('visit_date, visit_acquisition_date')
      .eq('id', testSellerId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch seller from database: ${error.message}`);
    }

    console.log('データベースの値:', {
      visit_date: databaseRecord.visit_date,
      visit_acquisition_date: databaseRecord.visit_acquisition_date,
    });

    // 未修正コードでは失敗する（visit_dateとvisit_acquisition_dateがnullにならない）
    // 修正後は成功する（visit_dateとvisit_acquisition_dateがnullになる）
    expect(databaseRecord.visit_date).toBeNull();
    expect(databaseRecord.visit_acquisition_date).toBeNull();
  });

  /**
   * Property-Based Test: 訪問日削除のランダムテスト
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * 様々な初期状態から訪問日を削除した場合、常にnullに更新されることを確認
   */
  test('Property-Based: 訪問日削除が常にnullに更新される', async () => {
    await fc.assert(
      fc.asyncProperty(
        // ランダムな初期訪問日を生成
        fc.date({ min: new Date('2026-01-01'), max: new Date('2026-12-31') }),
        async (initialDate) => {
          // 初期訪問日を設定
          const initialVisitDate = initialDate.toISOString().slice(0, 19).replace('T', ' ');
          await supabase
            .from('sellers')
            .update({
              visit_date: initialVisitDate,
              visit_acquisition_date: initialDate.toISOString().slice(0, 10),
            })
            .eq('id', testSellerId);

          // 訪問日を削除
          await sellerService.updateSeller(testSellerId, {
            visitDate: null,
            visitAcquisitionDate: null,
          } as any);

          // データベースから確認
          const { data: databaseRecord } = await supabase
            .from('sellers')
            .select('visit_date, visit_acquisition_date')
            .eq('id', testSellerId)
            .single();

          // 未修正コードでは失敗する
          // 修正後は成功する
          expect(databaseRecord?.visit_date).toBeNull();
          expect(databaseRecord?.visit_acquisition_date).toBeNull();
        }
      ),
      { numRuns: 10 } // 10回のランダムテストを実行
    );
  });
});
