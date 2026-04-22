/** 台帳シートのgid（全案件共通の固定値） */
export const LEDGER_SHEET_GID = '78322744';

/** 媒介依頼シートのgid */
export const MEDIATION_REQUEST_SHEET_GID = '1819926492';

/** athomeシートのgid */
export const ATHOME_SHEET_GID = '1725934947';

/**
 * spreadsheet_url から指定したgidのシートへの遷移URLを生成する汎用関数。
 */
export function buildSheetUrl(spreadsheetUrl: string, gid: string): string {
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
    return `${url.origin}${basePath}${search}#gid=${gid}`;
  } catch {
    return spreadsheetUrl;
  }
}

/**
 * spreadsheet_url から台帳シートへの遷移URLを生成する。
 */
export function buildLedgerSheetUrl(spreadsheetUrl: string): string {
  return buildSheetUrl(spreadsheetUrl, LEDGER_SHEET_GID);
}
