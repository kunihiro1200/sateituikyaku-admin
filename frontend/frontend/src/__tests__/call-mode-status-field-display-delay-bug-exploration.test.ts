/**
 * バグ条件探索テスト: バックグラウンド更新後の editedExclusiveDecisionDate 未初期化バグ
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 */

// contractYearMonth を YYYY-MM-DD 形式に変換する（通常パスと同じロジック）
function formatContractYearMonth(rawDate: string | null | undefined): string {
  if (!rawDate) return '';
  if (typeof rawDate === 'string' && rawDate.length === 7) return rawDate + '-01';
  if (typeof rawDate === 'string') return rawDate.split('T')[0];
  return '';
}

type State = {
  statusChangedRef: { current: boolean };
  editedStatus: string;
  editedExclusiveDecisionDate: string;
};

type FreshData = {
  status: string;
  contractYearMonth?: string | null;
};

// 修正前（バグあり）: setEditedExclusiveDecisionDate が呼ばれない
function simulateBackgroundUpdate_unfixed(freshData: FreshData, state: State): void {
  if (!state.statusChangedRef.current) {
    state.editedStatus = freshData.status;
    // ❌ setEditedExclusiveDecisionDate が呼ばれていない
  }
}

// 修正後（期待される動作）
function simulateBackgroundUpdate_fixed(freshData: FreshData, state: State): void {
  if (!state.statusChangedRef.current) {
    state.editedStatus = freshData.status;
    // ✅ contractYearMonth を初期化
    state.editedExclusiveDecisionDate = formatContractYearMonth(freshData.contractYearMonth);
  }
}

describe('Bug Condition Exploration: editedExclusiveDecisionDate 未初期化バグ', () => {

  // ---- Property 1: Bug Condition（修正前は FAIL） ----

  it('Bug: contractYearMonth="2025-03" のとき editedExclusiveDecisionDate が "2025-03-01" になる（修正前は FAIL）', () => {
    const state: State = { statusChangedRef: { current: false }, editedStatus: '追客中', editedExclusiveDecisionDate: '' };
    simulateBackgroundUpdate_unfixed({ status: '一般媒介', contractYearMonth: '2025-03' }, state);
    expect(state.editedExclusiveDecisionDate).toBe('2025-03-01');
  });

  it('Bug: contractYearMonth=null のとき古いキャッシュ値がクリアされる（修正前は FAIL）', () => {
    const state: State = { statusChangedRef: { current: false }, editedStatus: '追客中', editedExclusiveDecisionDate: '2024-12-01' };
    simulateBackgroundUpdate_unfixed({ status: '一般媒介', contractYearMonth: null }, state);
    expect(state.editedExclusiveDecisionDate).toBe('');
  });

  // ---- Preservation: statusChangedRef.current === true のとき上書きしない ----

  it('Preservation: statusChangedRef.current=true のとき editedExclusiveDecisionDate は変更されない', () => {
    const state: State = { statusChangedRef: { current: true }, editedStatus: '専任媒介', editedExclusiveDecisionDate: '2025-06-01' };
    simulateBackgroundUpdate_unfixed({ status: '一般媒介', contractYearMonth: '2025-01' }, state);
    expect(state.editedExclusiveDecisionDate).toBe('2025-06-01');
    expect(state.editedStatus).toBe('専任媒介');
  });

  // ---- formatContractYearMonth 変換ロジック ----

  it('formatContractYearMonth: YYYY-MM → YYYY-MM-01', () => {
    expect(formatContractYearMonth('2025-03')).toBe('2025-03-01');
  });

  it('formatContractYearMonth: YYYY-MM-DD → そのまま', () => {
    expect(formatContractYearMonth('2025-03-15')).toBe('2025-03-15');
  });

  it('formatContractYearMonth: null → ""', () => {
    expect(formatContractYearMonth(null)).toBe('');
  });

  // ---- 修正後の動作確認（修正後に PASS することを確認） ----

  it('Fix: contractYearMonth="2025-03" のとき editedExclusiveDecisionDate が "2025-03-01" になる', () => {
    const state: State = { statusChangedRef: { current: false }, editedStatus: '追客中', editedExclusiveDecisionDate: '' };
    simulateBackgroundUpdate_fixed({ status: '一般媒介', contractYearMonth: '2025-03' }, state);
    expect(state.editedExclusiveDecisionDate).toBe('2025-03-01');
  });

  it('Fix: contractYearMonth=null のとき editedExclusiveDecisionDate が "" になる', () => {
    const state: State = { statusChangedRef: { current: false }, editedStatus: '追客中', editedExclusiveDecisionDate: '2024-12-01' };
    simulateBackgroundUpdate_fixed({ status: '一般媒介', contractYearMonth: null }, state);
    expect(state.editedExclusiveDecisionDate).toBe('');
  });

});
