/**
 * 保全プロパティテスト - 単一コミュニケーション情報の表示（修正前に実行）
 *
 * Feature: sidebar-today-call-combined-label, Property 2: Preservation
 * Validates: Requirements 2.5, 3.1, 3.2, 3.3, 3.4
 *
 * IMPORTANT: このテストは修正前のコードで PASS することが期待される（保全すべき動作の確認）
 * GOAL: バグ条件を満たさない入力（1フィールドのみ、または全て空）に対して
 *       修正前と同じ動作を確認する
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

describe('Property 2: Preservation - 単一コミュニケーション情報の表示（修正前後で変化なし）', () => {
  it('テスト1: contact_method=Eメール のみ → 当日TEL(Eメール) を返す（変化なし）', () => {
    const seller = createSeller({
      contact_method: 'Eメール',
      preferred_contact_time: '',
      phone_contact_person: '',
    });
    const result = getTodayCallWithInfoLabel(seller);
    expect(result).toBe('当日TEL(Eメール)');
  });

  it('テスト2: preferred_contact_time=午前中 のみ → 当日TEL(午前中) を返す（変化なし）', () => {
    const seller = createSeller({
      contact_method: '',
      preferred_contact_time: '午前中',
      phone_contact_person: '',
    });
    const result = getTodayCallWithInfoLabel(seller);
    expect(result).toBe('当日TEL(午前中)');
  });

  it('テスト3: phone_contact_person=Y のみ → 当日TEL(Y) を返す（変化なし）', () => {
    const seller = createSeller({
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: 'Y',
    });
    const result = getTodayCallWithInfoLabel(seller);
    expect(result).toBe('当日TEL(Y)');
  });

  it('テスト4: 全フィールド空 → 当日TEL（内容） を返す（変化なし）', () => {
    const seller = createSeller({
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
    });
    const result = getTodayCallWithInfoLabel(seller);
    expect(result).toBe('当日TEL（内容）');
  });
});
