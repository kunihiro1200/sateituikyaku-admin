/**
 * 締日超過チェックユーティリティ
 */

/**
 * 納期予定日がサイト登録締日を超過しているか判定する純粋関数
 * @param dueDate - datetime-local 形式の文字列（例: "2025-08-10T12:00"）または null/undefined
 * @param deadline - date 形式の文字列（例: "2025-08-05"）または null/undefined
 * @returns 超過している場合 true、それ以外（無効値含む）は false
 */
export function isDeadlineExceeded(
  dueDate: string | null | undefined,
  deadline: string | null | undefined
): boolean {
  // dueDate または deadline が空・null・undefined の場合は false
  if (!dueDate || !deadline) return false;

  // dueDate の日付部分（T 以前の YYYY-MM-DD）を抽出
  const dueDateOnly = dueDate.split('T')[0];

  // Date オブジェクトに変換してパース失敗チェック
  const dueDateObj = new Date(dueDateOnly);
  const deadlineObj = new Date(deadline);

  if (isNaN(dueDateObj.getTime()) || isNaN(deadlineObj.getTime())) return false;

  // 日付部分の文字列比較（同日は false、超過のみ true）
  return dueDateOnly > deadline;
}
