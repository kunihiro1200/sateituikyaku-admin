/**
 * バグ条件の探索テスト
 * 
 * 目的: 未修正コードで SellerStatusSidebar の renderAllCategories() に
 * 「当日TEL（担当）」「訪問予定」「訪問済み」ボタンが欠落していることを確認する
 * 
 * CRITICAL: このテストは未修正コードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。コードを修正しないこと。
 * 
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SellerStatusSidebar from '../SellerStatusSidebar';

// react-router-dom のモック
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// テスト用の売主データ作成ヘルパー
const createSeller = (overrides: Record<string, any> = {}) => ({
  id: 'test-id-1',
  sellerNumber: 'AA13501',
  name: 'テスト売主',
  status: '追客中',
  next_call_date: '2026-01-30',
  visit_assignee: '',
  visit_date: null,
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  mailingStatus: '',
  ...overrides,
});

describe('SellerStatusSidebar バグ条件の探索テスト', () => {
  /**
   * テスト1: 「当日TEL（担当）」ボタン欠落テスト
   * 
   * 営担「Y」+ 次電日「2026-01-30」（今日以前）の売主が存在する場合、
   * 未修正コードでは「当日TEL（担当）」ボタンが表示されないことを確認する。
   * 
   * EXPECTED: このテストは未修正コードで FAIL する（ボタンが存在しないため）
   */
  test('営担ありの売主が存在する場合、「当日TEL（担当）」ボタンが表示される', () => {
    const sellers = [
      createSeller({
        id: 'test-id-1',
        sellerNumber: 'AA13501',
        visit_assignee: 'Y',
        next_call_date: '2026-01-30',
      }),
    ];

    const categoryCounts = {
      all: 1,
      todayCall: 0,
      todayCallWithInfo: 0,
      todayCallAssigned: 1, // 当日TEL（担当）が1件
      visitScheduled: 0,
      visitCompleted: 0,
      unvaluated: 0,
      mailingPending: 0,
      todayCallNotStarted: 0,
      pinrichEmpty: 0,
    };

    render(
      <SellerStatusSidebar
        sellers={sellers}
        categoryCounts={categoryCounts}
        selectedCategory="all"
        onCategorySelect={jest.fn()}
      />
    );

    // 「当日TEL（担当）」ボタンが存在することを確認
    // 未修正コードではこのボタンが renderAllCategories() に含まれていないため FAIL する
    // 修正後はボタンとサブカテゴリ展開パネルの両方にテキストが存在するため getAllByText を使用
    const elements = screen.getAllByText('当日TEL（担当）');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * テスト2: 「訪問予定」ボタン欠落テスト
   * 
   * 営担「Y」+ 訪問日「2026-02-10」（今日以降）の売主が存在する場合、
   * 未修正コードでは「訪問予定」ボタンが表示されないことを確認する。
   * 
   * EXPECTED: このテストは未修正コードで FAIL する（ボタンが存在しないため）
   */
  test('訪問日前日の売主が存在する場合、「①訪問日前日」ボタンが表示される', () => {
    const sellers = [
      createSeller({
        id: 'test-id-2',
        sellerNumber: 'AA13502',
        visit_assignee: 'Y',
        visit_date: '2026-02-10', // 今日以降
        next_call_date: null,
      }),
    ];

    const categoryCounts = {
      all: 1,
      todayCall: 0,
      todayCallWithInfo: 0,
      todayCallAssigned: 0,
      visitDayBefore: 1, // 訪問日前日が1件
      visitCompleted: 0,
      unvaluated: 0,
      mailingPending: 0,
      todayCallNotStarted: 0,
      pinrichEmpty: 0,
    };

    render(
      <SellerStatusSidebar
        sellers={sellers}
        categoryCounts={categoryCounts}
        selectedCategory="all"
        onCategorySelect={jest.fn()}
      />
    );

    // 「①訪問日前日」ボタンが存在することを確認
    // 未修正コードではこのボタンが renderAllCategories() に含まれていないため FAIL する
    // 修正後はボタンとサブカテゴリ展開パネルの両方にテキストが存在するため getAllByText を使用
    const elements = screen.getAllByText('①訪問日前日');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * テスト3: 「訪問済み」ボタン欠落テスト
   * 
   * 営担「Y」+ 訪問日「2026-01-20」（昨日以前）の売主が存在する場合、
   * 未修正コードでは「訪問済み」ボタンが表示されないことを確認する。
   * 
   * EXPECTED: このテストは未修正コードで FAIL する（ボタンが存在しないため）
   */
  test('訪問済みの売主が存在する場合、「②訪問済み」ボタンが表示される', () => {
    const sellers = [
      createSeller({
        id: 'test-id-3',
        sellerNumber: 'AA13503',
        visit_assignee: 'Y',
        visit_date: '2026-01-20', // 昨日以前
        next_call_date: null,
      }),
    ];

    const categoryCounts = {
      all: 1,
      todayCall: 0,
      todayCallWithInfo: 0,
      todayCallAssigned: 0,
      visitScheduled: 0,
      visitCompleted: 1, // 訪問済みが1件
      unvaluated: 0,
      mailingPending: 0,
      todayCallNotStarted: 0,
      pinrichEmpty: 0,
    };

    render(
      <SellerStatusSidebar
        sellers={sellers}
        categoryCounts={categoryCounts}
        selectedCategory="all"
        onCategorySelect={jest.fn()}
      />
    );

    // 「②訪問済み」ボタンが存在することを確認
    // 未修正コードではこのボタンが renderAllCategories() に含まれていないため FAIL する
    // 修正後はボタンとサブカテゴリ展開パネルの両方にテキストが存在するため getAllByText を使用
    const elements = screen.getAllByText('②訪問済み');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * テスト4: categoryCounts.todayCallAssigned = 5 を渡してもボタンが表示されないテスト
   * 
   * categoryCounts に todayCallAssigned = 5 を渡しても、
   * renderAllCategories() にボタン呼び出しがないため表示されないことを確認する。
   * 
   * EXPECTED: このテストは未修正コードで FAIL する（ボタンが存在しないため）
   */
  test('categoryCounts.todayCallAssigned = 5 を渡した場合、「当日TEL（担当）」ボタンが表示される', () => {
    const categoryCounts = {
      all: 10,
      todayCall: 2,
      todayCallWithInfo: 1,
      todayCallAssigned: 5, // 5件あるのにボタンが表示されない
      visitScheduled: 0,
      visitCompleted: 0,
      unvaluated: 0,
      mailingPending: 0,
      todayCallNotStarted: 0,
      pinrichEmpty: 0,
    };

    render(
      <SellerStatusSidebar
        sellers={[]}
        categoryCounts={categoryCounts}
        selectedCategory="all"
        onCategorySelect={jest.fn()}
      />
    );

    // 「当日TEL（担当）」ボタンが存在することを確認
    // 未修正コードではこのボタンが renderAllCategories() に含まれていないため FAIL する
    // 修正後はボタンとサブカテゴリ展開パネルの両方にテキストが存在するため getAllByText を使用
    const elements = screen.getAllByText('当日TEL（担当）');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
