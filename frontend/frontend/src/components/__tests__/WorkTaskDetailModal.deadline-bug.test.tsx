// @vitest-environment jsdom
/**
 * バグ条件の探索テスト: WorkTaskDetailModal 締日超過警告ポップアップの不当表示バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件 (isBugCondition):
 *   event.type IN ['modal_open', 'fetch_complete']
 *   AND (isDeadlineExceeded(taskData.site_registration_due_date, taskData.site_registration_deadline)
 *        OR isDeadlineExceeded(taskData.floor_plan_due_date, taskData.site_registration_deadline))
 *
 * 根本原因:
 *   WorkTaskDetailModal.tsx の useEffect 内で checkDeadlineOnLoad(taskData) が呼ばれており、
 *   モーダルを開くたびに締日超過チェックが走る。
 *   また fetchData() 内でも checkDeadlineOnLoad(response.data) が呼ばれており、
 *   バックグラウンドデータ取得完了時にも警告が表示される。
 *
 * 期待される反例:
 *   site_registration_due_date が締日を超過しているデータで open=true にすると、
 *   warningDialog.open が true になる（本来は false であるべき）。
 *
 * EXPECTED: このテストは修正前のコードで FAIL する
 */

import * as React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// api モジュールをモック
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

// supabase モジュールをモック
vi.mock('../../services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

import api from '../../services/api';
import WorkTaskDetailModal from '../WorkTaskDetailModal';

// 締日を超過しているテストデータ
// site_registration_due_date (2025-08-10) > site_registration_deadline (2025-08-05) → 超過
const OVERDUE_TASK_DATA = {
  id: 'test-id-1',
  property_number: 'AA001',
  property_address: '大分市中央町1-1-1',
  seller_name: 'テスト売主',
  spreadsheet_url: '',
  sales_assignee: 'K',
  mediation_type: '',
  mediation_deadline: '',
  mediation_completed: '',
  mediation_creator: '',
  mediation_notes: '',
  on_hold: '',
  site_registration_deadline: '2025-08-05',       // 締日
  site_registration_request_date: '',
  site_registration_due_date: '2025-08-10T12:00', // 締日を5日超過
  site_registration_confirmed: '',
  site_registration_confirmer: '',
  site_registration_confirm_request_date: '',
  site_registration_comment: '',
  site_registration_requester: '',
  site_registration_requestor: '',
  site_registration_ok_comment: '',
  site_registration_ok_sent: '',
  floor_plan: '',
  floor_plan_request_date: '',
  floor_plan_due_date: '',
  floor_plan_completed_date: '',
  floor_plan_confirmer: '',
  floor_plan_comment: '',
  floor_plan_ok_comment: '',
  floor_plan_ok_sent: '',
  floor_plan_stored_email: '',
  floor_plan_revision_count: '',
  panorama: '',
  panorama_completed: '',
  site_notes: '',
  property_type: '',
  cadastral_map_sales_input: '',
  cadastral_map_field: '',
  cadastral_map_url: '',
  storage_url: '',
  cw_request_email_site: '',
  cw_request_email_floor_plan: '',
  cw_request_email_2f_above: '',
  cw_person: '',
  email_distribution: '',
  pre_distribution_check: '',
  distribution_date: '',
  publish_scheduled_date: '',
  direction_symbol: '',
  road_dimensions: '',
  property_list_row_added: '',
  property_file: '',
  sales_contract_confirmed: '',
  completed_comment_sales: '',
  binding_scheduled_date: '',
  binding_completed: '',
  seller_payment_method: '',
  brokerage_fee_seller: 0,
  standard_brokerage_fee_seller: 0,
  campaign: '',
  discount_reason_other: '',
  referral_flyer_given: '',
  review_seller: '',
  review_buyer: '',
  other_comments: '',
  settlement_completed_chat: '',
  ledger_created: '',
  payment_confirmed_seller: '',
  accounting_confirmed: '',
  ura_chat: '',
  judicial_scrivener: '',
  judicial_scrivener_contact: '',
  broker: '',
  broker_contact: '',
};

// api.get のモック設定ヘルパー
function setupApiMock() {
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/api/work-tasks/')) {
      return Promise.resolve({ data: OVERDUE_TASK_DATA });
    }
    if (url.includes('/api/employees/normal-initials')) {
      return Promise.resolve({ data: { initials: ['K', 'Y', 'I'] } });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('WorkTaskDetailModal - バグ条件の探索テスト（締日超過警告ポップアップの不当表示）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMock();
  });

  /**
   * テストケース1: モーダルオープン時の不当な警告表示
   *
   * テスト内容:
   *   - site_registration_due_date が締日を超過しているデータで open=true にする
   *   - warningDialog.open が false であることをアサート
   *
   * 修正前のコードでは:
   *   useEffect 内で checkDeadlineOnLoad(taskData) が呼ばれるため、
   *   warningDialog.open が true になる（バグ再現）。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1**
   */
  test('Property 1 (ケース1): モーダルオープン時に締日超過データがあっても警告ダイアログが表示されないこと', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA001"
            initialData={OVERDUE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // 警告ダイアログが表示されていないことをアサート
    // 修正前のコードでは checkDeadlineOnLoad が useEffect 内で呼ばれるため、
    // 「⚠️ 締日超過の警告」ダイアログが表示される → FAIL（バグ再現）
    const warningDialog = document.body.querySelector('[role="dialog"]');
    if (warningDialog) {
      // ダイアログが存在する場合、締日超過警告ダイアログでないことを確認
      const warningTitle = document.body.querySelector('[role="dialog"] .MuiDialogTitle-root');
      if (warningTitle) {
        expect(warningTitle.textContent).not.toContain('締日超過の警告');
      }
    }

    // より直接的なアサート: 「締日超過の警告」テキストが画面に存在しないこと
    // 修正前のコードでは warningDialog が open=true になるため、このテキストが表示される
    const warningText = document.body.querySelector('[data-testid="deadline-warning-dialog"]');
    // テキストベースで確認
    expect(document.body.textContent).not.toContain('締日超過の警告');
  });

  /**
   * テストケース2: fetchData 完了後の不当な警告表示
   *
   * テスト内容:
   *   - initialData なしで open=true にし、fetchData が完了するのを待つ
   *   - fetchData 完了後に warningDialog.open が false であることをアサート
   *
   * 修正前のコードでは:
   *   fetchData() 内で checkDeadlineOnLoad(response.data) が呼ばれるため、
   *   warningDialog.open が true になる（バグ再現）。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.2**
   */
  test('Property 1 (ケース2): fetchData 完了後に締日超過データがあっても警告ダイアログが表示されないこと', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA001"
            // initialData なし → fetchData が呼ばれる
          />
        </MemoryRouter>
      );
    });

    // fetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA001');
    });

    // fetchData 完了後に警告ダイアログが表示されていないことをアサート
    // 修正前のコードでは fetchData 内で checkDeadlineOnLoad が呼ばれるため、
    // 「⚠️ 締日超過の警告」ダイアログが表示される → FAIL（バグ再現）
    expect(document.body.textContent).not.toContain('締日超過の警告');
  });

  /**
   * テストケース3: initialData あり + バックグラウンドfetchData 完了後の不当な警告表示
   *
   * テスト内容:
   *   - initialData あり（即座に表示）で open=true にする
   *   - バックグラウンドで fetchData(true) が完了するのを待つ
   *   - fetchData 完了後に warningDialog.open が false であることをアサート
   *
   * 修正前のコードでは:
   *   useEffect 内で checkDeadlineOnLoad(taskData) が呼ばれ（1回目）、
   *   さらに fetchData(true) 完了後に checkDeadlineOnLoad(response.data) が呼ばれる（2回目）。
   *   → 警告が2回表示される可能性がある（バグ再現）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('Property 1 (ケース3): initialData あり + バックグラウンドfetchData 完了後も警告ダイアログが表示されないこと', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA001"
            initialData={OVERDUE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // バックグラウンドfetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA001');
    });

    // fetchData 完了後も警告ダイアログが表示されていないことをアサート
    // 修正前のコードでは useEffect と fetchData の両方で checkDeadlineOnLoad が呼ばれるため、
    // 「⚠️ 締日超過の警告」ダイアログが表示される → FAIL（バグ再現）
    expect(document.body.textContent).not.toContain('締日超過の警告');
  });
});
