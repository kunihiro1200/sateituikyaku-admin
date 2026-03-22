/**
 * 買主ステータス定義
 *
 * AppSheetのIFSロジックと同一の優先順位でステータスを定義します。
 * 優先順位が小さいほど優先度が高く、最初に一致した条件のステータスが採用されます。
 */

export interface StatusDefinition {
  priority: number;
  status: string;
  description: string;
  color: string;
}

export const STATUS_DEFINITIONS: StatusDefinition[] = [
  { priority: 1, status: '査定アンケート回答あり', description: '査定アンケートに回答があり、確認が未完了', color: '#1b5e20' },
  { priority: 2, status: '業者問合せあり', description: '業者向けアンケートが未回答', color: '#2e7d32' },
  { priority: 3, status: '内覧日前日', description: '内覧日の前日（木曜日は2日前）', color: '#388e3c' },
  { priority: 4, status: '内覧未確定', description: '内覧日が未確定', color: '#43a047' },
  { priority: 5, status: '問合メール未対応', description: '問い合わせメールへの対応が未完了', color: '#43a047' },
  { priority: 6, status: '当日TEL', description: '次電日が当日以前', color: '#388e3c' },
  { priority: 7, status: '3回架電未', description: '3回架電が未完了', color: '#4caf50' },
  { priority: 8, status: '一般媒介_内覧後売主連絡未', description: '一般媒介で内覧後の売主連絡が未完了', color: '#2e7d32' },
  { priority: 9, status: 'Y_内覧後未入力', description: '担当Y: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 10, status: '生_内覧後未入力', description: '担当生: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 11, status: 'U_内覧後未入力', description: '担当U: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 12, status: '久_内覧後未入力', description: '担当久: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 13, status: 'K_内覧後未入力', description: '担当K: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 14, status: 'I_内覧後未入力', description: '担当I: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 15, status: 'R_内覧後未入力', description: '担当R: 内覧後の入力が未完了', color: '#66bb6a' },
  { priority: 16, status: '担当(Y)次電日空欄', description: '担当Y: 次電日が空欄', color: '#a5d6a7' },
  { priority: 17, status: '担当(久)次電日空欄', description: '担当久: 次電日が空欄', color: '#a5d6a7' },
  { priority: 18, status: '担当(U)次電日空欄', description: '担当U: 次電日が空欄', color: '#a5d6a7' },
  { priority: 19, status: '担当(R)次電日空欄', description: '担当R: 次電日が空欄', color: '#a5d6a7' },
  { priority: 20, status: '担当(K)次電日空欄', description: '担当K: 次電日が空欄', color: '#a5d6a7' },
  { priority: 21, status: '担当(I)次電日空欄', description: '担当I: 次電日が空欄', color: '#a5d6a7' },
  { priority: 22, status: '担当(生)次電日空欄', description: '担当生: 次電日が空欄', color: '#a5d6a7' },
  { priority: 23, status: '担当(Y)', description: '担当Y', color: '#4caf50' },
  { priority: 24, status: '担当(W)', description: '担当W', color: '#4caf50' },
  { priority: 25, status: '担当(U)', description: '担当U', color: '#4caf50' },
  { priority: 26, status: '担当(生)', description: '担当生', color: '#4caf50' },
  { priority: 27, status: '担当(K)', description: '担当K', color: '#4caf50' },
  { priority: 28, status: '担当(久)', description: '担当久', color: '#4caf50' },
  { priority: 29, status: '担当(I)', description: '担当I', color: '#4caf50' },
  { priority: 30, status: '担当(R)', description: '担当R', color: '#4caf50' },
  { priority: 31, status: 'ピンリッチ未登録', description: 'ピンリッチに未登録', color: '#81c784' },
  { priority: 32, status: '内覧促進メール（Pinrich)', description: '内覧促進メール送信対象（Pinrich）', color: '#a5d6a7' },
  { priority: 16.5, status: '要内覧促進客', description: '内覧促進が必要な顧客', color: '#c8e6c9' },
  { priority: 34, status: '買付有り、物件不適合の内覧促進客', description: '買付有りだが物件不適合の内覧促進対象', color: '#e8f5e9' },
  { priority: 35, status: 'メアド確認必要', description: 'メールアドレスの確認が必要', color: '#388e3c' },
  { priority: 0, status: '', description: '該当なし', color: '#9E9E9E' },
];

export function getStatusColor(status: string): string {
  const definition = STATUS_DEFINITIONS.find(d => d.status === status);
  if (definition) return definition.color;
  // 当日TEL（Y）のような動的ステータスは 当日TEL の色を使用
  if (status.startsWith('当日TEL')) {
    const base = STATUS_DEFINITIONS.find(d => d.status === '当日TEL');
    if (base) return base.color;
  }
  return '#cccccc';
}

export function getStatusDescription(status: string): string {
  const definition = STATUS_DEFINITIONS.find(d => d.status === status);
  return definition?.description || '該当なし';
}

export function getStatusPriority(status: string): number {
  const definition = STATUS_DEFINITIONS.find(d => d.status === status);
  return definition?.priority || 0;
}
