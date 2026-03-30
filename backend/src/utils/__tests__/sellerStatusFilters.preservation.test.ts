/**
 * 保全プロパティテスト - 単一コミュニケーション情報の表示（修正前に実行）
 *
 * Feature: sidebar-today-call-combined-label, Property 2: Preservation
 * Validates: Requirements 2.5, 3.1, 3.2, 3.3, 3.4
 *
 * IMPORTANT: このテストは修正前のコードで PASS することが期待される（保全すべき動作の確認）
 */

import { getTodayCallWithInfoLabel } from '../sellerStatusFilters';

const createSeller = (overrides: Record<string, any> = {}) => ({
  id: 'test-id-preservation',
  sellerNumber: 'AA99002',
  name: 'test',
  status: 'test',
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  ...overrides,
});

describe('Property 2: Preservation', () => {
  it('test1: contact_method only', () => {
    const seller = createSeller({ contact_method: 'E' });
    expect(getTodayCallWithInfoLabel(seller)).toBe('当日TEL(E)');
  });
});