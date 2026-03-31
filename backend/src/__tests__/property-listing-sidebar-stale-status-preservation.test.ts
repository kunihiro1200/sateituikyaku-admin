// Phase 4: 保存テスト（Preservation Checking）
// 修正後も、正しく「レインズ登録＋SUUMO登録」カテゴリーに含まれるべき物件は含まれることを確認

import { PropertyListingSyncService } from '../services/PropertyListingSyncService';

describe('Property Listing Sidebar Stale Status Bug - Preservation', () => {
  let syncService: PropertyListingSyncService;

  beforeAll(() => {
    syncService = new PropertyListingSyncService();
  });

  // Task 4.1: SUUMO URL空の物件の保存テスト
  test('SUUMO URLが空の物件は「レインズ登録＋SUUMO登録」カテゴリーに含まれる', () => {
    // SUUMO URLが空の物件データを作成
    const row = {
      '物件番号': 'TEST001',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': null,  // 空
      'Suumo登録': '要',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    // 公開予定日が昨日以前の場合をシミュレート
    const gyomuListData = [
      {
        '物件番号': 'TEST001',
        '公開予定日': '2026-03-29',  // 昨日
      }
    ];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST001のステータス: ${status}`);
    expect(status).toBe('レインズ登録＋SUUMO登録');
  });

  test('SUUMO URLが空文字列の物件は「レインズ登録＋SUUMO登録」カテゴリーに含まれる', () => {
    // SUUMO URLが空文字列の物件データを作成
    const row = {
      '物件番号': 'TEST002',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': '',  // 空文字列
      'Suumo登録': '要',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    // 公開予定日が昨日以前の場合をシミュレート
    const gyomuListData = [
      {
        '物件番号': 'TEST002',
        '公開予定日': '2026-03-29',  // 昨日
      }
    ];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST002のステータス: ${status}`);
    expect(status).toBe('レインズ登録＋SUUMO登録');
  });

  test('SUUMO URLがスペースのみの物件は「レインズ登録＋SUUMO登録」カテゴリーに含まれる', () => {
    // SUUMO URLがスペースのみの物件データを作成
    const row = {
      '物件番号': 'TEST003',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': '   ',  // スペースのみ
      'Suumo登録': '要',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    // 公開予定日が昨日以前の場合をシミュレート
    const gyomuListData = [
      {
        '物件番号': 'TEST003',
        '公開予定日': '2026-03-29',  // 昨日
      }
    ];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST003のステータス: ${status}`);
    expect(status).toBe('レインズ登録＋SUUMO登録');
  });

  test('SUUMO URLが登録された物件は「レインズ登録＋SUUMO登録」カテゴリーから除外される', () => {
    // SUUMO URLが登録された物件データを作成
    const row = {
      '物件番号': 'TEST004',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': 'https://suumo.jp/...',  // 登録済み
      'Suumo登録': '要',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
      '担当名（営業）': '',
    };

    // 公開予定日が昨日以前の場合をシミュレート
    const gyomuListData = [
      {
        '物件番号': 'TEST004',
        '公開予定日': '2026-03-29',  // 昨日
      }
    ];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST004のステータス: ${status}`);
    expect(status).not.toBe('レインズ登録＋SUUMO登録');
    // 専任・公開中の場合、担当別のステータスまたは「専任・公開中」になる
    expect(status).toBe('専任・公開中');
  });

  // Task 4.2: 他のカテゴリーの保存テスト
  test('未報告カテゴリーの判定ロジックが変更されていない', () => {
    const row = {
      '物件番号': 'TEST005',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': '',
      'Suumo登録': '要',
      '報告日': '2026-03-30',  // 今日
      '報告担当': 'Y',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    const gyomuListData: any[] = [];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST005のステータス: ${status}`);
    expect(status).toBe('未報告 Y');
  });

  test('未完了カテゴリーの判定ロジックが変更されていない', () => {
    const row = {
      '物件番号': 'TEST006',
      'atbb成約済み/非公開': '専任・公開中',
      'Suumo URL': '',
      'Suumo登録': '要',
      '確認': '未',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    const gyomuListData: any[] = [];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST006のステータス: ${status}`);
    expect(status).toBe('未完了');
  });

  test('一般媒介物件が「SUUMO URL　要登録」カテゴリーに表示される', () => {
    const row = {
      '物件番号': 'TEST007',
      'atbb成約済み/非公開': '一般・公開中',
      'Suumo URL': '',  // 空
      'Suumo登録': '要',
      '確認': '済',
      '一般媒介非公開（仮）': '',
      '１社掲載': '',
      '買付': '',
    };

    // 公開予定日が昨日以前の場合をシミュレート
    const gyomuListData = [
      {
        '物件番号': 'TEST007',
        '公開予定日': '2026-03-29',  // 昨日
      }
    ];

    const status = syncService.calculateSidebarStatus(row, gyomuListData);

    console.log(`  TEST007のステータス: ${status}`);
    expect(status).toBe('SUUMO URL　要登録');
  });
});
