/**
 * 売主サイドバーステータス部分一致バグ - Fix Verification Test
 * 
 * このテストは修正後のコードで全パターンが正しく動作することを検証します。
 * 
 * **期待される動作**:
 * - 修正後のコードでは、このテストは**成功する**はずです（バグが修正されたことを確認）
 * 
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import { isTodayCall } from '../utils/sellerStatusFilters';

// テスト用のヘルパー関数
const createTestSeller = (overrides: any = {}) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  return {
    seller_number: 'TEST001',
    status: '追客中',
    next_call_date: todayStr,
    contact_method: '',
    preferred_contact_time: '',
    phone_contact_person: '',
    visit_assignee: '',
    ...overrides,
  };
};

describe('売主サイドバーステータス部分一致バグ - Fix Verification', () => {
  describe('3.1.1 「他決→追客」がtrueを返すことを確認', () => {
    it('状況（当社）が「他決→追客」の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '他決→追客',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: true（正常）
      expect(result).toBe(true);
    });
  });

  describe('3.1.2 「専任→追客」がtrueを返すことを確認', () => {
    it('状況（当社）が「専任→追客」の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '専任→追客',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: true（正常）
      expect(result).toBe(true);
    });
  });

  describe('3.1.3 「追客中」がtrueを返すことを確認（保持）', () => {
    it('状況（当社）が「追客中」の場合、当日TEL分に含まれる（既存動作の維持）', () => {
      const seller = createTestSeller({
        status: '追客中',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: true（正常）
      expect(result).toBe(true);
    });
  });

  describe('3.1.4 「除外後追客中」がtrueを返すことを確認（保持）', () => {
    it('状況（当社）が「除外後追客中」の場合、当日TEL分に含まれる（既存動作の維持）', () => {
      const seller = createTestSeller({
        status: '除外後追客中',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: true（正常）
      expect(result).toBe(true);
    });
  });

  describe('3.1.5 「追客不要」がfalseを返すことを確認（保持）', () => {
    it('状況（当社）が「追客不要」の場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '追客不要',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: false（正常）
      expect(result).toBe(false);
    });
  });

  describe('3.1.6 「他決」がfalseを返すことを確認（保持）', () => {
    it('状況（当社）が「他決」の場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '他決',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: false（正常）
      expect(result).toBe(false);
    });
  });

  describe('追加テストケース: 様々な追客パターン', () => {
    it('状況（当社）が「除外→追客」の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '除外→追客',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: true（正常）
      expect(result).toBe(true);
    });

    it('状況（当社）が「専任」の場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '専任',
      });
      
      const result = isTodayCall(seller);
      
      // 修正後: false（正常）
      expect(result).toBe(false);
    });
  });
});
