/**
 * 売主リストフィルタ不具合 - バグ条件探索テスト
 * 
 * このテストは修正前のコードで実行し、失敗することを確認する（失敗がバグの存在を証明）
 * 
 * バグ条件:
 * 1. サイトフィルタ: inquiry_site（存在しない）で検索されるため全データが返される
 * 2. 種別フィルタ: property_type（存在しない）で検索されるため全データが返される
 * 3. 状況（当社）フィルタ: 部分一致検索（ilike）のため意図しないデータも含まれる
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 環境変数を読み込む
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('売主リストフィルタ不具合 - バグ条件探索', () => {
  /**
   * Property 1: サイトフィルタの修正
   * 
   * **Validates: Requirements 2.1**
   * 
   * サイトフィルタを指定した場合、正しいカラム名（site）で検索される
   */
  it('サイトフィルタ: inquiry_siteカラムは存在しないため、フィルタが適用されない（バグ）', async () => {
    // 全売主を取得
    const { data: allSellers } = await supabase
      .from('sellers')
      .select('seller_number, site, 種別, status')
      .limit(100);

    console.log(`全売主数: ${allSellers?.length || 0}件`);

    // サイトの種類を確認
    const sites = [...new Set(allSellers?.map(s => s.site).filter(Boolean))];
    console.log(`サイトの種類: ${sites.join(', ')}`);

    if (sites.length === 0) {
      console.log('⚠️ サイトデータが存在しないため、テストをスキップ');
      return;
    }

    // 最初のサイトでテスト
    const testSite = sites[0];
    console.log(`テスト対象サイト: ${testSite}`);

    // 期待される売主数（正しいカラム名で検索）
    const { data: expectedSellers } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('site', testSite);

    console.log(`期待される売主数（site='${testSite}'）: ${expectedSellers?.length || 0}件`);

    // 修正前のコード（間違ったカラム名）
    const { data: actualSellers, error } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('inquiry_site', testSite); // ❌ 間違ったカラム名（バグ）

    console.log(`実際の結果（inquiry_site='${testSite}'）: ${actualSellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // バグの証明: inquiry_siteカラムが存在しないため、フィルタが適用されず、
    // 期待される件数と実際の件数が異なる
    expect(actualSellers?.length).not.toBe(expectedSellers?.length);
  });

  /**
   * Property 2: 種別フィルタの修正
   * 
   * **Validates: Requirements 2.2**
   * 
   * 種別フィルタを指定した場合、正しいカラム名（種別）で検索される
   */
  it('種別フィルタ: property_typeカラムは存在しないため、フィルタが適用されない（バグ）', async () => {
    // 全売主を取得
    const { data: allSellers } = await supabase
      .from('sellers')
      .select('seller_number, site, 種別, status')
      .limit(100);

    // 種別の種類を確認
    const types = [...new Set(allSellers?.map(s => s['種別']).filter(Boolean))];
    console.log(`種別の種類: ${types.join(', ')}`);

    if (types.length === 0) {
      console.log('⚠️ 種別データが存在しないため、テストをスキップ');
      return;
    }

    // 最初の種別でテスト
    const testType = types[0];
    console.log(`テスト対象種別: ${testType}`);

    // 期待される売主数（正しいカラム名で検索）
    const { data: expectedSellers } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('種別', testType);

    console.log(`期待される売主数（種別='${testType}'）: ${expectedSellers?.length || 0}件`);

    // 修正前のコード（間違ったカラム名）
    const { data: actualSellers, error } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('property_type', testType); // ❌ 間違ったカラム名（バグ）

    console.log(`実際の結果（property_type='${testType}'）: ${actualSellers?.length || 0}件`);

    if (error) {
      console.log('エラー:', error.message);
    }

    // バグの証明: property_typeカラムが存在しないため、フィルタが適用されず、
    // 期待される件数と実際の件数が異なる
    expect(actualSellers?.length).not.toBe(expectedSellers?.length);
  });

  /**
   * Property 3: 状況（当社）フィルタの修正
   * 
   * **Validates: Requirements 2.3**
   * 
   * 状況（当社）フィルタを指定した場合、完全一致検索（eq）を使用する
   */
  it('状況（当社）フィルタ: 部分一致検索（ilike）のため、意図しないデータも含まれる（バグ）', async () => {
    // 「追客中」を含むステータスを持つ売主を取得
    const { data: allSellers } = await supabase
      .from('sellers')
      .select('seller_number, status')
      .ilike('status', '%追客中%')
      .limit(100);

    console.log(`「追客中」を含む売主数: ${allSellers?.length || 0}件`);

    if (!allSellers || allSellers.length === 0) {
      console.log('⚠️ 「追客中」を含む売主が存在しないため、テストをスキップ');
      return;
    }

    // ステータスの種類を確認
    const statuses = [...new Set(allSellers.map(s => s.status).filter(Boolean))];
    console.log(`ステータスの種類: ${statuses.join(', ')}`);

    // 期待される売主数（完全一致検索）
    const { data: expectedSellers } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('status', '追客中');

    console.log(`期待される売主数（status='追客中'、完全一致）: ${expectedSellers?.length || 0}件`);

    // 修正前のコード（部分一致検索）
    const { data: actualSellers } = await supabase
      .from('sellers')
      .select('seller_number')
      .ilike('status', '%追客中%'); // ❌ 部分一致検索（バグ）

    console.log(`実際の結果（status ILIKE '%追客中%'、部分一致）: ${actualSellers?.length || 0}件`);

    // バグの証明: 部分一致検索のため、「追客不要(未訪問）」「除外済追客不要」なども含まれ、
    // 期待される件数より多くなる
    if (statuses.length > 1) {
      // 複数のステータスが存在する場合のみテスト
      expect(actualSellers?.length).toBeGreaterThan(expectedSellers?.length || 0);
    } else {
      console.log('⚠️ 「追客中」のみのため、バグを検証できない');
    }
  });
});
