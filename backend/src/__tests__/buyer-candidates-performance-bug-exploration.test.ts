/**
 * バグ条件探索テスト: 買主候補ボタンのパフォーマンス問題
 * 
 * 目的: 修正前のコードでバグを再現し、約50秒の遅延を観察する
 * 
 * 期待される結果: このテストは修正前のコードで失敗する（レスポンスタイムが3秒を超える）
 * 
 * Requirements: 1.1, 1.2
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { BuyerCandidateService } from '../services/BuyerCandidateService';
import { createClient } from '@supabase/supabase-js';

describe('Property 1: Bug Condition - 買主候補ボタンのパフォーマンス問題', () => {
  let buyerCandidateService: BuyerCandidateService;
  let supabase: any;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    supabase = createClient(supabaseUrl, supabaseKey);
    buyerCandidateService = new BuyerCandidateService();
  });

  it('物件番号が存在する場合、買主候補一覧を3秒以内に返す', async () => {
    // テスト用の物件番号（実際に存在する物件番号を使用）
    const propertyNumber = 'AA9926';

    // レスポンスタイムを測定
    const startTime = Date.now();
    
    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`[Bug Exploration] Response time: ${responseTime}ms`);
      console.log(`[Bug Exploration] Candidates count: ${result.total}`);

      // 期待される動作: レスポンスタイムが3秒以内
      // 修正前のコードでは約50秒かかるため、このテストは失敗する
      expect(responseTime).toBeLessThanOrEqual(3000);

      // 買主候補が返されることを確認
      expect(result.candidates).toBeDefined();
      expect(Array.isArray(result.candidates)).toBe(true);
    } catch (error) {
      console.error('[Bug Exploration] Error:', error);
      throw error;
    }
  }, 60000); // タイムアウトを60秒に設定（修正前のコードで約50秒かかるため）

  it('買主が10件程度の場合、買主候補一覧を3秒以内に返す', async () => {
    // テスト用の物件番号
    const propertyNumber = 'AA9926';

    // レスポンスタイムを測定
    const startTime = Date.now();
    
    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`[Bug Exploration] Response time for ~10 candidates: ${responseTime}ms`);
      console.log(`[Bug Exploration] Candidates count: ${result.total}`);

      // 期待される動作: 買主が10件程度でもレスポンスタイムが3秒以内
      // 修正前のコードでは約50秒かかるため、このテストは失敗する
      expect(responseTime).toBeLessThanOrEqual(3000);

      // 買主候補が返されることを確認
      expect(result.total).toBeGreaterThan(0);
    } catch (error) {
      console.error('[Bug Exploration] Error:', error);
      throw error;
    }
  }, 60000);
});
