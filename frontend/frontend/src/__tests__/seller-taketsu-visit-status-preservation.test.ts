/**
 * 保全プロパティテスト: 修正前のベースライン動作を記録・確認
 *
 * **重要**: このテストは修正前のコードで PASS すること
 * PASS することで保全すべきベースライン動作が確認される
 *
 * 観察・記録する動作:
 *   - visit_assignee = null の場合に pre-visit-other-decision が呼ばれること
 *   - visit_assignee = "外す" の場合に pre-visit-other-decision が呼ばれること
 *   - visit_assignee = "" の場合に pre-visit-other-decision が呼ばれること
 *   - statusLabel.includes('専任') の場合に exclusive-contract が呼ばれること
 *   - statusLabel.includes('一般') の場合に general-contract が呼ばれること
 *
 * **Validates: Requirements 2.2, 3.1, 3.2, 3.3**
 */

import * as fc from 'fast-check';

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
// エンドポイント選択ロジック（修正前・バグあり）
// ============================================================

/**
 * 修正前（バグあり）のエンドポイント選択ロジック
 * CallModePage.tsx の handleSendChatNotification 内の現在のコード
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
    // visit_assignee の有無を確認していない（バグ）
    return `/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`;
  } else {
    throw new Error('このステータスでは通知を送信できません');
  }
}

// ============================================================
// テストスイート: 保全プロパティ
// ============================================================

describe('Preservation Property Test: 修正前のベースライン動作確認', () => {

  // ============================================================
  // Property 2.1: visit_assignee = null の場合は pre-visit-other-decision
  // ============================================================

  describe('Property 2.1: visit_assignee = null → pre-visit-other-decision', () => {

    /**
     * テスト: visit_assignee = null の場合、pre-visit-other-decision が呼ばれる
     * 修正前・修正後ともに同じ動作をすべき（保全）
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('visit_assignee = null の場合、pre-visit-other-decision が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-null',
        status: 'other_decision_follow_up', // statusLabel = '他決→追客'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ 修正前コードでも pre-visit-other-decision が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

    /**
     * プロパティテスト: 純粋な他決ステータス（専任・一般を含まない）で
     * visit_assignee = null の場合は pre-visit-other-decision
     *
     * 注意: 'other_decision_exclusive'（他決→専任）は '専任' を含むため exclusive-contract が呼ばれる
     *       'other_decision_general'（他決→一般）は '一般' を含むため general-contract が呼ばれる
     *       これらは除外する
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('Property: 純粋な他決ステータスで visit_assignee = null の場合、常に pre-visit-other-decision（保全）', () => {
      // '専任' も '一般' も含まない純粋な他決ステータス
      const pureOtherDecisionStatuses = [
        'other_decision_follow_up',   // 他決→追客
        'other_decision',             // 他決→追客不要
        'UNVISITEDOTHERDECISION',     // 未訪問他決
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...pureOtherDecisionStatuses),
          fc.uuid(), // sellerId
          (status, sellerId) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status,
              visitAssignee: null,
            });

            return endpoint === `/api/chat-notifications/pre-visit-other-decision/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

  // ============================================================
  // Property 2.2: visit_assignee = "外す" の場合は pre-visit-other-decision
  // ============================================================

  describe('Property 2.2: visit_assignee = "外す" → pre-visit-other-decision', () => {

    /**
     * テスト: visit_assignee = "外す" の場合、pre-visit-other-decision が呼ばれる
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('visit_assignee = "外す" の場合、pre-visit-other-decision が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-hazusu',
        status: 'other_decision_follow_up',
        visitAssignee: '外す',
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ 修正前コードでも pre-visit-other-decision が呼ばれる（正常動作）
      // 「外す」は未訪問扱いのため
      expect(endpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

    /**
     * プロパティテスト: 純粋な他決ステータスで visit_assignee = "外す" の場合は pre-visit-other-decision
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('Property: 純粋な他決ステータスで visit_assignee = "外す" の場合、常に pre-visit-other-decision（保全）', () => {
      const pureOtherDecisionStatuses = [
        'other_decision_follow_up',
        'other_decision',
        'UNVISITEDOTHERDECISION',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...pureOtherDecisionStatuses),
          fc.uuid(),
          (status, sellerId) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status,
              visitAssignee: '外す',
            });

            return endpoint === `/api/chat-notifications/pre-visit-other-decision/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

  // ============================================================
  // Property 2.3: visit_assignee = "" の場合は pre-visit-other-decision
  // ============================================================

  describe('Property 2.3: visit_assignee = "" → pre-visit-other-decision', () => {

    /**
     * テスト: visit_assignee = "" の場合、pre-visit-other-decision が呼ばれる
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('visit_assignee = "" の場合、pre-visit-other-decision が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-empty',
        status: 'other_decision_follow_up',
        visitAssignee: '',
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ 修正前コードでも pre-visit-other-decision が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/pre-visit-other-decision/${input.sellerId}`);
    });

    /**
     * プロパティテスト: 純粋な他決ステータスで visit_assignee = "" の場合は pre-visit-other-decision
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('Property: 純粋な他決ステータスで visit_assignee = "" の場合、常に pre-visit-other-decision（保全）', () => {
      const pureOtherDecisionStatuses = [
        'other_decision_follow_up',
        'other_decision',
        'UNVISITEDOTHERDECISION',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...pureOtherDecisionStatuses),
          fc.uuid(),
          (status, sellerId) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status,
              visitAssignee: '',
            });

            return endpoint === `/api/chat-notifications/pre-visit-other-decision/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

  // ============================================================
  // Property 2.4: statusLabel.includes('専任') → exclusive-contract
  // ============================================================

  describe('Property 2.4: statusLabel.includes("専任") → exclusive-contract', () => {

    /**
     * テスト: 専任媒介ステータスの場合、exclusive-contract が呼ばれる
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('status = "exclusive_contract" の場合、exclusive-contract が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-exclusive',
        status: 'exclusive_contract', // statusLabel = '専任媒介'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ exclusive-contract が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/exclusive-contract/${input.sellerId}`);
    });

    /**
     * テスト: EXCLUSIVE ステータスの場合も exclusive-contract が呼ばれる
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('status = "EXCLUSIVE" の場合、exclusive-contract が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-exclusive-2',
        status: 'EXCLUSIVE', // statusLabel = '専任'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ exclusive-contract が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/exclusive-contract/${input.sellerId}`);
    });

    /**
     * プロパティテスト: 専任ステータス全般で exclusive-contract が呼ばれる
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('Property: 専任ステータスで常に exclusive-contract が呼ばれる（保全）', () => {
      // statusLabel に '専任' を含むステータス
      const exclusiveStatuses = [
        'exclusive_contract',       // 専任媒介
        'EXCLUSIVE',                // 専任
        'other_decision_exclusive', // 他決→専任（'専任'を含む）
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...exclusiveStatuses),
          fc.uuid(),
          fc.option(fc.string(), { nil: null }),
          (status, sellerId, visitAssignee) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status,
              visitAssignee,
            });

            return endpoint === `/api/chat-notifications/exclusive-contract/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

  // ============================================================
  // Property 2.5: statusLabel.includes('一般') → general-contract
  // ============================================================

  describe('Property 2.5: statusLabel.includes("一般") → general-contract', () => {

    /**
     * テスト: 一般媒介ステータスの場合、general-contract が呼ばれる
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('status = "general_contract" の場合、general-contract が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-general',
        status: 'general_contract', // statusLabel = '一般媒介'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ general-contract が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/general-contract/${input.sellerId}`);
    });

    /**
     * テスト: GENERAL ステータスの場合も general-contract が呼ばれる
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('status = "GENERAL" の場合、general-contract が呼ばれる（保全）', () => {
      const input = {
        sellerId: 'seller-test-general-2',
        status: 'GENERAL', // statusLabel = '一般'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ general-contract が呼ばれる（正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/general-contract/${input.sellerId}`);
    });

    /**
     * プロパティテスト: 一般ステータス全般で general-contract が呼ばれる
     * （'専任' を含まないもの）
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('Property: 一般ステータスで常に general-contract が呼ばれる（保全）', () => {
      // statusLabel に '一般' を含むステータス（'専任' を含まないもの）
      const generalStatuses = [
        'general_contract',       // 一般媒介
        'GENERAL',                // 一般
        'other_decision_general', // 他決→一般（'一般'を含む）
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...generalStatuses),
          fc.uuid(),
          fc.option(fc.string(), { nil: null }),
          (status, sellerId, visitAssignee) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status,
              visitAssignee,
            });

            return endpoint === `/api/chat-notifications/general-contract/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

  // ============================================================
  // Property 2.6: 未訪問扱いの visit_assignee 値の網羅的確認
  // ============================================================

  describe('Property 2.6: 未訪問扱いの visit_assignee 値（null/空文字/外す）の網羅的確認', () => {

    /**
     * プロパティテスト: null・空文字・「外す」は全て未訪問扱いで pre-visit-other-decision
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('Property: null/空文字/外す は全て pre-visit-other-decision（保全）', () => {
      // 未訪問扱いの visit_assignee 値
      const unvisitedAssignees = [null, '', '外す'];

      fc.assert(
        fc.property(
          fc.constantFrom(...unvisitedAssignees),
          fc.uuid(),
          (visitAssignee, sellerId) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status: 'other_decision_follow_up',
              visitAssignee,
            });

            return endpoint === `/api/chat-notifications/pre-visit-other-decision/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * プロパティテスト: 修正前コードでは、未訪問扱いの値は全て同じエンドポイントを返す
     * （修正後も同じ動作を保全すべき）
     *
     * Validates: Requirements 2.2, 3.2
     */
    it('Property: 未訪問扱いの値は全て同じエンドポイントを返す（保全）', () => {
      const sellerId = 'seller-preservation-test';
      const status = 'other_decision_follow_up';

      const endpointNull = selectEndpoint_BUGGY({ sellerId, status, visitAssignee: null });
      const endpointEmpty = selectEndpoint_BUGGY({ sellerId, status, visitAssignee: '' });
      const endpointHazusu = selectEndpoint_BUGGY({ sellerId, status, visitAssignee: '外す' });

      // 全て同じエンドポイントを返す
      expect(endpointNull).toBe(endpointEmpty);
      expect(endpointEmpty).toBe(endpointHazusu);
      expect(endpointNull).toBe(`/api/chat-notifications/pre-visit-other-decision/${sellerId}`);
    });

  });

  // ============================================================
  // Property 2.7: VISITOTHERDECISION ステータスの既存動作確認
  // ============================================================

  describe('Property 2.7: VISITOTHERDECISION ステータスの既存動作確認', () => {

    /**
     * テスト: VISITOTHERDECISION ステータスは post-visit-other-decision が呼ばれる
     * このステータスは statusLabel = '訪問後他決' で、visit_assignee に関わらず
     * 常に post-visit-other-decision が呼ばれる（既存の正常動作）
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('status = "VISITOTHERDECISION" の場合、post-visit-other-decision が呼ばれる（既存動作）', () => {
      const input = {
        sellerId: 'seller-test-visitotherdecision',
        status: 'VISITOTHERDECISION', // statusLabel = '訪問後他決'
        visitAssignee: null,
      };

      const endpoint = selectEndpoint_BUGGY(input);

      // ✅ post-visit-other-decision が呼ばれる（既存の正常動作）
      expect(endpoint).toBe(`/api/chat-notifications/post-visit-other-decision/${input.sellerId}`);
    });

    /**
     * プロパティテスト: VISITOTHERDECISION は visit_assignee に関わらず post-visit-other-decision
     *
     * Validates: Requirements 3.1, 3.3
     */
    it('Property: VISITOTHERDECISION は visit_assignee に関わらず post-visit-other-decision（既存動作）', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.option(fc.string(), { nil: null }),
          (sellerId, visitAssignee) => {
            const endpoint = selectEndpoint_BUGGY({
              sellerId,
              status: 'VISITOTHERDECISION',
              visitAssignee,
            });

            return endpoint === `/api/chat-notifications/post-visit-other-decision/${sellerId}`;
          }
        ),
        { numRuns: 50 }
      );
    });

  });

});
