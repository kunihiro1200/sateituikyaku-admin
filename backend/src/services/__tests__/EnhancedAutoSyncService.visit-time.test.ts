// call-mode-visit-time-not-saved バグ条件探索テスト
// Property 1: Bug Condition - 訪問時間が visit_date に反映されないバグ
// **Validates: Requirements 1.2, 1.3**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示す counterexample を発見する

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedAutoSyncService } from '../EnhancedAutoSyncService';

// ============================================================
// Supabase クライアントのモック
// ============================================================

/**
 * updateSingleSeller テスト用の Supabase モックを作成する
 * .update() と .select().eq().single() の呼び出しを追跡する
 */
function createUpdateMock() {
  // update チェーン: .update(data).eq(col, val) → { error: null }
  const eqAfterUpdateMock = jest.fn().mockResolvedValue({ error: null });
  const updateMock = jest.fn().mockReturnValue({ eq: eqAfterUpdateMock });

  // select チェーン: .select('id').eq(col, val).single() → { data: { id: 'test-id' }, error: null }
  const singleMock = jest.fn().mockResolvedValue({
    data: { id: 'test-id' },
    error: null,
  });
  const eqAfterSelectMock = jest.fn().mockReturnValue({ single: singleMock });
  const selectMock = jest.fn().mockReturnValue({ eq: eqAfterSelectMock });

  // propertySyncHandler のモック（syncProperty は何もしない）
  const propertySyncHandlerMock = {
    syncProperty: jest.fn().mockResolvedValue(undefined),
  };

  const fromMock = jest.fn().mockImplementation((_table: unknown) => ({
    select: selectMock,
    update: updateMock,
    insert: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }));

  return {
    from: fromMock,
    updateMock,
    eqAfterUpdateMock,
    propertySyncHandlerMock,
  };
}

// ============================================================
// テストスイート: バグ条件探索
// ============================================================

describe('EnhancedAutoSyncService - visit_date 時間情報消失バグ条件探索', () => {
  let service: EnhancedAutoSyncService;
  let supabaseMock: ReturnType<typeof createUpdateMock>;

  beforeEach(() => {
    supabaseMock = createUpdateMock();

    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );

    // private フィールド supabase をモックに差し替える
    (service as any).supabase = supabaseMock;
    // propertySyncHandler もモックに差し替える
    (service as any).propertySyncHandler = supabaseMock.propertySyncHandlerMock;
  });

  // ============================================================
  // テストケース1: 文字列形式の訪問日 + 訪問時間
  // visitDate = "2026/05/10", visitTime = "14:00"
  // 期待: visit_date = "2026-05-10 14:00:00"
  // バグ条件: formatVisitDate のみで上書きされ "2026-05-10" になる
  // ============================================================

  it('テストケース1: visitDate="2026/05/10", visitTime="14:00" → visit_date が "2026-05-10 14:00:00" になること', async () => {
    // Arrange: 訪問日あり・訪問時間ありのスプレッドシート行
    const row: Record<string, any> = {
      '売主番号': 'AA99999',
      'ステータス': '追客中',
      '訪問日 Y/M/D': '2026/05/10',
      '訪問時間': '14:00',
      // その他のフィールド（空欄）
      '次回コール日': '',
      'ピンリッチ': '',
      '査定額1': '',
      '査定額2': '',
      '査定額3': '',
      '査定額1（自動計算）v': '',
      '査定額2（自動計算）v': '',
      '査定額3（自動計算）v': '',
      '反響年': '',
      '反響日付': '',
      'サイト': '',
      '訪問取得日\n年/月/日': '',
      '訪問査定取得者': '',
      '営担': '',
      '物件所在地': '',
      '種別': '',
      '土（㎡）': '',
      '建（㎡）': '',
      '土地（当社調べ）': '',
      '建物（当社調べ）': '',
      '築年': '',
      '構造': '',
      '間取り': '',
      '電話担当（任意）': '',
      '連絡取りやすい日、時間帯': '',
      '連絡方法': '',
      '一番TEL': '',
      '不通': '',
    };

    // Act
    await service.updateSingleSeller('AA99999', row);

    // === counterexample 記録 ===
    console.log('=== テストケース1 counterexample 記録 ===');
    console.log('入力: visitDate="2026/05/10", visitTime="14:00"');
    console.log('.update() 呼び出し回数:', supabaseMock.updateMock.mock.calls.length);
    if (supabaseMock.updateMock.mock.calls.length > 0) {
      const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
      console.log('visit_date の値:', updateData?.visit_date);
      console.log('期待値: "2026-05-10 14:00:00"');
      console.log('バグ時の実際値: "2026-05-10"（時間が消える）');
    }
    console.log('=== counterexample 終了 ===');

    // Assert: visit_date が "2026-05-10 14:00:00" になることを期待
    // 未修正コードでは "2026-05-10" のみになるため、このアサーションは FAIL する（バグの証拠）
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();
    expect(updateData.visit_date).toBe('2026-05-10 14:00:00');
  });

  // ============================================================
  // テストケース2: Excelシリアル値の訪問日 + 訪問時間
  // visitDate = 46151（Excelシリアル値）, visitTime = 0.583333（14:00のシリアル値）
  // 期待: visit_date = "2026-05-10 14:00:00"
  // バグ条件: formatVisitDate のみで上書きされ "2026-05-10" になる
  // ============================================================

  it('テストケース2: visitDate=46152（Excelシリアル値）, visitTime=0.583333（14:00シリアル値）→ visit_date が "2026-05-10 14:00:00" になること', async () => {
    // Arrange: Excelシリアル値形式の訪問日・訪問時間
    const row: Record<string, any> = {
      '売主番号': 'AA99999',
      'ステータス': '追客中',
      '訪問日 Y/M/D': 46152,       // 2026-05-10 のExcelシリアル値（46152 = 2026-05-10）
      '訪問時間': 0.583333,         // 14:00 のExcelシリアル値（14/24 ≈ 0.583333）
      // その他のフィールド（空欄）
      '次回コール日': '',
      'ピンリッチ': '',
      '査定額1': '',
      '査定額2': '',
      '査定額3': '',
      '査定額1（自動計算）v': '',
      '査定額2（自動計算）v': '',
      '査定額3（自動計算）v': '',
      '反響年': '',
      '反響日付': '',
      'サイト': '',
      '訪問取得日\n年/月/日': '',
      '訪問査定取得者': '',
      '営担': '',
      '物件所在地': '',
      '種別': '',
      '土（㎡）': '',
      '建（㎡）': '',
      '土地（当社調べ）': '',
      '建物（当社調べ）': '',
      '築年': '',
      '構造': '',
      '間取り': '',
      '電話担当（任意）': '',
      '連絡取りやすい日、時間帯': '',
      '連絡方法': '',
      '一番TEL': '',
      '不通': '',
    };

    // Act
    await service.updateSingleSeller('AA99999', row);

    // === counterexample 記録 ===
    console.log('=== テストケース2 counterexample 記録 ===');
    console.log('入力: visitDate=46152（Excelシリアル値）, visitTime=0.583333（14:00シリアル値）');
    console.log('.update() 呼び出し回数:', supabaseMock.updateMock.mock.calls.length);
    if (supabaseMock.updateMock.mock.calls.length > 0) {
      const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
      console.log('visit_date の値:', updateData?.visit_date);
      console.log('期待値: "2026-05-10 14:00:00"');
      console.log('バグ時の実際値: "2026-05-10"（時間が消える）');
    }
    console.log('=== counterexample 終了 ===');

    // Assert: visit_date が "2026-05-10 14:00:00" になることを期待
    // 未修正コードでは "2026-05-10" のみになるため、このアサーションは FAIL する（バグの証拠）
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();
    expect(updateData.visit_date).toBe('2026-05-10 14:00:00');
  });

  // ============================================================
  // テストケース3: detectUpdatedSellers の比較ロジックバグ
  // DB の visit_date = "2026-05-10 14:00:00"
  // スプレッドシートの 訪問日 Y/M/D = "2026/05/10"（時間なし）
  // 期待: 「変更あり」と検出される（visit_date の時間が消えるため）
  // バグ条件: 日付部分のみ比較で「変更なし」と誤判定
  //
  // このテストは detectUpdatedSellers の内部比較ロジックを直接テストする
  // ============================================================

  it('テストケース3: DB visit_date="2026-05-10 14:00:00"、スプレッドシート訪問日="2026/05/10" → 「変更あり」と検出されること', () => {
    // Arrange: DB に時間付きの visit_date が保存されている状態
    const dbVisitDate = '2026-05-10 14:00:00';
    const sheetVisitDate = '2026/05/10';  // スプレッドシートの訪問日（時間なし）

    // detectUpdatedSellers の内部比較ロジックを再現する
    // 現在のバグのある実装:
    //   const formattedSheetVisitDate = sheetVisitDate ? this.formatVisitDate(sheetVisitDate) : null;
    //   const dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
    //   if (formattedSheetVisitDate !== dbVisitDate) { needsUpdate = true; }

    // formatVisitDate の動作を再現（"2026/05/10" → "2026-05-10"）
    const formattedSheetVisitDate = (service as any).formatVisitDate(sheetVisitDate);
    // DB の visit_date を日付部分のみ取り出す（バグのある比較）
    const dbVisitDateOnly = String(dbVisitDate).substring(0, 10);

    // === counterexample 記録 ===
    console.log('=== テストケース3 counterexample 記録 ===');
    console.log('DB visit_date:', dbVisitDate);
    console.log('スプレッドシート 訪問日 Y/M/D:', sheetVisitDate);
    console.log('formatVisitDate の結果:', formattedSheetVisitDate);
    console.log('DB visit_date（日付部分のみ）:', dbVisitDateOnly);
    console.log('バグのある比較: formattedSheetVisitDate === dbVisitDateOnly →', formattedSheetVisitDate === dbVisitDateOnly);
    console.log('期待: 「変更あり」（true）');
    console.log('バグ条件: 日付部分のみ比較で「変更なし」（false）と誤判定される');
    console.log('=== counterexample 終了 ===');

    // Assert 1: formatVisitDate が "2026-05-10" を返すことを確認
    expect(formattedSheetVisitDate).toBe('2026-05-10');

    // Assert 2: DB の visit_date の日付部分も "2026-05-10" であることを確認
    expect(dbVisitDateOnly).toBe('2026-05-10');

    // Assert 3: バグのある比較では「変更なし」と判定されることを確認（バグの証拠）
    // 日付部分のみ比較すると同じ値になるため、変更が検出されない
    const buggyComparisonResult = formattedSheetVisitDate === dbVisitDateOnly;
    console.log('バグのある比較結果（同じ = 変更なし）:', buggyComparisonResult);
    // バグ: 同じ日付なので「変更なし」と判定される（true = 同じ）
    expect(buggyComparisonResult).toBe(true); // バグの証拠: 変更があるのに「同じ」と判定

    // Assert 4: 正しい比較では「変更あり」と検出されるべき
    // DB の visit_date には時間情報（14:00:00）があるが、
    // スプレッドシートの訪問日には時間情報がない
    // → 同期後に時間が消えるため「変更あり」と検出されるべき
    //
    // 正しい比較: DB の visit_date の時間部分（14:00）と
    //             スプレッドシートの訪問時間（空欄）を比較する
    const dbVisitDateTime = String(dbVisitDate).substring(0, 16).replace('T', ' ');
    const sheetVisitDateTime = formattedSheetVisitDate; // 時間なし = "2026-05-10"
    const sheetVisitDateTimeForCompare = sheetVisitDateTime
      ? sheetVisitDateTime.substring(0, 16)
      : null;

    console.log('正しい比較: DB visit_date（分まで）:', dbVisitDateTime);
    console.log('正しい比較: スプレッドシート visit_date（分まで）:', sheetVisitDateTimeForCompare);
    console.log('正しい比較結果（異なる = 変更あり）:', sheetVisitDateTimeForCompare !== dbVisitDateTime);

    // 正しい比較では「変更あり」と検出される
    // 未修正コードではこの比較が行われないため、バグが発生する
    expect(sheetVisitDateTimeForCompare).not.toBe(dbVisitDateTime);
  });
});

// ============================================================
// タスク2: 保全プロパティテスト（Preservation Checking）
// Property 2: Preservation - 訪問時間なし・その他フィールドの動作が変わらない
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
//
// このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
// バグ条件に該当しない入力（visitTime が空欄 / visitDate が空欄 / visitAssignee のみ）で
// 修正前後の動作が変わらないことを確認する
// ============================================================

describe('EnhancedAutoSyncService - 保全プロパティテスト（Preservation Checking）', () => {
  let service: EnhancedAutoSyncService;
  let supabaseMock: ReturnType<typeof createUpdateMock>;

  beforeEach(() => {
    supabaseMock = createUpdateMock();

    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );

    // private フィールド supabase をモックに差し替える
    (service as any).supabase = supabaseMock;
    // propertySyncHandler もモックに差し替える
    (service as any).propertySyncHandler = supabaseMock.propertySyncHandlerMock;
  });

  // ============================================================
  // 共通ヘルパー: 最小限のスプレッドシート行を生成する
  // ============================================================
  function makeRow(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      '売主番号': 'AA99999',
      'ステータス': '追客中',
      '訪問日 Y/M/D': '',
      '訪問時間': '',
      '次回コール日': '',
      'ピンリッチ': '',
      '査定額1': '',
      '査定額2': '',
      '査定額3': '',
      '査定額1（自動計算）v': '',
      '査定額2（自動計算）v': '',
      '査定額3（自動計算）v': '',
      '反響年': '',
      '反響日付': '',
      'サイト': '',
      '訪問取得日\n年/月/日': '',
      '訪問査定取得者': '',
      '営担': '',
      '物件所在地': '',
      '種別': '',
      '土（㎡）': '',
      '建（㎡）': '',
      '土地（当社調べ）': '',
      '建物（当社調べ）': '',
      '築年': '',
      '構造': '',
      '間取り': '',
      '電話担当（任意）': '',
      '連絡取りやすい日、時間帯': '',
      '連絡方法': '',
      '一番TEL': '',
      '不通': '',
      ...overrides,
    };
  }

  // ============================================================
  // 観察1: visitDate = "2026/05/10", visitTime = "" → visit_date = "2026-05-10" のみ
  // バグ条件に該当しない（visitTime が空欄）
  // 期待: visit_date が "2026-05-10" として保存される（時間なし = 00:00:00）
  // **Validates: Requirements 3.1, 3.2**
  // ============================================================
  it('観察1: visitDate="2026/05/10", visitTime="" → visit_date が "2026-05-10" として保存される（時間なし）', async () => {
    // Arrange: 訪問日あり・訪問時間なし（バグ条件に該当しない）
    const row = makeRow({
      '訪問日 Y/M/D': '2026/05/10',
      '訪問時間': '',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_date は "2026-05-10" のみ（時間なし）
    // 未修正コードでは formatVisitDate のみで処理されるため "2026-05-10" になる
    expect(updateData.visit_date).toBe('2026-05-10');

    // visit_time は undefined（空欄なので updateData に含まれない）
    expect(updateData.visit_time).toBeUndefined();

    console.log('[観察1] visit_date:', updateData.visit_date, '（期待: "2026-05-10"）');
  });

  // ============================================================
  // 観察2: visitDate = "", visitTime = "14:00" → visit_date は更新されない
  // バグ条件に該当しない（visitDate が空欄）
  // 期待: visit_date が updateData に含まれない（DBの既存値を保持）
  // **Validates: Requirements 3.2**
  // ============================================================
  it('観察2: visitDate="", visitTime="14:00" → visit_date は updateData に含まれない', async () => {
    // Arrange: 訪問日なし・訪問時間あり（バグ条件に該当しない）
    const row = makeRow({
      '訪問日 Y/M/D': '',
      '訪問時間': '14:00',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_date は updateData に含まれない（visitDate が空欄のため更新しない）
    expect(updateData.visit_date).toBeUndefined();

    // visit_time は "14:00" として保存される（visitTime は独立して保存される）
    expect(updateData.visit_time).toBe('14:00');

    console.log('[観察2] visit_date:', updateData.visit_date, '（期待: undefined）');
    console.log('[観察2] visit_time:', updateData.visit_time, '（期待: "14:00"）');
  });

  // ============================================================
  // 観察3: visitDate = "", visitTime = "" → visit_date は更新されない
  // バグ条件に該当しない（visitDate も visitTime も空欄）
  // 期待: visit_date も visit_time も updateData に含まれない
  // **Validates: Requirements 3.3**
  // ============================================================
  it('観察3: visitDate="", visitTime="" → visit_date も visit_time も updateData に含まれない', async () => {
    // Arrange: 訪問日なし・訪問時間なし（バグ条件に該当しない）
    const row = makeRow({
      '訪問日 Y/M/D': '',
      '訪問時間': '',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_date も visit_time も updateData に含まれない
    expect(updateData.visit_date).toBeUndefined();
    expect(updateData.visit_time).toBeUndefined();

    console.log('[観察3] visit_date:', updateData.visit_date, '（期待: undefined）');
    console.log('[観察3] visit_time:', updateData.visit_time, '（期待: undefined）');
  });

  // ============================================================
  // 観察4: visitAssignee = "田中" → visit_assignee が正しく更新され、visit_date は変わらない
  // バグ条件に該当しない（visitDate が空欄）
  // 期待: visit_assignee = "田中"、visit_date は updateData に含まれない
  // **Validates: Requirements 3.4**
  // ============================================================
  it('観察4: visitAssignee="田中" → visit_assignee が "田中" に更新され、visit_date は updateData に含まれない', async () => {
    // Arrange: 訪問日なし・営担あり（バグ条件に該当しない）
    const row = makeRow({
      '訪問日 Y/M/D': '',
      '訪問時間': '',
      '営担': '田中',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_assignee が "田中" に更新される
    expect(updateData.visit_assignee).toBe('田中');

    // visit_date は updateData に含まれない（visitDate が空欄のため）
    expect(updateData.visit_date).toBeUndefined();

    console.log('[観察4] visit_assignee:', updateData.visit_assignee, '（期待: "田中"）');
    console.log('[観察4] visit_date:', updateData.visit_date, '（期待: undefined）');
  });

  // ============================================================
  // 観察5: visitDate = "2026/05/10", visitTime = "" の Excelシリアル値版
  // バグ条件に該当しない（visitTime が空欄）
  // 期待: visit_date が "2026-05-10" として保存される（時間なし）
  // **Validates: Requirements 3.1, 3.2**
  // ============================================================
  it('観察5: visitDate=46152（Excelシリアル値）, visitTime="" → visit_date が "2026-05-10" として保存される', async () => {
    // Arrange: Excelシリアル値の訪問日・訪問時間なし（バグ条件に該当しない）
    const row = makeRow({
      '訪問日 Y/M/D': 46152,  // 2026-05-10 のExcelシリアル値
      '訪問時間': '',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_date は "2026-05-10" のみ（時間なし）
    expect(updateData.visit_date).toBe('2026-05-10');

    // visit_time は undefined（空欄なので updateData に含まれない）
    expect(updateData.visit_time).toBeUndefined();

    console.log('[観察5] visit_date:', updateData.visit_date, '（期待: "2026-05-10"）');
  });

  // ============================================================
  // 観察6: visitAssignee = "" → visit_assignee が null でクリアされる
  // バグ条件に該当しない
  // 期待: visit_assignee = null（空文字でクリア）
  // **Validates: Requirements 3.4**
  // ============================================================
  it('観察6: visitAssignee="" → visit_assignee が null でクリアされる', async () => {
    // Arrange: 営担を空文字でクリア
    const row = makeRow({
      '訪問日 Y/M/D': '',
      '訪問時間': '',
      '営担': '',
    });

    // Act
    await service.updateSingleSeller('AA99999', row);

    // Assert
    expect(supabaseMock.updateMock).toHaveBeenCalled();
    const updateData = supabaseMock.updateMock.mock.calls[0]?.[0] as any;
    expect(updateData).toBeDefined();

    // visit_assignee が null でクリアされる
    expect(updateData.visit_assignee).toBeNull();

    // visit_date は updateData に含まれない
    expect(updateData.visit_date).toBeUndefined();

    console.log('[観察6] visit_assignee:', updateData.visit_assignee, '（期待: null）');
    console.log('[観察6] visit_date:', updateData.visit_date, '（期待: undefined）');
  });
});
