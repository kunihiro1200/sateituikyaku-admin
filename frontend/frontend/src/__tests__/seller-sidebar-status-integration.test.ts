/**
 * 売主サイドバーステータス部分一致バグ - Integration Test
 * 
 * このテストは売主リストページでのフィルタリングが正しく動作することを検証します。
 * 
 * **期待される動作**:
 * - 修正後のコードで、様々な状況（当社）パターンの売主が正しくフィルタリングされる
 * - サイドバーのカウントが正しく計算される
 * 
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3**
 */

import {
  filterSellersByCategory,
  getCategoryCounts,
  isTodayCall,
  isTodayCallWithInfo,
} from '../utils/sellerStatusFilters';

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

describe('売主サイドバーステータス部分一致バグ - Integration Test', () => {
  describe('5.1.1 AA13755が「当日TEL分」に表示されることを確認', () => {
    it('状況（当社）が「他決→追客」の売主が当日TEL分にフィルタリングされる', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中' }),
        createTestSeller({ seller_number: 'AA13757', status: '他決' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // AA13755（他決→追客）とAA13756（追客中）が含まれる
      expect(filtered.length).toBe(2);
      expect(filtered.some(s => s.seller_number === 'AA13755')).toBe(true);
      expect(filtered.some(s => s.seller_number === 'AA13756')).toBe(true);
      // AA13757（他決）は含まれない
      expect(filtered.some(s => s.seller_number === 'AA13757')).toBe(false);
    });

    it('様々な追客パターンの売主が当日TEL分にフィルタリングされる', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '専任→追客' }),
        createTestSeller({ seller_number: 'AA13757', status: '除外→追客' }),
        createTestSeller({ seller_number: 'AA13758', status: '追客中' }),
        createTestSeller({ seller_number: 'AA13759', status: '除外後追客中' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // 全ての追客パターンが含まれる
      expect(filtered.length).toBe(5);
      expect(filtered.every(s => isTodayCall(s))).toBe(true);
    });
  });

  describe('5.1.2 サイドバーのカウントが正しいことを確認', () => {
    it('様々な状況（当社）パターンの売主のカウントが正しく計算される', () => {
      const sellers = [
        // 当日TEL分（コミュニケーション情報なし）
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '専任→追客' }),
        createTestSeller({ seller_number: 'AA13757', status: '追客中' }),
        createTestSeller({ seller_number: 'AA13758', status: '除外後追客中' }),
        
        // 当日TEL（内容）（コミュニケーション情報あり）
        createTestSeller({ seller_number: 'AA13759', status: '追客中', contact_method: 'Eメール' }),
        createTestSeller({ seller_number: 'AA13760', status: '他決→追客', phone_contact_person: 'Y' }),
        
        // 除外（追客不要）
        createTestSeller({ seller_number: 'AA13761', status: '追客不要' }),
        createTestSeller({ seller_number: 'AA13762', status: '他決' }),
        createTestSeller({ seller_number: 'AA13763', status: '専任' }),
      ];
      
      const counts = getCategoryCounts(sellers);
      
      // 当日TEL分: 4件（他決→追客、専任→追客、追客中、除外後追客中）
      expect(counts.todayCall).toBe(4);
      
      // 当日TEL（内容）: 2件（追客中+Eメール、他決→追客+Y）
      expect(counts.todayCallWithInfo).toBe(2);
      
      // 全体: 9件
      expect(counts.all).toBe(9);
    });

    it('追客不要を含む売主が正しく除外される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '追客中' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客不要' }),
        createTestSeller({ seller_number: 'AA13757', status: '除外後追客不要' }),
        createTestSeller({ seller_number: 'AA13758', status: '他決→追客不要' }),
      ];
      
      const counts = getCategoryCounts(sellers);
      
      // 当日TEL分: 1件（追客中のみ）
      expect(counts.todayCall).toBe(1);
      
      // 追客不要を含む3件は除外される
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      expect(filtered.length).toBe(1);
      expect(filtered[0].seller_number).toBe('AA13755');
    });
  });

  describe('5.1.3 フィルタリングが正しく動作することを確認', () => {
    it('当日TEL分カテゴリでフィルタリングすると、コミュニケーション情報なしの売主のみが表示される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中', contact_method: 'Eメール' }),
        createTestSeller({ seller_number: 'AA13757', status: '専任→追客', phone_contact_person: 'Y' }),
        createTestSeller({ seller_number: 'AA13758', status: '追客中' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // コミュニケーション情報なしの2件のみ
      expect(filtered.length).toBe(2);
      expect(filtered.some(s => s.seller_number === 'AA13755')).toBe(true);
      expect(filtered.some(s => s.seller_number === 'AA13758')).toBe(true);
      
      // コミュニケーション情報ありの2件は除外
      expect(filtered.some(s => s.seller_number === 'AA13756')).toBe(false);
      expect(filtered.some(s => s.seller_number === 'AA13757')).toBe(false);
    });

    it('当日TEL（内容）カテゴリでフィルタリングすると、コミュニケーション情報ありの売主のみが表示される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中', contact_method: 'Eメール' }),
        createTestSeller({ seller_number: 'AA13757', status: '専任→追客', phone_contact_person: 'Y' }),
        createTestSeller({ seller_number: 'AA13758', status: '追客中' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCallWithInfo');
      
      // コミュニケーション情報ありの2件のみ
      expect(filtered.length).toBe(2);
      expect(filtered.some(s => s.seller_number === 'AA13756')).toBe(true);
      expect(filtered.some(s => s.seller_number === 'AA13757')).toBe(true);
      
      // コミュニケーション情報なしの2件は除外
      expect(filtered.some(s => s.seller_number === 'AA13755')).toBe(false);
      expect(filtered.some(s => s.seller_number === 'AA13758')).toBe(false);
    });

    it('allカテゴリでフィルタリングすると、全ての売主が表示される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中', contact_method: 'Eメール' }),
        createTestSeller({ seller_number: 'AA13757', status: '追客不要' }),
        createTestSeller({ seller_number: 'AA13758', status: '他決' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'all');
      
      // 全ての売主が表示される
      expect(filtered.length).toBe(4);
    });

    it('営担ありの売主が当日TEL分から除外される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客', visit_assignee: '' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中', visit_assignee: 'Y' }),
        createTestSeller({ seller_number: 'AA13757', status: '専任→追客', visit_assignee: 'I' }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // 営担なしの1件のみ
      expect(filtered.length).toBe(1);
      expect(filtered[0].seller_number).toBe('AA13755');
    });
  });

  describe('追加テストケース: エッジケース', () => {
    it('次電日が未来の売主は当日TEL分から除外される', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }), // 今日
        createTestSeller({ seller_number: 'AA13756', status: '追客中', next_call_date: tomorrowStr }), // 明日
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // 次電日が今日の1件のみ
      expect(filtered.length).toBe(1);
      expect(filtered[0].seller_number).toBe('AA13755');
    });

    it('次電日が空の売主は当日TEL分から除外される', () => {
      const sellers = [
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '追客中', next_call_date: '' }),
        createTestSeller({ seller_number: 'AA13757', status: '専任→追客', next_call_date: null }),
      ];
      
      const filtered = filterSellersByCategory(sellers, 'todayCall');
      
      // 次電日が今日の1件のみ
      expect(filtered.length).toBe(1);
      expect(filtered[0].seller_number).toBe('AA13755');
    });

    it('複数の条件を組み合わせた複雑なフィルタリング', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      
      const sellers = [
        // 当日TEL分に含まれる
        createTestSeller({ seller_number: 'AA13755', status: '他決→追客' }),
        createTestSeller({ seller_number: 'AA13756', status: '専任→追客' }),
        createTestSeller({ seller_number: 'AA13757', status: '追客中' }),
        
        // 当日TEL（内容）に含まれる
        createTestSeller({ seller_number: 'AA13758', status: '追客中', contact_method: 'Eメール' }),
        
        // 除外される（追客不要）
        createTestSeller({ seller_number: 'AA13759', status: '追客不要' }),
        
        // 除外される（追客が含まれない）
        createTestSeller({ seller_number: 'AA13760', status: '他決' }),
        
        // 除外される（次電日が未来）
        createTestSeller({ seller_number: 'AA13761', status: '追客中', next_call_date: tomorrowStr }),
        
        // 除外される（営担あり）
        createTestSeller({ seller_number: 'AA13762', status: '追客中', visit_assignee: 'Y' }),
      ];
      
      const todayCallFiltered = filterSellersByCategory(sellers, 'todayCall');
      const todayCallWithInfoFiltered = filterSellersByCategory(sellers, 'todayCallWithInfo');
      const counts = getCategoryCounts(sellers);
      
      // 当日TEL分: 3件
      expect(todayCallFiltered.length).toBe(3);
      expect(counts.todayCall).toBe(3);
      
      // 当日TEL（内容）: 1件
      expect(todayCallWithInfoFiltered.length).toBe(1);
      expect(counts.todayCallWithInfo).toBe(1);
      
      // 全体: 8件
      expect(counts.all).toBe(8);
    });
  });
});
