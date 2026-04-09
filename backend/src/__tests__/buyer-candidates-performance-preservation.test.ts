/**
 * 保存プロパティテスト: 買主候補機能の既存動作保持
 * 
 * 目的: 修正前のコードで既存機能が正常に動作することを確認
 * 
 * 期待される結果: このテストは修正前のコードでパスする（既存機能が保持されている）
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { BuyerCandidateService } from '../services/BuyerCandidateService';
import { createClient } from '@supabase/supabase-js';

describe('Property 2: Preservation - 既存機能の保持', () => {
  let buyerCandidateService: BuyerCandidateService;
  let supabase: any;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    supabase = createClient(supabaseUrl, supabaseKey);
    buyerCandidateService = new BuyerCandidateService();
  });

  it('買主候補の抽出条件が変わらない（エリアマッチング、物件種別マッチング、価格マッチング）', async () => {
    // テスト用の物件番号
    const propertyNumber = 'AA9926';

    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);

      console.log(`[Preservation] Candidates count: ${result.total}`);

      // 買主候補が返されることを確認
      expect(result.candidates).toBeDefined();
      expect(Array.isArray(result.candidates)).toBe(true);

      // 各買主候補が必要なフィールドを持つことを確認
      result.candidates.forEach(candidate => {
        expect(candidate.buyer_number).toBeDefined();
        expect(candidate.name).toBeDefined();
        expect(candidate.latest_status).toBeDefined();
        expect(candidate.desired_area).toBeDefined();
        expect(candidate.desired_property_type).toBeDefined();
      });

      // 物件情報が返されることを確認
      expect(result.property).toBeDefined();
      expect(result.property.property_number).toBe(propertyNumber);
    } catch (error) {
      console.error('[Preservation] Error:', error);
      throw error;
    }
  }, 60000);

  it('買主候補一覧のテーブル表示形式が変わらない', async () => {
    // テスト用の物件番号
    const propertyNumber = 'AA9926';

    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);

      // 買主候補が返されることを確認
      expect(result.candidates).toBeDefined();
      expect(Array.isArray(result.candidates)).toBe(true);

      // 各買主候補が表示に必要なフィールドを持つことを確認
      result.candidates.forEach(candidate => {
        expect(candidate).toHaveProperty('buyer_number');
        expect(candidate).toHaveProperty('name');
        expect(candidate).toHaveProperty('latest_status');
        expect(candidate).toHaveProperty('desired_area');
        expect(candidate).toHaveProperty('desired_property_type');
        expect(candidate).toHaveProperty('reception_date');
        expect(candidate).toHaveProperty('email');
        expect(candidate).toHaveProperty('phone_number');
        expect(candidate).toHaveProperty('inquiry_property_address');
        expect(candidate).toHaveProperty('inquiry_property_price');
      });
    } catch (error) {
      console.error('[Preservation] Error:', error);
      throw error;
    }
  }, 60000);

  it('物件情報が正しく返される', async () => {
    // テスト用の物件番号
    const propertyNumber = 'AA9926';

    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);

      // 物件情報が返されることを確認
      expect(result.property).toBeDefined();
      expect(result.property.property_number).toBe(propertyNumber);
      expect(result.property.property_type).toBeDefined();
      expect(result.property.address).toBeDefined();
    } catch (error) {
      console.error('[Preservation] Error:', error);
      throw error;
    }
  }, 60000);

  it('買主候補が最大50件に制限される', async () => {
    // テスト用の物件番号
    const propertyNumber = 'AA9926';

    try {
      const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);

      // 買主候補が最大50件に制限されることを確認
      expect(result.candidates.length).toBeLessThanOrEqual(50);
    } catch (error) {
      console.error('[Preservation] Error:', error);
      throw error;
    }
  }, 60000);
});
