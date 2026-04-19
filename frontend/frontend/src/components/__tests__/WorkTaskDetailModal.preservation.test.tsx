// @vitest-environment jsdom
/**
 * 保全プロパティテスト: WorkTaskDetailModal handleFieldChange 経由の日付変更時の警告表示
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前・修正後の両方で PASS することが期待される。
 * PASS することで「保全すべきベースライン動作」を確認する。
 *
 * Property 2: Preservation
 *   handleFieldChange 経由で締日超過の日付を入力した場合、常に warningDialog が開く。
 *   handleFieldChange 経由で締日以内の日付を入力した場合、warningDialog は開かない。
 *
 * 観察した動作パターン:
 *   観察1: site_registration_due_date に締日超過の日付を入力 → warningDialog.open = true
 *   観察2: floor_plan_due_date に締日超過の日付を入力 → warningDialog.open = true
 *   観察3: 締日以内の日付を入力 → warningDialog.open = false のまま
 *   観察4: 警告ポップアップの「確認しました」ボタンで warningDialog.open = false になる
 *
 * EXPECTED: このテストは修正前のコードで PASS する（保全動作の確認）
 */

import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// 締日: 2025-08-05
// 締日以内の日付: 2025-08-04T12:00
// 締日超過の日付: 2025-08-10T12:00
const SITE_REGISTRATION_DEADLINE = '2025-08-05';
const OVERDUE_DATE = '2025-08-10T12:00';       // 締日を5日超過
const WITHIN_DEADLINE_DATE = '2025-08-04T12:00'; // 締日の1日前

// 締日以内のテストデータ（警告が表示されないベースライン）
const BASE_TASK_DATA = {
  id: 'test-id-preservation',
  property_number: 'AA002',
  property_address: '大分市中央町2-2-2',
  seller_name: 'テスト売主2',
  spreadsheet_url: '',
  sales_assignee: 'K',
  mediation_type: '',
  mediation_deadline: '',
  mediation_completed: '',
  mediation_creator: '',
  mediation_notes: '',
  on_hold: '',
  site_registration_deadline: SITE_REGISTRATION_DEADLINE, // 締日
  site_registration_request_date: '',
  site_registration_due_date: WITHIN_DEADLINE_DATE,       // 締日以内（警告なし）
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
  floor_plan_due_date: WITHIN_DEADLINE_DATE,              // 締日以内（警告なし）
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
function setupApiMock(taskData = BASE_TASK_DATA) {
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/api/work-tasks/')) {
      return Promise.resolve({ data: taskData });
    }
    if (url.includes('/api/employees/normal-initials')) {
      return Promise.resolve({ data: { initials: ['K', 'Y', 'I'] } });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('WorkTaskDetailModal - 保全プロパティテスト（handleFieldChange 経由の日付変更時の警告表示）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMock();
  });

  /**
   * テストケース1: site_registration_due_date に締日超過の日付を入力 → 警告が表示される
   *
   * 観察1: site_registration_due_date に締日超過の日付を入力 → warningDialog.open = true
   *
   * handleFieldChange('site_registration_due_date', '2025-08-10T12:00') が呼ばれると、
   * isDeadlineExceeded('2025-08-10T12:00', '2025-08-05') = true となり、
   * setWarningDialog({ open: true, fieldLabel: 'サイト登録納期予定日' }) が呼ばれる。
   *
   * EXPECTED: PASS（修正前・修正後ともに）
   *
   * **Validates: Requirements 3.1**
   */
  test('保全ケース1: site_registration_due_date に締日超過の日付を入力すると警告ダイアログが表示される', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA002"
            initialData={BASE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // バックグラウンドfetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA002');
    });

    // 初期状態では警告ダイアログが表示されていないことを確認
    // （締日以内のデータなので、バグがあっても警告は出ない）
    expect(document.body.textContent).not.toContain('締日超過の警告');

    // サイト登録タブに切り替え（タブインデックス1）
    const tabs = screen.getAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[1]); // サイト登録タブ
    });

    // datetime-local 入力フィールドを探して締日超過の日付を入力
    // サイト登録納期予定日フィールドを探す
    const datetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect(datetimeInputs.length).toBeGreaterThan(0);

    // 最初の datetime-local フィールドに締日超過の日付を入力
    const siteDueDateInput = datetimeInputs[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(siteDueDateInput, { target: { value: OVERDUE_DATE } });
    });

    // 警告ダイアログが表示されることを確認
    await waitFor(() => {
      expect(document.body.textContent).toContain('締日超過の警告');
    });
  });

  /**
   * テストケース2: floor_plan_due_date に締日超過の日付を入力 → 警告が表示される
   *
   * 観察2: floor_plan_due_date に締日超過の日付を入力 → warningDialog.open = true
   *
   * handleFieldChange('floor_plan_due_date', '2025-08-10T12:00') が呼ばれると、
   * isDeadlineExceeded('2025-08-10T12:00', '2025-08-05') = true となり、
   * setWarningDialog({ open: true, fieldLabel: '間取図完了予定' }) が呼ばれる。
   *
   * EXPECTED: PASS（修正前・修正後ともに）
   *
   * **Validates: Requirements 3.2**
   */
  test('保全ケース2: floor_plan_due_date に締日超過の日付を入力すると警告ダイアログが表示される', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA002"
            initialData={BASE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // バックグラウンドfetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA002');
    });

    // 初期状態では警告ダイアログが表示されていないことを確認
    expect(document.body.textContent).not.toContain('締日超過の警告');

    // サイト登録タブに切り替え
    const tabs = screen.getAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[1]); // サイト登録タブ
    });

    // datetime-local 入力フィールドを取得
    const datetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect(datetimeInputs.length).toBeGreaterThanOrEqual(2);

    // 2番目の datetime-local フィールド（間取図完了予定）に締日超過の日付を入力
    const floorPlanDueDateInput = datetimeInputs[1] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(floorPlanDueDateInput, { target: { value: OVERDUE_DATE } });
    });

    // 警告ダイアログが表示されることを確認
    await waitFor(() => {
      expect(document.body.textContent).toContain('締日超過の警告');
    });
  });

  /**
   * テストケース3: 締日以内の日付を入力 → 警告が表示されない
   *
   * 観察3: 締日以内の日付を入力 → warningDialog.open = false のまま
   *
   * handleFieldChange('site_registration_due_date', '2025-08-04T12:00') が呼ばれると、
   * isDeadlineExceeded('2025-08-04T12:00', '2025-08-05') = false となり、
   * setWarningDialog は呼ばれない。
   *
   * EXPECTED: PASS（修正前・修正後ともに）
   *
   * **Validates: Requirements 3.3**
   */
  test('保全ケース3: 締日以内の日付を入力しても警告ダイアログが表示されない', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA002"
            initialData={BASE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // バックグラウンドfetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA002');
    });

    // サイト登録タブに切り替え
    const tabs = screen.getAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[1]); // サイト登録タブ
    });

    // datetime-local 入力フィールドを取得
    const datetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect(datetimeInputs.length).toBeGreaterThan(0);

    // 締日以内の日付を入力
    const siteDueDateInput = datetimeInputs[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(siteDueDateInput, { target: { value: WITHIN_DEADLINE_DATE } });
    });

    // 警告ダイアログが表示されないことを確認
    expect(document.body.textContent).not.toContain('締日超過の警告');
  });

  /**
   * テストケース4: 警告ポップアップの「確認しました」ボタンで閉じられる
   *
   * 観察4: 警告ポップアップの「確認しました」ボタンで warningDialog.open = false になる
   *
   * 警告ダイアログが表示された後、「確認しました」ボタンをクリックすると
   * onClose が呼ばれ、warningDialog.open = false になる。
   *
   * EXPECTED: PASS（修正前・修正後ともに）
   *
   * **Validates: Requirements 3.4**
   */
  test('保全ケース4: 警告ポップアップの「確認しました」ボタンでダイアログが閉じられる', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <WorkTaskDetailModal
            open={true}
            onClose={() => {}}
            propertyNumber="AA002"
            initialData={BASE_TASK_DATA}
          />
        </MemoryRouter>
      );
    });

    // バックグラウンドfetchData の完了を待つ
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/work-tasks/AA002');
    });

    // サイト登録タブに切り替え
    const tabs = screen.getAllByRole('tab');
    await act(async () => {
      fireEvent.click(tabs[1]); // サイト登録タブ
    });

    // datetime-local 入力フィールドを取得して締日超過の日付を入力
    const datetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect(datetimeInputs.length).toBeGreaterThan(0);

    const siteDueDateInput = datetimeInputs[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(siteDueDateInput, { target: { value: OVERDUE_DATE } });
    });

    // 警告ダイアログが表示されることを確認
    await waitFor(() => {
      expect(document.body.textContent).toContain('締日超過の警告');
    });

    // 「確認しました」ボタンをクリック
    const confirmButton = screen.getByRole('button', { name: '確認しました' });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // 警告ダイアログが閉じられることを確認
    await waitFor(() => {
      expect(document.body.textContent).not.toContain('締日超過の警告');
    });
  });
});
