/**
 * バグ条件探索テスト: 訪問済み他決の通知エンドポイント誤選択
 *
 * **CRITICAL**: このテストは修正前のコードで必ず FAIL すること
 * FAIL することでバグの存在が確認される
 *
 * **修正前にテストが失敗しても、テストやコードを修正しないこと**
 *
 * バグ条件:
 *   - visit_assignee が設定されている（訪問済み）
 *   - status = 'other_decision_follow_up'（statusLabel = '他決→追客'）
 *   - statusLabel.includes('他決') にマッチするため、visit_assignee の有無に関わらず
 *     常に pre-visit-other-decision エンドポイントが呼ばれる
 *
 * 期待される動作（修正後）:
 *   - visit_assignee が設定されている場合は post-visit-other-decision が呼ばれる
 *   - visit_assignee が null/空文字/「外す」の場合は pre-visit-other-decision が呼ばれる
 *
 * **Validates: Requirements 1.1**
 */

// ============================================================
// getStatusLabel 関数（CallModePage.tsx から抽出）
// ============================================================

/**
 * ステータスコードを日本語ラベルに変換する関数
 * CallModePage.tsx の getStatusLabel と同じ実装
 */
function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'following_up': '追客中',
    'follow_up_not_needed': '追客不要（未訪問）',
    'lost': '除外済追客不要',
    'follow_up_not_needed_after_exclusion': '除外後追客中',
    'exclusive_contract': '専任媒介',
    'general_contract': '一般媒介',
    'other_company_purchase': '他社買取',
    'other_decision_follow_up': '他決→追客',
    'other_decision': '他決→追客不要',
    'other_decision_exclusive': '他決→専任',
    'other_decision_general': '他決→一般',
    'appointment_scheduled': '訪問（担当付）追客不要',
    'VISITOTHERDECISION': '訪問後他決',
    'UNVISITEDOTHERDECISION': '未訪問他決',
    'EXCLUSIVE': '専任',
    'GENERAL': '一般',
  };
  return statusLabels[status] || status;
}

// ============================================================
// バグ条件の形式的定義
// ============================================================

/**
 * バグ条件を判定する関数
 * visit_assignee が設定されており（訪問済み）、かつ他決ステータスの場合にバグが発生する
 */
function isBugCondition(input: {
  visitAssignee: string | null | undefined;
  status: string;
}): boolean {
  const statusLabel = getStatusLabel(input.status);
  const isVisited =
    input.visitAssignee !== null &&
    input.visitAssignee !== undefined &&
    input.visitAssignee !== '' &&
    input.visitAssignee !== '外す';
  const isOtherDecision = statusLabel.includes('他決');
  return isVisited && isOtherDecision;
}

// ============================================================
// エンドポイント選択ロジックのシミュレーション
// ============================================================

/**
 * 修正前（バグあり）のエンドポイント選択ロジック
 * CallModePage.tsx の handleSendChatNotification 内の現在のコード:
 *
 *   } else if (statusLabel.includes('訪問後他決')) {
 *     endpoint = `/api/chat-notifications/post-visit-other-decision/${seller.id}`;
 *   } else if (statusLabel.includes('未訪問他決') || statusLabel.includes('他決')) {
 *     endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
 *   }
 *
 * バグ: '他決→追客' は statusLabel.includes('他決') にマッチするため、
 *       visit_assignee の有無に関わらず常に pre-visit-other-decision が呼ばれる
 */
function selectEndpoint_BUGGY(input: {
  sellerId: string;
  status: string;
  visitAssignee: string | null | undefined;
}): string {
  const statusLabel = getStatusLabel(input.status);

  if (statusLabel.includes('専任')) {
    return `/api/chat-notifications/exclusive-contract/${input.sellerId}`;
  } else if (statusLabel.includes('一般')) {
    return `/api/chat-notifications/general-contract/${input.sellerId}`;
  } else if (statusLabel.includes('訪問後他決')) {
    return `/api/chat-notifications/post-visit-other-decision/${input.sellerId}`;
  } else if (statusLabel.includes('未訪問他決') || statusLabel.includes('他決')) {
    // ❌ バグ: visit_assignee の有無を確認していない
    // '他決→追客' は statusLabel.includes('他決') にマッチするため、
    // visit_assignee が設定されていても pre-visit-other-decision が呼ばれる
    return `/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`;
  } else {
    throw new Error('このステータスでは通知を送信できません');
  }
}

/**
 * 修正後（バグ修正）のエンドポイント選択ロジック
 * visit_assignee の有無を確認して適切なエンドポイントを選択する
 */
function selectEndpoint_FIXED(input: {
  sellerId: string;
  status: string;
  visitAssignee: string | null | undefined;
}): string {
  const statusLabel = getStatusLabel(input.status);

  if (statusLabel.includes('専任')) {
    return `/api/chat-notifications/exclusive-contract/${input.sellerId}`;
  } else if (statusLabel.includes('一般')) {
    return `/api/chat-notifications/general-contract/${input.sellerId}`;
  } else if (statusLabel.includes('訪問後他決')) {
    return `/api/chat-notifications/post-visit-other-decision/${input.sellerId}`;
  } else if (statusLabel.includes('未訪問他決')) {
    return `/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`;
  } else if (statusLabel.includes('他決')) {
    // ✅ 修正: visit_assignee の有無を確認する
    const isVisited =
      input.visitAssignee &&
      input.visitAssignee !== '' &&
      input.visitAssignee !== '外す';
    return isVisited
      ? `/api/chat-notifications/post-visit-other-decision/${input.sellerId}`
      : `/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`;
  } else {
    throw new Error('このステータスでは通知を送信できません');
  }
}

// ============================================================
// テストスイート
// ============================================================

describe('Bug Condition Exploration: 訪問済み他決の通知エンドポイント誤選択', () => {

  // ============================================================
  // Property 1: Bug Condition
  // visit_assignee が設定されている（訪問済み）かつ他決ステータスの場合、
  // 修正後は post-visit-other-decision が呼ばれることを期待する
  // 未修正コードでは pre-visit-other-decision が呼ばれるため FAIL する
  // ============================================================

  describe('Property 1: Bug Condition - 訪問済み他決の通知エンドポイント', () => {

    /**
     * テスト1: AA13872のケース再現
     * visit_assignee = "KN"（訪問済み）、status = 'other_decision_follow_up'（他決→追客）
     * 期待: post-visit-other-decision が呼ばれる
     * 未修正コードでは pre-visit-other-decision が呼ばれるため FAIL する
     *
     * Validates: Requirements 1.1
     */
    it('Bug Condition 1.1: visit_assignee = "KN" の場合、post-visit-other-decision が呼ばれるべき（未修正コードで FAIL）', () => {
      const input = {
        sellerId: 'seller-aa13872',
        status: 'other_decision_follow_up', // statusLabel = '他決→追客'
        visitAssignee: 'KN',               // 訪問済み
      };

      // バグ条件を満たすことを確認
      expect(isBugCondition({
        visitAssignee: input.visitAssignee,
        status: input.status,
      })).toBe(true);

      // statusLabel の確認
      const statusLabel = getStatusLabel(input.status);
      expect(statusLabel).toBe('他決→追客');

      // 未修正コードのエンドポイント選択
      const buggyEndpoint = selectEndpoint_BUGGY(input);

      // ❌ 未修正コードでは pre-visit-other-decision が呼ばれる（バグ）
      // このアサーションは FAIL する（バグの存在を証明）
      // 期待: post-visit-other-decision
      // 実際: pre-visit-other-decision
      expect(buggyEndpoint).toBe(`/api/chat-notifications/post-visit-other-decision/${input.sellerId}`);
    });

    /**
     * テスト2: 別のイニシャルでも同様のバグが発生することを確認
     * visit_assignee = "Y"（訪問済み）、status = 'other_decision_follow_up'
     * 期待: post-visit-other-decision が呼ばれる
     * 未修正コードでは pre-visit-other-decision が呼ばれるため FAIL する
     *
     * Validates: Requirements 1.1
     */
    it('Bug Condition 1.2: visit_assignee = "Y" の場合、post-visit-other-decision が呼ばれるべき（未修正コードで FAIL）', () => {
      const input = {
        sellerId: 'seller-test-001',
        status: 'other_decision_follow_up',
        visitAssignee: 'Y',
      };

      // バグ条件を満たすことを確認
      expect(isBugCondition({
        visitAssignee: input.visitAssignee,
        status: input.status,
      })).toBe(true);

      // 未修正コードのエンドポイント選択
      const buggyEndpoint = selectEndpoint_BUGGY(input);

      // ❌ 未修正コードでは pre-visit-other-decision が呼ばれる（バグ）
      // このアサーションは FAIL する（バグの存在を証明）
      expect(buggyEndpoint).toBe(`/api/chat-notifications/post-visit-other-decision/${input.sellerId}`);
    });

  });

  // ============================================================
  // 正常動作確認: visit_assignee = null の場合は pre-visit-other-decision が呼ばれる
  // ============================================================

  describe('正常動作確認: visit_assignee = null の場合', () => {

    /**
     * テスト3: visit_assignee = null の場合は pre-visit-other-decision が呼ばれる（正常動作）
     * 未修正コードでも修正後コードでも同じ動作をする
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('正常動作 3.1: visit_assignee = null の場合、pre-visit-other-decision が呼ばれる（正常動作）', () => {
      const input = {
        sellerId: 'seller-test-002',
        status: 'other_decision_follow_up',
        visitAssignee: null,
      };

      // バグ条件を満たさないことを確認（未訪問）
      expect(isBugCondition({
        visitAssignee: input.visitAssignee,
        status: input.status,
      })).toBe(false);

      // 未修正コードのエンドポイント選択
      const buggyEndpoint = selectEndpoint_BUGGY(input);

      // ✅ 未修正コードでも pre-visit-other-decision が呼ばれる（正常動作）
      // このアサーションは PASS する
      expect(buggyEndpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

    /**
     * テスト4: visit_assignee = "" の場合も pre-visit-other-decision が呼ばれる（正常動作）
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('正常動作 3.2: visit_assignee = "" の場合、pre-visit-other-decision が呼ばれる（正常動作）', () => {
      const input = {
        sellerId: 'seller-test-003',
        status: 'other_decision_follow_up',
        visitAssignee: '',
      };

      // バグ条件を満たさないことを確認（未訪問）
      expect(isBugCondition({
        visitAssignee: input.visitAssignee,
        status: input.status,
      })).toBe(false);

      // 未修正コードのエンドポイント選択
      const buggyEndpoint = selectEndpoint_BUGGY(input);

      // ✅ 未修正コードでも pre-visit-other-decision が呼ばれる（正常動作）
      expect(buggyEndpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

  });

  // ============================================================
  // 参照: 修正後の期待される動作（修正後にパスすることを確認）
  // ============================================================

  describe('参照: 修正後の期待される動作', () => {

    /**
     * テスト5: 修正後は visit_assignee = "KN" の場合に post-visit-other-decision が呼ばれる
     *
     * Validates: Requirements 2.1
     */
    it('修正後 5.1: visit_assignee = "KN" の場合、post-visit-other-decision が呼ばれる（修正後の期待動作）', () => {
      const input = {
        sellerId: 'seller-aa13872',
        status: 'other_decision_follow_up',
        visitAssignee: 'KN',
      };

      // 修正後コードのエンドポイント選択
      const fixedEndpoint = selectEndpoint_FIXED(input);

      // ✅ 修正後は post-visit-other-decision が呼ばれる
      expect(fixedEndpoint).toBe(`/api/chat-notifications/post-visit-other-decision/${input.sellerId}`);
    });

    /**
     * テスト6: 修正後も visit_assignee = null の場合は pre-visit-other-decision が呼ばれる（保全）
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('修正後 5.2: visit_assignee = null の場合、pre-visit-other-decision が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-002',
        status: 'other_decision_follow_up',
        visitAssignee: null,
      };

      // 修正後コードのエンドポイント選択
      const fixedEndpoint = selectEndpoint_FIXED(input);

      // ✅ 修正後も pre-visit-other-decision が呼ばれる（保全）
      expect(fixedEndpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

  });

  // ============================================================
  // バグ条件の形式仕様テスト
  // ============================================================

  describe('バグ条件の形式仕様 - isBugCondition の検証', () => {

    /**
     * isBugCondition の仕様:
     * isBugCondition(X) = true
     *   ⟺ X.visitAssignee IS NOT NULL AND IS NOT "" AND IS NOT "外す"
     *      AND getStatusLabel(X.status) CONTAINS "他決"
     */
    it('isBugCondition: 訪問済み + 他決ステータスの場合のみ true を返す', () => {
      // バグ条件を満たす（訪問済み + 他決）
      expect(isBugCondition({ visitAssignee: 'KN', status: 'other_decision_follow_up' })).toBe(true);
      expect(isBugCondition({ visitAssignee: 'Y', status: 'other_decision_follow_up' })).toBe(true);
      expect(isBugCondition({ visitAssignee: 'I', status: 'other_decision' })).toBe(true);

      // バグ条件を満たさない（未訪問）
      expect(isBugCondition({ visitAssignee: null, status: 'other_decision_follow_up' })).toBe(false);
      expect(isBugCondition({ visitAssignee: '', status: 'other_decision_follow_up' })).toBe(false);
      expect(isBugCondition({ visitAssignee: '外す', status: 'other_decision_follow_up' })).toBe(false);

      // バグ条件を満たさない（他決以外のステータス）
      expect(isBugCondition({ visitAssignee: 'KN', status: 'exclusive_contract' })).toBe(false);
      expect(isBugCondition({ visitAssignee: 'KN', status: 'following_up' })).toBe(false);

      // VISITOTHERDECISION は statusLabel = '訪問後他決' → '他決' を含む → バグ条件を満たす
      expect(isBugCondition({ visitAssignee: 'KN', status: 'VISITOTHERDECISION' })).toBe(true);
    });

  });

});
