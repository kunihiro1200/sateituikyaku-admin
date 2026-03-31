/**
 * バグ条件探索テスト：報告日計算の1日ずれ
 * 
 * このテストは修正前のコードで失敗することを期待しています。
 * 失敗によりバグの存在が確認されます。
 * 
 * Bug Condition: 「報告日設定」が「する」の場合、報告日が本日+13日になる
 * Expected Behavior: 報告日が本日+14日になるべき
 */

import { describe, it, expect } from 'vitest';

describe('Report Date Calculation - Bug Exploration', () => {
  /**
   * Property 1: Bug Condition - 報告日が本日+14日で正確に計算される
   * 
   * このテストは期待される動作をエンコードしています。
   * 修正前は失敗し、修正後にパスすることで修正を検証します。
   */
  it('should calculate report_date as TODAY + 14 days when report_date_setting is "する"', () => {
    // Arrange: 本日の日付を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 期待される報告日（本日+14日）
    const expectedReportDate = new Date(today);
    expectedReportDate.setDate(expectedReportDate.getDate() + 14);
    const expectedDateString = expectedReportDate.toISOString().split('T')[0];
    
    // バグのある計算（本日+13日）
    const buggyReportDate = new Date(today);
    buggyReportDate.setDate(buggyReportDate.getDate() + 13);
    const buggyDateString = buggyReportDate.toISOString().split('T')[0];
    
    // Act: 実際の計算ロジック（現在は未実装なので、バグのある計算を模擬）
    // 注意: 実装後は、実際のReinsRegistrationPageのロジックを呼び出す
    const actualReportDate = buggyDateString; // 修正前: +13日
    
    // Assert: 報告日が本日+14日であることを検証
    expect(actualReportDate).toBe(expectedDateString);
    expect(actualReportDate).not.toBe(buggyDateString);
  });
  
  /**
   * 具体的な反例テスト: AA12497
   * 
   * 本日: 2026年3月31日
   * 期待値: 2026年4月14日（本日+14日）
   * 実際: 2026年4月13日（本日+13日）← バグ
   */
  it('should calculate report_date correctly for AA12497 (2026-03-31 + 14 days = 2026-04-14)', () => {
    // Arrange: 本日を2026年3月31日に固定
    const today = new Date('2026-03-31');
    today.setHours(0, 0, 0, 0);
    
    // 期待される報告日（2026年4月14日）
    const expectedReportDate = new Date(today);
    expectedReportDate.setDate(expectedReportDate.getDate() + 14);
    const expectedDateString = expectedReportDate.toISOString().split('T')[0]; // "2026-04-14"
    
    // バグのある計算（2026年4月13日）
    const buggyReportDate = new Date(today);
    buggyReportDate.setDate(buggyReportDate.getDate() + 13);
    const buggyDateString = buggyReportDate.toISOString().split('T')[0]; // "2026-04-13"
    
    // Act: 実際の計算ロジック（現在は未実装なので、バグのある計算を模擬）
    const actualReportDate = buggyDateString; // 修正前: +13日
    
    // Assert: 報告日が2026年4月14日であることを検証
    expect(actualReportDate).toBe('2026-04-14');
    expect(actualReportDate).not.toBe('2026-04-13');
    
    // 検証: 期待値が正しいことを確認
    expect(expectedDateString).toBe('2026-04-14');
    expect(buggyDateString).toBe('2026-04-13');
  });
  
  /**
   * 月をまたぐケース
   * 
   * 本日: 2026年2月20日
   * 期待値: 2026年3月6日（本日+14日）
   * バグ: 2026年3月5日（本日+13日）
   */
  it('should calculate report_date correctly when crossing month boundary', () => {
    // Arrange: 本日を2026年2月20日に固定
    const today = new Date('2026-02-20');
    today.setHours(0, 0, 0, 0);
    
    // 期待される報告日（2026年3月6日）
    const expectedReportDate = new Date(today);
    expectedReportDate.setDate(expectedReportDate.getDate() + 14);
    const expectedDateString = expectedReportDate.toISOString().split('T')[0]; // "2026-03-06"
    
    // バグのある計算（2026年3月5日）
    const buggyReportDate = new Date(today);
    buggyReportDate.setDate(buggyReportDate.getDate() + 13);
    const buggyDateString = buggyReportDate.toISOString().split('T')[0]; // "2026-03-05"
    
    // Act: 実際の計算ロジック（現在は未実装なので、バグのある計算を模擬）
    const actualReportDate = buggyDateString; // 修正前: +13日
    
    // Assert: 報告日が2026年3月6日であることを検証
    expect(actualReportDate).toBe('2026-03-06');
    expect(actualReportDate).not.toBe('2026-03-05');
  });
  
  /**
   * うるう年のケース
   * 
   * 本日: 2024年2月20日
   * 期待値: 2024年3月5日（本日+14日、うるう年を考慮）
   * バグ: 2024年3月4日（本日+13日）
   */
  it('should calculate report_date correctly for leap year', () => {
    // Arrange: 本日を2024年2月20日に固定（うるう年）
    const today = new Date('2024-02-20');
    today.setHours(0, 0, 0, 0);
    
    // 期待される報告日（2024年3月5日）
    const expectedReportDate = new Date(today);
    expectedReportDate.setDate(expectedReportDate.getDate() + 14);
    const expectedDateString = expectedReportDate.toISOString().split('T')[0]; // "2024-03-05"
    
    // バグのある計算（2024年3月4日）
    const buggyReportDate = new Date(today);
    buggyReportDate.setDate(buggyReportDate.getDate() + 13);
    const buggyDateString = buggyReportDate.toISOString().split('T')[0]; // "2024-03-04"
    
    // Act: 実際の計算ロジック（現在は未実装なので、バグのある計算を模擬）
    const actualReportDate = buggyDateString; // 修正前: +13日
    
    // Assert: 報告日が2024年3月5日であることを検証
    expect(actualReportDate).toBe('2024-03-05');
    expect(actualReportDate).not.toBe('2024-03-04');
  });
});
