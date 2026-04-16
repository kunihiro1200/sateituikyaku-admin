// Preservation Test: 売主サイドバーカウント不一致バグ修正の保全テスト
// 既存8担当者のイニシャル変換が正しいことを確認する
// このテストは未修正コードでPASSすることを確認する
//
// Validates: Requirements 3.1, 3.2, 3.3

import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

describe('売主サイドバーカウント不一致バグ - 保全テスト', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 既存8担当者のイニシャル変換テスト
  describe('Preservation: 既存担当者のイニシャル変換が正しいこと', () => {
    const existingAssignees = [
      { name: '山本', expected: 'Y' },
      { name: '生野', expected: '生' },
      { name: '久', expected: '久' },
      { name: '裏', expected: 'U' },
      { name: '林', expected: '林' },
      { name: '国広', expected: 'K' },
      { name: '木村', expected: 'R' },
      { name: '角井', expected: 'I' },
    ];

    existingAssignees.forEach(({ name, expected }) => {
      it(`getAssigneeInitial('${name}') が '${expected}' を返すこと`, () => {
        const listing = {
          property_number: 'AA0001',
          report_date: yesterdayStr,
          report_assignee: name,
          confirmation: '済',
          atbb_status: '一般・公開中',
          sales_assignee: null,
          general_mediation_private: null,
          single_listing: null,
          suumo_url: null,
          suumo_registered: null,
          offer_status: null,
          price_reduction_scheduled_date: null,
        };

        const status = calculatePropertyStatus(listing);

        expect(status.key).toBe('unreported');
        expect(status.label.replace(/\s+/g, '')).toBe(`未報告${expected}`);
      });
    });

    it('report_assignee が null の場合、ラベルが "未報告" となること', () => {
      const listing = {
        property_number: 'AA0002',
        report_date: yesterdayStr,
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      expect(status.key).toBe('unreported');
      // null の場合は '' が返るので、ラベルは '未報告' となる
      expect(status.label.replace(/\s+/g, '')).toBe('未報告');
    });

    it('report_assignee が空文字列の場合、ラベルが "未報告" となること', () => {
      const listing = {
        property_number: 'AA0003',
        report_date: yesterdayStr,
        report_assignee: '',
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      expect(status.key).toBe('unreported');
      expect(status.label.replace(/\s+/g, '')).toBe('未報告');
    });
  });
});
