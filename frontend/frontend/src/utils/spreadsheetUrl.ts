/** 台帳シートのgid（全案件共通の固定値） */
export const LEDGER_SHEET_GID = '78322744';

/**
 * spreadsheet_url から台帳シートへの遷移URLを生成する。
 * - ?gid=... クエリパラメータを除去
 * - #gid=... ハッシュを除去
 * - /edit で終わるベースURLを確保
 * - #gid=78322744 を付加
 * - URL解析失敗時は元の文字列をそのまま返す（try-catch）
 */
export function buildLedgerSheetUrl(spreadsheetUrl: string): string {
  try {
    const withoutHash = spreadsheetUrl.split('#')[0];
    const url = new URL(withoutHash);
    url.searchParams.delete('gid');
    let basePath = url.pathname;
    if (!basePath.endsWith('/edit')) {
      const editIndex = basePath.indexOf('/edit');
      if (editIndex !== -1) {
        basePath = basePath.substring(0, editIndex + 5);
      }
    }
    const search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    return `${url.origin}${basePath}${search}#gid=${LEDGER_SHEET_GID}`;
  } catch {
    return spreadsheetUrl;
  }
}
