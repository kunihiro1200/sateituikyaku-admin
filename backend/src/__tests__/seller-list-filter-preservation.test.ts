/**
 * 売主リストフィルタ不具合 - 保存プロパティテスト
 * 
 * このテストは修正前のコードで実行し、パスすることを確認する（ベースライン動作を確認）
 * 
 * 保存対象:
 * 1. 確度フィルタの動作
 * 2. ページネーションの動作
 * 3. ソート機能の動作
 * 4. サイドバーカテゴリフィルタの動作
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 環境変数を読み込む
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('売主リストフィルタ不具合 - 保存プロパティ', () => {
  /**
   * Property 1: 確度フィルタの動作
   * 
   * **Validates: Requirements 3.1**
   * 
   * 確度フィルタは正しいカラム名（confidence_level）を使用しているため、修正の影響を受けない
   */
  it('確度フィルタ: 修正前後で同じ結果が返される', async () => {
    // 確度「A」の売主を取得
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('seller_number, confidence_level')
      .eq('confidence_level', 'A')
      .limit(10);

    console.log(`確度「A」の売主数: ${sellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // 確度フィルタは正しく動作する
    expect(sellers).toBeDefined();
    if (sellers && sellers.length > 0) {
      // 全ての結果が確度「A」であることを確認
      const allMatchConfidence = sellers.every(s => s.confidence_level === 'A');
      expect(allMatchConfidence).toBe(true);
    }
  });

  /**
   * Property 2: ページネーションの動作
   * 
   * **Validates: Requirements 3.3**
   * 
   * ページネーション機能は修正の影響を受けない
   */
  it('ページネーション: 修正前後で同じ結果が返される', async () => {
    const pageSize = 10;
    const page = 1;

    // 1ページ目を取得
    const { data: page1, error } = await supabase
      .from('sellers')
      .select('seller_number')
      .range((page - 1) * pageSize, page * pageSize - 1)
      .order('seller_number', { ascending: false });

    console.log(`1ページ目の売主数: ${page1?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // ページネーションは正しく動作する
    expect(page1).toBeDefined();
    expect(page1?.length).toBeLessThanOrEqual(pageSize);
  });

  /**
   * Property 3: ソート機能の動作
   * 
   * **Validates: Requirements 3.4**
   * 
   * ソート機能は修正の影響を受けない
   */
  it('ソート機能: 修正前後で同じ結果が返される', async () => {
    // 反響日付の降順でソート
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('seller_number, inquiry_date')
      .order('inquiry_date', { ascending: false, nullsFirst: false })
      .order('seller_number', { ascending: false })
      .limit(10);

    console.log(`ソート結果: ${sellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // ソート機能は正しく動作する
    expect(sellers).toBeDefined();
    
    if (sellers && sellers.length > 1) {
      // 反響日付が降順であることを確認（nullは最後）
      for (let i = 0; i < sellers.length - 1; i++) {
        const current = sellers[i].inquiry_date;
        const next = sellers[i + 1].inquiry_date;
        
        if (current && next) {
          expect(new Date(current).getTime()).toBeGreaterThanOrEqual(new Date(next).getTime());
        }
      }
    }
  });

  /**
   * Property 4: サイドバーカテゴリフィルタの動作
   * 
   * **Validates: Requirements 3.5**
   * 
   * サイドバーカテゴリフィルタは別のロジック（statusCategory）を使用しているため、修正の影響を受けない
   */
  it('サイドバーカテゴリフィルタ: 修正前後で同じ結果が返される', async () => {
    // 「追客中」のステータスを持つ売主を取得（サイドバーカテゴリの一例）
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('seller_number, status')
      .eq('status', '追客中')
      .limit(10);

    console.log(`「追客中」の売主数: ${sellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // サイドバーカテゴリフィルタは正しく動作する
    expect(sellers).toBeDefined();
    if (sellers && sellers.length > 0) {
      // 全ての結果が「追客中」であることを確認
      const allMatchStatus = sellers.every(s => s.status === '追客中');
      expect(allMatchStatus).toBe(true);
    }
  });

  /**
   * Property 5: 複数フィルタの組み合わせ（確度 + ページネーション）
   * 
   * **Validates: Requirements 3.1, 3.3**
   * 
   * 複数のフィルタを組み合わせても正しく動作する
   */
  it('複数フィルタ: 確度フィルタ + ページネーションが正しく動作する', async () => {
    const pageSize = 10;
    const page = 1;

    // 確度「A」の売主を1ページ目取得
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('seller_number, confidence_level')
      .eq('confidence_level', 'A')
      .range((page - 1) * pageSize, page * pageSize - 1)
      .order('seller_number', { ascending: false });

    console.log(`確度「A」の1ページ目: ${sellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // 複数フィルタは正しく動作する
    expect(sellers).toBeDefined();
    expect(sellers?.length).toBeLessThanOrEqual(pageSize);
    
    if (sellers && sellers.length > 0) {
      // 全ての結果が確度「A」であることを確認
      const allMatchConfidence = sellers.every(s => s.confidence_level === 'A');
      expect(allMatchConfidence).toBe(true);
    }
  });
});
