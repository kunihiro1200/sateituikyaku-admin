/**
 * 売主サイドバーステータス部分一致バグ - Preservation Test
 * 
 * このテストは修正後のコードで既存の動作が維持されることを検証します。
 * 
 * **期待される動作**:
 * - 修正後のコードでも、既存のパターン（「追客中」「除外後追客中」「追客不要」など）が正しく動作する
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import { isTodayCall, isTodayCallWithInfo } from '../utils/sellerStatusFilters';

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

describe('売主サイドバーステータス部分一致バグ - Preservation Test', () => {
  describe('4.1.1 「追客中」の売主が「当日TEL分」に含まれることを確認', () => {
    it('状況（当社）が「追客中」、次電日が今日以前、コミュニケーション情報が全て空、営担が空の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '追客中',
      });
      
      const result = isTodayCall(seller);
      
      // 既存動作の維持: true
      expect(result).toBe(true);
    });
  });

  describe('4.1.2 「除外後追客中」の売主が「当日TEL分」に含まれることを確認', () => {
    it('状況（当社）が「除外後追客中」、次電日が今日以前、コミュニケーション情報が全て空、営担が空の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '除外後追客中',
      });
      
      const result = isTodayCall(seller);
      
      // 既存動作の維持: true
      expect(result).toBe(true);
    });
  });

  describe('4.1.3 「追客不要」の売主が除外されることを確認', () => {
    it('状況（当社）が「追客不要」の場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '追客不要',
      });
      
      const result = isTodayCall(seller);
      
      // 既存動作の維持: false
      expect(result).toBe(false);
    });

    it('状況（当社）が「除外後追客不要」の場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '除外後追客不要',
      });
      
      const result = isTodayCall(seller);
      
      // 既存動作の維持: false
      expect(result).toBe(false);
    });
  });

  describe('4.1.4 コミュニケーション情報ありの売主が「当日TEL（内容）」に分類されることを確認', () => {
    it('連絡方法に値がある場合、当日TEL（内容）に分類される', () => {
      const seller = createTestSeller({
        status: '追客中',
        contact_method: 'Eメール',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      // 既存動作の維持: 当日TEL分には含まれない、当日TEL（内容）に含まれる
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(true);
    });

    it('連絡取りやすい時間に値がある場合、当日TEL（内容）に分類される', () => {
      const seller = createTestSeller({
        status: '追客中',
        preferred_contact_time: '午前中',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      // 既存動作の維持: 当日TEL分には含まれない、当日TEL（内容）に含まれる
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(true);
    });

    it('電話担当に値がある場合、当日TEL（内容）に分類される', () => {
      const seller = createTestSeller({
        status: '追客中',
        phone_contact_person: 'Y',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      // 既存動作の維持: 当日TEL分には含まれない、当日TEL（内容）に含まれる
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(true);
    });
  });

  describe('4.1.5 営担ありの売主が「当日TEL（担当）」に分類されることを確認', () => {
    it('営担に値がある場合、当日TEL分から除外される', () => {
      const seller = createTestSeller({
        status: '追客中',
        visit_assignee: 'Y',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      // 既存動作の維持: 当日TEL分にも当日TEL（内容）にも含まれない
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(false);
    });

    it('営担が「外す」の場合、当日TEL分に含まれる', () => {
      const seller = createTestSeller({
        status: '追客中',
        visit_assignee: '外す',
      });
      
      const result = isTodayCall(seller);
      
      // 既存動作の維持: true（「外す」は担当なしと同じ扱い）
      expect(result).toBe(true);
    });
  });

  describe('追加テストケース: 複合条件', () => {
    it('「追客中」+ コミュニケーション情報あり + 営担なし → 当日TEL（内容）', () => {
      const seller = createTestSeller({
        status: '追客中',
        contact_method: 'Eメール',
        visit_assignee: '',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(true);
    });

    it('「他決→追客」+ コミュニケーション情報なし + 営担なし → 当日TEL分', () => {
      const seller = createTestSeller({
        status: '他決→追客',
        contact_method: '',
        visit_assignee: '',
      });
      
      const result = isTodayCall(seller);
      
      expect(result).toBe(true);
    });

    it('「他決→追客」+ コミュニケーション情報あり + 営担なし → 当日TEL（内容）', () => {
      const seller = createTestSeller({
        status: '他決→追客',
        contact_method: 'Eメール',
        visit_assignee: '',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(true);
    });

    it('「他決→追客」+ 営担あり → 当日TEL分から除外', () => {
      const seller = createTestSeller({
        status: '他決→追客',
        visit_assignee: 'Y',
      });
      
      const isTodayCallResult = isTodayCall(seller);
      const isTodayCallWithInfoResult = isTodayCallWithInfo(seller);
      
      expect(isTodayCallResult).toBe(false);
      expect(isTodayCallWithInfoResult).toBe(false);
    });
  });
});
