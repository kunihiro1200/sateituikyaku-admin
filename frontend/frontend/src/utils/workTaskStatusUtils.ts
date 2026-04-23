// 業務タスクのステータス計算ユーティリティ
// スプレッドシートのIFS式をTypeScriptに変換

export interface WorkTask {
  id: string;
  property_number: string;
  property_address: string;
  seller_name: string;
  sales_assignee: string;
  property_type: string;
  mediation_type: string;
  mediation_deadline: string;
  mediation_completed: string;
  mediation_notes: string;
  sales_contract_confirmed: string;
  sales_contract_deadline: string;
  binding_scheduled_date: string;
  binding_completed: string;
  on_hold: string;
  settlement_date: string;
  hirose_request_sales: string;
  cw_request_sales: string;
  employee_contract_creation: string;
  accounting_confirmed: string;
  cw_completed_email_sales: string;
  work_completed_chat_hirose: string;
  sales_contract_assignee: string;
  site_registration_requestor: string;
  cw_request_email_site: string;
  distribution_date: string;
  publish_scheduled_date: string;
  site_registration_deadline: string;
  site_registration_due_date: string;
  settlement_completed_chat: string;
  ledger_created: string;
  site_registration_confirm_request_date: string;
  site_registration_confirmed: string;
  // property_listingsから参照（サイドバーカテゴリー判定用）
  sales_contract_completed?: string;
  // DB専用フィールド（スプシ非同期）
  judicial_scrivener_email_after_contract?: string;
  settlement_seller_denomination_email?: string;
  settlement_buyer_denomination_email?: string;
  [key: string]: any;
}

export interface StatusCategory {
  key: string;
  label: string;
  count: number;
  deadline?: string;
  siteDeadline?: string;
  isDeadlinePast?: boolean;
  isDeadlineTomorrow?: boolean;
  isUrgent?: boolean; // 赤字表示（契約後司法書士連絡未・金種表送付未）
  filter: (task: WorkTask) => boolean;
}

// 日付ヘルパー関数
const isNotBlank = (value: any): boolean => {
  return value !== null && value !== undefined && value !== '';
};

const isBlank = (value: any): boolean => {
  return !isNotBlank(value);
};

const parseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const formatDateMD = (dateStr: string | null | undefined): string => {
  const d = parseDate(dateStr);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const today = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateGte = (dateStr: string | null | undefined, compareDate: Date): boolean => {
  const d = parseDate(dateStr);
  if (!d) return false;
  d.setHours(0, 0, 0, 0);
  return d >= compareDate;
};

const dateLte = (dateStr: string | null | undefined, compareDate: Date): boolean => {
  const d = parseDate(dateStr);
  if (!d) return false;
  d.setHours(0, 0, 0, 0);
  return d <= compareDate;
};

const dateLt = (dateStr: string | null | undefined, compareDate: Date): boolean => {
  const d = parseDate(dateStr);
  if (!d) return false;
  d.setHours(0, 0, 0, 0);
  return d < compareDate;
};

// 2025-05-26 基準日
const BASE_DATE = new Date('2025-05-26');
// 2025-10-30 基準日
const SITE_REG_BASE_DATE = new Date('2025-10-30');

// ステータス計算関数
export const calculateTaskStatus = (task: WorkTask): string => {
  // 0a. 契約後司法書士連絡未
  // property_listingsのsales_contract_completedが"契約完了～"で始まり、
  // judicial_scrivener_email_after_contractが空で、決済日が2026/4/30以降の場合
  const JUDICIAL_BASE_DATE = new Date('2026-04-30');
  if (
    task.sales_contract_completed &&
    task.sales_contract_completed.startsWith('契約完了') &&
    isBlank(task.judicial_scrivener_email_after_contract) &&
    dateGte(task.settlement_date, JUDICIAL_BASE_DATE)
  ) {
    return '契約後司法書士連絡未';
  }

  // 0b. 金種表送付　未
  // settlement_dateに値があり（2026/4/30以降）、今日がsettlement_dateの1週間前以降で、
  // settlement_seller_denomination_email と settlement_buyer_denomination_email が両方空の場合
  const DENOMINATION_BASE_DATE = new Date('2026-04-30');
  if (
    isNotBlank(task.settlement_date) &&
    isNotBlank(task.sales_contract_deadline) &&
    dateGte(task.settlement_date, DENOMINATION_BASE_DATE)
  ) {
    const settlementD = parseDate(task.settlement_date);
    if (settlementD) {
      const oneWeekBefore = new Date(settlementD);
      oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
      oneWeekBefore.setHours(0, 0, 0, 0);
      if (
        today() >= oneWeekBefore &&
        isBlank(task.settlement_seller_denomination_email) &&
        isBlank(task.settlement_buyer_denomination_email)
      ) {
        return '金種表送付　未';
      }
    }
  }

  // 1. 売買契約確認 = "確認中"
  if (task.sales_contract_confirmed === '確認中') {
    return `売買契約　営業確認中${formatDateMD(task.sales_contract_deadline)}`;
  }

  // 2. 売買契約 入力待ち
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isBlank(task.binding_scheduled_date) &&
    isBlank(task.on_hold) &&
    isBlank(task.binding_completed) &&
    (isBlank(task.settlement_date) || dateGte(task.settlement_date, today())) &&
    (isNotBlank(task.hirose_request_sales) || isNotBlank(task.cw_request_sales) || isNotBlank(task.employee_contract_creation)) &&
    isBlank(task.accounting_confirmed) &&
    (isBlank(task.cw_completed_email_sales) || isBlank(task.work_completed_chat_hirose))
  ) {
    return `売買契約 入力待ち ${formatDateMD(task.sales_contract_deadline)} ${task.sales_contract_assignee || ''}`;
  }

  // 3. サイト登録依頼してください
  if (
    isBlank(task.site_registration_requestor) &&
    isBlank(task.cw_request_email_site) &&
    isBlank(task.on_hold) &&
    isBlank(task.distribution_date) &&
    isBlank(task.publish_scheduled_date) &&
    isNotBlank(task.site_registration_deadline) &&
    isBlank(task.sales_contract_deadline)
  ) {
    return `サイト登録依頼してください ${formatDateMD(task.site_registration_deadline)}`;
  }

  // 4. 決済完了チャット送信未
  if (
    dateLte(task.settlement_date, today()) &&
    dateGte(task.settlement_date, BASE_DATE) &&
    isNotBlank(task.settlement_date) &&
    isBlank(task.settlement_completed_chat) &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '決済完了チャット送信未';
  }

  // 5. 経理確認未
  if (
    isNotBlank(task.settlement_completed_chat) &&
    (isBlank(task.accounting_confirmed) || task.accounting_confirmed === '未') &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '経理確認未';
  }

  // 6. 要台帳作成
  if (
    isBlank(task.ledger_created) &&
    isBlank(task.on_hold) &&
    isNotBlank(task.settlement_date) &&
    dateLt(task.settlement_date, today()) &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '要台帳作成';
  }

  // 7. 売買契約 製本待ち
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isNotBlank(task.binding_scheduled_date) &&
    task.sales_contract_confirmed === '確認OK' &&
    isBlank(task.on_hold) &&
    isBlank(task.binding_completed)
  ) {
    return `売買契約 製本待ち ${formatDateMD(task.binding_scheduled_date)} ${task.sales_contract_assignee || ''}`;
  }

  // 8. 売買契約 依頼未
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isBlank(task.binding_scheduled_date) &&
    isBlank(task.binding_completed) &&
    (isBlank(task.settlement_date) || dateGte(task.settlement_date, today())) &&
    isBlank(task.accounting_confirmed) &&
    isBlank(task.on_hold) &&
    isBlank(task.hirose_request_sales) &&
    isBlank(task.cw_request_sales)
  ) {
    return `売買契約 依頼未 締日${formatDateMD(task.sales_contract_deadline)} ${task.sales_contract_assignee || ''}`;
  }

  // 9. サイト依頼済み納品待ち
  if (
    isBlank(task.site_registration_confirm_request_date) &&
    isBlank(task.sales_contract_deadline) &&
    isNotBlank(task.site_registration_deadline) &&
    task.site_registration_confirmed !== '完了' &&
    dateGte(task.site_registration_deadline, SITE_REG_BASE_DATE)
  ) {
    const dueDate = formatDateMD(task.site_registration_due_date);
    const deadline = formatDateMD(task.site_registration_deadline);
    const displayDate = dueDate || deadline;
    return displayDate
      ? `サイト依頼済み納品待ち ${displayDate}`
      : 'サイト依頼済み納品待ち';
  }

  // 10. サイト登録要確認
  if (
    isNotBlank(task.site_registration_confirm_request_date) &&
    isBlank(task.site_registration_confirmed)
  ) {
    return `サイト登録要確認 ${formatDateMD(task.site_registration_deadline)}`;
  }

  // 11. 媒介作成_締日
  if (
    isBlank(task.mediation_completed) &&
    isNotBlank(task.mediation_deadline) &&
    isBlank(task.distribution_date) &&
    isBlank(task.sales_contract_deadline) &&
    isBlank(task.on_hold)
  ) {
    return `媒介作成_締日（${formatDateMD(task.mediation_deadline)}`;
  }

  // 12. 保留
  if (isNotBlank(task.on_hold)) {
    return '保留';
  }

  // デフォルト: 空
  return '';
};

// カテゴリグループの背景色マッピング（プレフィックス → 背景色）
const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['媒介作成_締日',              '#e8f5e9'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち',     '#f3e5f5'],
  ['サイト登録要確認',           '#f3e5f5'],
  ['契約後司法書士連絡未',       '#ffebee'],
  ['金種表送付　未',             '#ffebee'],
  ['売買契約 依頼未',            '#e3f2fd'],
  ['売買契約　営業確認中',       '#e3f2fd'],
  ['売買契約 入力待ち',          '#e3f2fd'],
  ['売買契約 製本待ち',          '#e3f2fd'],
  ['要台帳作成',                 '#fce4ec'],
  ['決済完了チャット送信未',     '#fff8e1'],
  ['経理確認未',                 '#fff8e1'],
  ['保留',                       '#f5f5f5'],
];

// カテゴリプレフィックスから背景色を返す関数
export const getCategoryGroupColor = (label: string): string | undefined => {
  if (label === 'All') return undefined;
  for (const [prefix, color] of CATEGORY_GROUP_COLORS) {
    if (label.startsWith(prefix)) return color;
  }
  return undefined;
};

// カテゴリの優先順位（ステータスのプレフィックスで判定）
const CATEGORY_ORDER = [
  '媒介作成_締日',
  'サイト登録依頼してください',
  'サイト依頼済み納品待ち',
  'サイト登録要確認',
  '契約後司法書士連絡未',
  '金種表送付　未',
  '売買契約 依頼未',
  '売買契約　営業確認中',
  '売買契約 入力待ち',
  '売買契約 製本待ち',
  '要台帳作成',
  '決済完了チャット送信未',
  '経理確認未',
  '保留',
];

const getCategoryOrder = (status: string): number => {
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    if (status.startsWith(CATEGORY_ORDER[i])) return i;
  }
  return CATEGORY_ORDER.length;
};

// ステータスカテゴリ定義（締切日ごとに分割）
export const getStatusCategories = (tasks: WorkTask[]): StatusCategory[] => {
  // ステータス文字列ごとにカウント（日付・担当者込みで完全一致グループ化）
  const statusCounts: Record<string, number> = {};
  // サイト依頼済み納品待ちの締め日（site_registration_deadline）を収集
  const siteDeadlines: Record<string, string> = {};

  tasks.forEach(task => {
    const status = calculateTaskStatus(task);
    if (status) {
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      // サイト依頼済み納品待ちの場合、site_registration_deadlineを記録
      if (status.startsWith('サイト依頼済み納品待ち') && task.site_registration_deadline) {
        const d = new Date(task.site_registration_deadline);
        if (!isNaN(d.getTime())) {
          siteDeadlines[status] = `${d.getMonth() + 1}/${d.getDate()}`;
        }
      }
    }
  });

  // ステータス文字列を優先順位・日付順でソート
  const sortedStatuses = Object.keys(statusCounts).sort((a, b) => {
    const orderA = getCategoryOrder(a);
    const orderB = getCategoryOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    // 同じカテゴリ内は文字列順（日付が含まれるので自然にソートされる）
    return a.localeCompare(b, 'ja');
  });

  const categories: StatusCategory[] = [
    {
      key: 'all',
      label: 'All',
      count: tasks.length,
      filter: () => true,
    },
  ];

  sortedStatuses.forEach(status => {
    const count = statusCounts[status];
    // キーはステータス文字列をそのまま使用（URLセーフにエンコード）
    const key = `status:${status}`;

    // 期日が過去かどうかを判定（ステータス文字列から日付を抽出）
    const dateMatch = status.match(/(\d{1,2})\/(\d{1,2})/);
    let isDeadlinePast = false;
    let isDeadlineTomorrow = false;
    let deadlineStr: string | undefined;
    if (dateMatch) {
      deadlineStr = `${dateMatch[1]}/${dateMatch[2]}`;
      const year = new Date().getFullYear();
      const deadlineDate = new Date(year, parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
      deadlineDate.setHours(0, 0, 0, 0);
      isDeadlinePast = deadlineDate <= today();
      // 翌日判定
      const tomorrow = new Date(today());
      tomorrow.setDate(tomorrow.getDate() + 1);
      isDeadlineTomorrow = deadlineDate.getTime() === tomorrow.getTime();
    }

    const isUrgent = status === '契約後司法書士連絡未' || status === '金種表送付　未';

    categories.push({
      key,
      label: status,
      count,
      deadline: deadlineStr,
      siteDeadline: siteDeadlines[status],
      isDeadlinePast,
      isDeadlineTomorrow,
      isUrgent,
      filter: (task: WorkTask) => calculateTaskStatus(task) === status,
    });
  });

  return categories;
};

// ステータス文字列からキーを抽出
const getStatusKey = (status: string): string => {
  if (!status) return '';
  if (status.startsWith('売買契約　営業確認中')) return 'sales_contract_confirm';
  if (status.startsWith('売買契約 入力待ち')) return 'sales_contract_input';
  if (status.startsWith('サイト登録依頼してください')) return 'site_registration_request';
  if (status.startsWith('決済完了チャット送信未')) return 'settlement_chat_pending';
  if (status.startsWith('経理確認未')) return 'payment_pending';
  if (status.startsWith('要台帳作成')) return 'ledger_required';
  if (status.startsWith('売買契約 製本待ち')) return 'sales_contract_binding';
  if (status.startsWith('売買契約 依頼未')) return 'sales_contract_unrequested';
  if (status.startsWith('サイト依頼済み納品待ち')) return 'site_delivery_pending';
  if (status.startsWith('サイト登録要確認')) return 'site_registration_check';
  if (status.startsWith('媒介作成_締日')) return 'mediation_deadline';
  if (status === '保留') return 'on_hold';
  return '';
};

// タスクをステータスでフィルタリング
export const filterTasksByStatus = (tasks: WorkTask[], statusKey: string): WorkTask[] => {
  if (statusKey === 'all') return tasks;

  // 新形式: "status:ステータス文字列"
  if (statusKey.startsWith('status:')) {
    const targetStatus = statusKey.slice('status:'.length);
    return tasks.filter(task => calculateTaskStatus(task) === targetStatus);
  }

  // 旧形式との後方互換（念のため残す）
  return tasks.filter(task => {
    const status = calculateTaskStatus(task);
    const taskStatusKey = getStatusKey(status);
    return taskStatusKey === statusKey;
  });
};
