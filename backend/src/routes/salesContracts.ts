/**
 * 売上契約管理API
 * Google スプレッドシートから売買契約情報を取得する
 *
 * 読み取るスプレッドシート: 1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M (シートgid: 534678762)
 *
 * 列構成:
 *   A列: 物件番号
 *   B列: 決済予定月 (例: "10" = その年の10月)
 *   C列: 決済確定日 (実際の決済日 / 空なら未決済)
 *   D列: 担当
 *   I列: 仲介手数料
 *
 * カテゴリ判定:
 *   - C列 ≤ 今日  → 'actual'     (決済済み実績)
 *   - C列 > 今日  → 'contracted' (決済日確定済み・未決済)
 *   - C列 なし + B列あり → 'contracted' (売買契約済み・決済予定)
 *   - FI番号 → スキップ（福岡店）
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const SPREADSHEET_ID = '1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M';
const SHEET_GID = 534678762;

// ============================================================
// 型
// ============================================================

export interface ContractRecord {
  property_number: string;
  settlement_month: string | null;  // YYYY-MM
  settlement_date: string | null;   // YYYY-MM-DD
  staff: string;
  commission: number;               // 円（税込）
  category: 'actual' | 'contracted';
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * B列の決済予定月（数字 or 文字列）→ YYYY-MM 形式に変換
 * ルール: 10,11,12 → 2026年 / 1〜9 → 2027年（2026-2027年度）
 */
function parseSettlementMonth(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;

  // 年月が明示されている場合（例: "2027年3月", "2027/03"）
  const fullMatch = raw.match(/(\d{4})[年/\-](\d{1,2})/);
  if (fullMatch) {
    const y = parseInt(fullMatch[1]);
    const m = parseInt(fullMatch[2]);
    if (y >= 2026 && y <= 2027 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  // 月のみの場合（例: "10", "3月"）
  const monthOnly = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (isNaN(monthOnly) || monthOnly < 1 || monthOnly > 12) return null;
  const year = monthOnly >= 10 ? 2026 : 2027;
  return `${year}-${String(monthOnly).padStart(2, '0')}`;
}

/**
 * C列の決済確定日をパース
 * 対応フォーマット: YYYY/MM/DD, YYYY-MM-DD, M月D日 等
 */
function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.trim().replace(/\//g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
  // "10-15" のような年なし形式は無視
  if (!/\d{4}/.test(cleaned)) return null;
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 仲介手数料をパース（万円→円 変換を含む）
 * 1000未満の値は万円単位とみなして×10000する
 */
function parseCommission(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  const str = raw.trim();

  // 明示的に "万円" がある場合
  if (str.includes('万')) {
    const n = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n * 10_000);
  }

  const n = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return 0;

  // 1000 未満 → 万円単位と判断
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
 */
router.get('/contracts', authenticate, async (req: Request, res: Response) => {
  try {
    const { google } = await import('googleapis');

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
      (s) => s.properties?.sheetId === SHEET_GID
    );
    const sheetName = sheetMeta?.properties?.title;

    if (!sheetName) {
      return res.status(404).json({
        error: `シートID ${SHEET_GID} が見つかりません。スプレッドシートが正しく共有されているか確認してください。`,
      });
    }

    // ─── A〜I列を一括取得 ─────────────────────────────────
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:I`,
      valueRenderOption: 'UNFORMATTED_VALUE', // 数値はそのまま取得
    });

    const rows: any[][] = response.data.values ?? [];
    if (rows.length <= 1) {
      return res.json({ contracts: [], sheetName });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const FY_START = '2026-10';
    const FY_END = '2027-09';

    const contracts: ContractRecord[] = [];

    // ヘッダー行（1行目）をスキップ
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const propertyNumber = String(row[0] ?? '').trim();
      const settlementMonthRaw = String(row[1] ?? '').trim();   // B列
      const settlementDateRaw = String(row[2] ?? '').trim();    // C列
      const staff = String(row[3] ?? '').trim();                // D列
      const commissionRaw = String(row[8] ?? '').trim();        // I列

      // 物件番号なし → スキップ
      if (!propertyNumber) continue;

      // FI番号 → 福岡店のためスキップ
      if (propertyNumber.toUpperCase().includes('FI')) continue;

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

      // FY（2026-10〜2027-09）外はスキップ
      if (!settlementMonth || settlementMonth < FY_START || settlementMonth > FY_END) {
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
