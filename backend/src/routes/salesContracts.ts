/**
 * 売上契約管理API
 * Google スプレッドシートから売買契約情報を取得する
 *
 * スプレッドシートID: 1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M
 * 大分シート gid: 534678762
 * 福岡シート gid: 1585036738 (シート名: 売買売上表 （福岡）)
 *
 * 列構成（両シート共通）:
 *   A列: 物件番号  B列: 決済予定月  C列: 決済確定日  D列: 担当  I列: 仲介手数料
 */

import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { authenticate } from '../middleware/auth';

const SPREADSHEET_ID = '1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M';
const SHEET_GID_OITA    = 534678762;    // 大分シート
const SHEET_GID_FUKUOKA = 1585036738;  // 福岡シート

// ============================================================
// 型
// ============================================================

export interface ContractRecord {
  property_number: string;
  settlement_month: string | null;  // YYYY-MM
  settlement_date: string | null;   // YYYY-MM-DD
  staff: string;
  commission: number;               // 円（税込）
  property_name: string;            // E列：物件名
  contract_type: string;            // M列：契約形態
  category: 'actual' | 'contracted';
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * B列の決済予定月（数字 or 文字列）→ YYYY-MM 形式に変換
 * 今日の日付を基準に、すでに過ぎた月は今年、まだ来ていない月は来年として判定
 * 例: 今日=2026/10 → 9(9月)はすでに過ぎた→2026-09、2(2月)はまだ→2027-02
 */
function parseSettlementMonth(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;

  // 年月が明示されている場合（例: "2027年3月", "2027/03"）
  const fullMatch = raw.match(/(\d{4})[年/\-](\d{1,2})/);
  if (fullMatch) {
    const y = parseInt(fullMatch[1]);
    const m = parseInt(fullMatch[2]);
    if (y >= 2025 && y <= 2030 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // 月のみの場合（例: "10", "3月"）
  const monthOnly = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (isNaN(monthOnly) || monthOnly < 1 || monthOnly > 12) return null;

  // 今日の年月を取得
  const today = new Date();
  const curYear = today.getFullYear();  // 例: 2026
  const curMonth = today.getMonth() + 1; // 例: 10

  // すでに過ぎた月 → 今年
  if (monthOnly < curMonth) {
    return `${curYear}-${String(monthOnly).padStart(2, '0')}`;
    // 例: 9 < 10(今月) → "2026-09" → FYフィルタで除外される
  }

  // 今月以降
  if (monthOnly >= 10) {
    return `${curYear}-${String(monthOnly).padStart(2, '0')}`;
    // 例: 10,11,12 → "2026-10","2026-11","2026-12"（FY内）
  } else {
    // 1〜9月で今月以降 → 来年
    return `${curYear + 1}-${String(monthOnly).padStart(2, '0')}`;
    // 例: 2,3 → "2027-02","2027-03"（FY内）
  }
}

/**
 * C列の決済確定日をパース
 * - Google Sheets シリアル値（例: 46150）に対応
 * - "2026/10/20", "2026-10-20" 等の文字列形式にも対応
 */
function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null;
  const str = raw.trim();

  // Google Sheets シリアル値の検出（現代の日付は概ね 40000〜60000 の整数）
  const serial = parseInt(str, 10);
  if (!isNaN(serial) && serial > 40000 && serial < 60000 && str === String(serial)) {
    // Google Sheets の epoch: 1899年12月30日
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 24 * 60 * 60 * 1000);
  }

  // 文字列形式 (2026/10/20, 2026-10-20, 2026年10月20日 等)
  const cleaned = str
    .replace(/\//g, '-')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .trim();
  if (!/\d{4}/.test(cleaned)) return null;
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 仲介手数料をパース（万円→円 変換を含む）
 * - UNFORMATTED_VALUE で取得した数値（例: 2178000）もそのまま扱う
 * - 1000 未満の値は万円単位とみなして×10000する
 */
function parseCommission(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  const str = raw.trim();

  // 明示的に "万円" がある場合
  if (str.includes('万')) {
    const n = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n * 10_000);
  }

  // カンマ区切り等を除去して数値化
  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return 0;

  // 1000 未満は万円単位と判断
  return n < 1000 ? Math.round(n * 10_000) : Math.round(n);
}

function getYYYYMM(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================
// ルート
// ============================================================

const router = Router();

/**
 * GET /api/sales/contracts
 * スプレッドシートから売買契約情報を取得して返す
 * ?store=fukuoka で福岡シートを使用
 * ?include_prev=true で前期（前FY）の決済済み物件も含める
 */
router.get('/contracts', authenticate, async (req: Request, res: Response) => {
  try {
    const isFukuoka = req.query.store === 'fukuoka';
    const includePrev = req.query.include_prev === 'true';
    const sheetGid = isFukuoka ? SHEET_GID_FUKUOKA : SHEET_GID_OITA;

    // FY範囲（include_prev=true の場合は前期も含める）
    const FY_START = '2026-10';
    const FY_END = '2027-09';
    const PREV_FY_START = '2025-10';
    const PREV_FY_END = '2026-09';
    const rangeStart = includePrev ? PREV_FY_START : FY_START;
    const rangeEnd = FY_END;

    // ─── Google 認証 ───────────────────────────────────────
    let auth: any;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      // Base64 エンコードされている場合はデコード
      if (!jsonStr.startsWith('{')) {
        jsonStr = Buffer.from(jsonStr, 'base64').toString('utf-8');
      }
      const sa = JSON.parse(jsonStr);
      auth = new google.auth.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      return res.status(500).json({ error: 'Google認証情報が設定されていません' });
    }

    await (auth as any).authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // ─── シート名をメタデータから取得 ─────────────────────
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetMeta = meta.data.sheets?.find(
      (s) => s.properties?.sheetId === sheetGid
    );
    const sheetName = sheetMeta?.properties?.title;

    if (!sheetName) {
      return res.status(404).json({
        error: `シートID ${sheetGid} が見つかりません。スプレッドシートが正しく共有されているか確認してください。`,
      });
    }

    // ─── A〜M列を一括取得（E列:物件名、M列:契約形態を追加） ──
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:M`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows: any[][] = response.data.values ?? [];
    if (rows.length <= 1) {
      return res.json({ contracts: [], sheetName });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const contracts: ContractRecord[] = [];

    // ヘッダー行（1行目）をスキップ
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const propertyNumber = String(row[0] ?? '').trim();
      const settlementMonthRaw = String(row[1] ?? '').trim();   // B列
      const settlementDateRaw = String(row[2] ?? '').trim();    // C列
      const staff = String(row[3] ?? '').trim();                // D列
      const propertyName = String(row[4] ?? '').trim();         // E列：物件名
      const commissionRaw = String(row[8] ?? '').trim();        // I列
      const contractType = String(row[12] ?? '').trim();        // M列：契約形態

      // 物件番号なし → スキップ
      if (!propertyNumber) continue;

      // 店舗フィルタ：大分=FI除外、福岡=FI含む
      const isFI = propertyNumber.toUpperCase().includes('FI');
      if (isFukuoka && !isFI) continue;  // 福岡シートなのにFIなし → スキップ
      if (!isFukuoka && isFI) continue;  // 大分シートなのにFI → スキップ

      const commission = parseCommission(commissionRaw);
      const settlementDate = parseDate(settlementDateRaw);

      let settlementMonth: string | null = null;
      let category: 'actual' | 'contracted';

      if (settlementDate) {
        settlementMonth = getYYYYMM(settlementDate);
        // C列に日付あり → 過去なら実績、未来なら契約済み決済前
        category = settlementDate <= today ? 'actual' : 'contracted';
      } else {
        // C列なし → B列の予定月を使用
        settlementMonth = parseSettlementMonth(settlementMonthRaw);
        if (!settlementMonth) continue; // 月も不明ならスキップ
        category = 'contracted';
      }

      // FY範囲フィルタ（include_prev=true なら前期も含める）
      if (!settlementMonth || settlementMonth < rangeStart || settlementMonth > rangeEnd) {
        continue;
      }

      contracts.push({
        property_number: propertyNumber,
        settlement_month: settlementMonth,
        settlement_date: settlementDate
          ? settlementDate.toISOString().substring(0, 10)
          : null,
        staff,
        commission,
        property_name: propertyName,
        contract_type: contractType,
        category,
      });
    }

    return res.json({ contracts, sheetName });
  } catch (err: any) {
    console.error('[salesContracts] エラー:', err);
    return res.status(500).json({
      error: 'スプレッドシートの読み込みに失敗しました',
      detail: err?.message ?? String(err),
    });
  }
});

export default router;
