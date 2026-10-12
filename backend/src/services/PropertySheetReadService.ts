/**
 * PropertySheetReadService
 *
 * 個別物件スプレッドシートの「媒介依頼」「台帳」「固定」シートから
 * GASの41項目に対応するデータを読み取り、DBに保存できる形に変換する。
 *
 * GAS の update業務依頼集計表() の転記ロジックをそのまま移植。
 */

import { google, sheets_v4 } from 'googleapis';

// ───── 定数 ─────────────────────────────────────────────────────────────────

/** 除外物件番号（GAS の ADD_EXCLUDE_PROPERTY_NUMBERS と同一） */
export const EXCLUDE_PROPERTY_NUMBERS = new Set(['AA10204', 'AA9830', 'テスト']);

// ───── 型定義 ────────────────────────────────────────────────────────────────

/**
 * GASの41項目に対応するDB保存用データ型。
 * null = スプレッドシートで空のセル（DBに null を書く）。
 */
export interface PropertySheetData {
  property_number: string;            // 媒介依頼!A2
  property_address: string | null;    // 媒介依頼!C2
  seller_name: string | null;         // 媒介依頼!B11
  spreadsheet_url: string;            // file.getUrl()
  sales_assignee: string | null;      // 媒介依頼!B7
  mediation_type: string | null;      // 媒介依頼!A4
  mediation_deadline: string | null;  // 媒介依頼!A5（YYYY-MM-DD）
  site_registration_deadline: string | null;  // 媒介依頼!G5（YYYY-MM-DD）
  email_distribution: string | null;  // 媒介依頼!D5
  sales_contract_deadline: string | null;  // 台帳!B2（YYYY-MM-DD）
  settlement_date: string | null;     // 固定!F11（YYYY-MM-DD）
  brokerage_fee_seller: number | null; // 台帳!D13
  brokerage_fee_buyer: number | null;  // 台帳!F13
  discount_reason: string | null;      // 台帳!K13
  sales_price: number | null;          // 台帳!B6
  campaign: string | null;             // 台帳!I13
  settlement_scheduled_month: string | null;  // 台帳!D20
  contract_type: string | null;        // 台帳!B3
  loan_approval_scheduled_date: string | null; // 台帳!C9+D9+F9+H9（和暦変換）
  /** セルが空のときのみ設定する初期値。null = 集計表/DB の既存値を保持 */
  site_registration_ok_comment: string | null;  // '確認完了しました。'
  /** セルが空のときのみ設定する初期値。null = 集計表/DB の既存値を保持 */
  floor_plan_ok_comment: string | null;          // '図面OKです。'
  property_type: string | null;        // 媒介依頼!M2（優先）→ B2
  sales_contract_admin: string | null; // 台帳!D1
  broker: string | null;               // 台帳!D3
  broker_contact: string | null;       // 台帳!F3
  judicial_scrivener: string | null;   // 台帳!B19
  judicial_scrivener_contact: string | null; // 台帳!G19
  single_listing: string | null;       // 媒介依頼!I2
  cadastral_map_sales_input: string | null;  // 媒介依頼!I5
  road_dimensions: string | null;      // 媒介依頼!B5（種別≠土）or N5（種別=土）
  seller_contact_name: string | null;  // 台帳!B15
  seller_contact_email: string | null; // 台帳!D15
  seller_contact_tel: string | null;   // 台帳!E16（電話番号正規化）
  buyer_contact_name: string | null;   // 台帳!B17
  buyer_contact_email: string | null;  // 台帳!D17
  buyer_contact_tel: string | null;    // 台帳!E18（電話番号正規化）
  loan: string | null;                 // 台帳!B8
  financial_institution: string | null;  // 台帳!D8
  delivery_scheduled_date: string | null;  // 台帳!B20+D20+F20（令和年数変換）
  mediation_delivery_method: string | null;  // 媒介依頼!B19
  mediation_pre_mail_check: string | null;   // 媒介依頼!B22
}

// ───── ヘルパー関数（GASの補助関数を移植） ──────────────────────────────────

function normalizeInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.trunc(v);
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ''));
  return isNaN(n) ? null : Math.trunc(n);
}

function normalizeMonth(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ''));
  return isNaN(n) ? null : Math.trunc(n);
}

/** "末日" / "末" を含む場合は 'end'、数字なら数値文字列、空なら null */
function normalizeDayRaw(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes('末')) return 'end';
  const n = s.replace(/[^\d]/g, '');
  return n ? String(Number(n)) : null;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function warekiBaseYear(era: string): number {
  if (era.includes('令和')) return 2018;
  if (era.includes('平成')) return 1988;
  if (era.includes('昭和')) return 1925;
  if (era.includes('大正')) return 1911;
  if (era.includes('明治')) return 1867;
  return 0;
}

/**
 * 令和年数（数値）から西暦 Date を生成する。
 * GAS の buildHandoverDateFromReiwaNumber_ に対応。
 */
function buildHandoverDate(reiwaYear: any, month: any, day: any): Date | null {
  const ry = normalizeInt(reiwaYear);
  const mm = normalizeMonth(month);
  const dRaw = normalizeDayRaw(day);
  if (!ry || !mm) return null;
  const seireki = 2018 + ry;
  let dd: number;
  if (dRaw === 'end' || !dRaw) dd = getLastDayOfMonth(seireki, mm);
  else dd = Number(dRaw);
  if (!dd || isNaN(dd)) dd = getLastDayOfMonth(seireki, mm);
  return new Date(seireki, mm - 1, dd);
}

/**
 * 和暦（元号テキスト + 年）から西暦 Date を生成する。
 * GAS の buildApprovalDateFromWareki_ に対応。
 */
function buildApprovalDate(era: any, warekiYear: any, month: any, day: any): Date | null {
  const e = String(era || '').trim();
  const y = normalizeInt(warekiYear);
  const m = normalizeMonth(month);
  const dRaw = normalizeDayRaw(day);
  if (!e || !y || !m) return null;
  const base = warekiBaseYear(e);
  if (!base) return null;
  const seireki = base + y;
  let dd: number;
  if (dRaw === 'end' || !dRaw) dd = getLastDayOfMonth(seireki, m);
  else dd = Number(dRaw);
  if (!dd || isNaN(dd)) dd = getLastDayOfMonth(seireki, m);
  return new Date(seireki, m - 1, dd);
}

/** Date → ISO日付文字列（YYYY-MM-DD）。null の場合は null を返す。 */
function toIsoDate(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * 汎用日付変換（GAS の convertToDate に対応）。
 * 各種フォーマット（YYYY/MM/DD, YYYY-MM-DD, 数値シリアル）を受け付ける。
 */
function convertToDate(value: any): string | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return toIsoDate(value);
  const s = String(value).trim();
  if (!s) return null;
  // Google Sheets の FORMATTED_STRING は "2025/3/31" のような形式
  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // その他: Date でパース
  const parsed = new Date(s);
  return toIsoDate(isNaN(parsed.getTime()) ? null : parsed);
}

/** 数値をパース（カンマ・円記号除去）。空や NaN は null。 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value).replace(/,/g, '').replace(/円/g, '').trim());
  return isNaN(n) ? null : n;
}

/** 電話番号を正規化（先頭0の補完など）。10桁未満はそのまま。 */
function normalizePhone(value: any): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, '');
  // 10桁未満はプレースホルダーの可能性があるためそのまま返す
  if (digits.length < 10) return s;
  // 先頭0がなければ補完（国内番号）
  return digits.startsWith('0') ? digits : `0${digits}`;
}

/** セル値から文字列を取得。空文字・エラー値は null。 */
function toStr(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  // スプレッドシートのエラー値をスキップ
  if (/^#(REF|N\/A|VALUE|ERROR|NAME\?|NULL|DIV\/0)!?$/i.test(s)) return null;
  return s;
}

// ───── サービス ──────────────────────────────────────────────────────────────

export class PropertySheetReadService {
  private sheets: sheets_v4.Sheets | null = null;

  /** WorkTaskSyncService と同じ認証フロー */
  private async initSheets(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

    // 1. GOOGLE_SERVICE_ACCOUNT_JSON
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        let jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        let keyFile: any;
        try { keyFile = JSON.parse(jsonString); }
        catch { keyFile = JSON.parse(Buffer.from(jsonString, 'base64').toString('utf8')); }
        if (keyFile.private_key && !keyFile.private_key.includes('\n')) {
          keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
        }
        const auth = new google.auth.JWT({ email: keyFile.client_email, key: keyFile.private_key, scopes });
        await auth.authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        return this.sheets;
      } catch { /* fall through */ }
    }

    // 2. EMAIL + PRIVATE_KEY
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes,
        });
        await auth.authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        return this.sheets;
      } catch { /* fall through */ }
    }

    // 3. ローカルファイル
    const fs = require('fs');
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json';
    if (fs.existsSync(keyFilePath)) {
      const auth = new google.auth.GoogleAuth({ keyFile: keyFilePath, scopes });
      this.sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });
      return this.sheets;
    }

    throw new Error('[PropertySheetReadService] No Google auth credentials');
  }

  /**
   * 指定スプレッドシートの41項目を読み取って返す。
   * 「媒介依頼」シートがなければ null を返す。
   *
   * @param spreadsheetId  個別物件スプレッドシートのID
   * @param spreadsheetUrl ファイルのWebViewLink
   */
  async readPropertyData(
    spreadsheetId: string,
    spreadsheetUrl: string,
  ): Promise<PropertySheetData | null> {
    const sheets = await this.initSheets();

    // ─── Step 1: シート名一覧を取得（固定シートの正確な名前を特定）───────────
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const sheetTitles = (metaRes.data.sheets || []).map(s => s.properties?.title || '');

    // 「媒介依頼」シートが存在しなければこのスプレッドシートはスキップ
    if (!sheetTitles.includes('媒介依頼')) {
      console.log(`[PropertySheetReadService] No 媒介依頼 sheet in ${spreadsheetId}`);
      return null;
    }

    const hasTaichou = sheetTitles.includes('台帳');
    const koteiSheet = sheetTitles.find(t => t.includes('固定')) || null;

    // ─── Step 2: 全必要セルを1回の batchGet で取得 ──────────────────────────
    // FORMATTED_STRING: GAS の getValue() と同様に表示値を取得
    const ranges: string[] = [
      // 媒介依頼シート（16項目）
      '媒介依頼!A2',   // [0]  物件番号
      '媒介依頼!C2',   // [1]  物件所在
      '媒介依頼!B11',  // [2]  売主
      '媒介依頼!B7',   // [3]  営業担当
      '媒介依頼!A4',   // [4]  媒介形態
      '媒介依頼!A5',   // [5]  媒介作成締め日
      '媒介依頼!G5',   // [6]  サイト登録締め日
      '媒介依頼!D5',   // [7]  メール配信
      '媒介依頼!M2',   // [8]  種別1（M2優先）
      '媒介依頼!B2',   // [9]  種別2 / 道路寸法判定用
      '媒介依頼!I2',   // [10] 1社掲載
      '媒介依頼!I5',   // [11] 地籍測量図・字図（営業入力）
      '媒介依頼!B5',   // [12] 道路寸法（デフォルト）
      '媒介依頼!N5',   // [13] 道路寸法（種別=土のとき使用）
      '媒介依頼!B19',  // [14] お渡し手段
      '媒介依頼!B22',  // [15] 郵送前営業確認
    ];

    if (hasTaichou) {
      ranges.push(
        '台帳!B2',   // [16] 売買契約締め日
        '台帳!B3',   // [17] 契約形態
        '台帳!B6',   // [18] 売買価格
        '台帳!B8',   // [19] ローン
        '台帳!B15',  // [20] 売主名前
        '台帳!B17',  // [21] 買主名前
        '台帳!B19',  // [22] 司法書士
        '台帳!B20',  // [23] 引き渡し予定（令和年数）
        '台帳!C9',   // [24] 融資承認予定日（元号）
        '台帳!D1',   // [25] 事務担当（売買契約）
        '台帳!D3',   // [26] 仲介業者
        '台帳!D8',   // [27] 金融機関名
        '台帳!D9',   // [28] 融資承認予定日（和暦年）
        '台帳!D13',  // [29] 仲介手数料（売）
        '台帳!D15',  // [30] 売主メアド
        '台帳!D17',  // [31] 買主メアド
        '台帳!D20',  // [32] 決済予定月 / 引き渡し予定（月）
        '台帳!E16',  // [33] 売主TEL
        '台帳!E18',  // [34] 買主TEL
        '台帳!F3',   // [35] 仲介業者担当連絡先
        '台帳!F9',   // [36] 融資承認予定日（月）
        '台帳!F13',  // [37] 仲介手数料（買）
        '台帳!F20',  // [38] 引き渡し予定（日）
        '台帳!G19',  // [39] 司法書士連絡先
        '台帳!H9',   // [40] 融資承認予定日（日）
        '台帳!I13',  // [41] キャンペーン
        '台帳!K13',  // [42] 減額理由
      );
    }

    if (koteiSheet) {
      ranges.push(`${koteiSheet}!F11`);  // [-1] 決済日
    }

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: 'FORMATTED_STRING',
    });

    // ─── セル値をインデックスで取得するヘルパー ────────────────────────────
    const valueRanges = batchRes.data.valueRanges || [];
    const cell = (i: number): any => {
      const vr = valueRanges[i];
      if (!vr?.values?.[0]?.[0]) return null;
      return vr.values[0][0];
    };

    // ─── Step 3: 物件番号チェック ────────────────────────────────────────────
    const propertyNumber = toStr(cell(0));
    if (!propertyNumber) {
      console.log(`[PropertySheetReadService] Empty property_number in ${spreadsheetId}`);
      return null;
    }
    if (EXCLUDE_PROPERTY_NUMBERS.has(propertyNumber)) {
      console.log(`[PropertySheetReadService] Excluded property: ${propertyNumber}`);
      return null;
    }

    // ─── Step 4: 各セル値の取得・変換 ───────────────────────────────────────

    // 台帳セルのオフセット（媒介依頼が16個あるため）
    const T = hasTaichou ? (i: number) => cell(16 + i) : () => null;
    // 固定シートのオフセット
    const koteiOffset = hasTaichou ? 16 + 27 : 16;
    const fixedF11 = koteiSheet ? cell(koteiOffset) : null;

    // 種別判定（GAS: M2が空ならB2を使う）
    const typeM2 = toStr(cell(8));
    const typeB2 = toStr(cell(9));   // 台帳B2と混同しないよう注意（媒介依頼B2）
    const propertyType = typeM2 || typeB2 || null;

    // 道路寸法判定（GAS: B2が'土'のとき N5を使う）
    const roadDefault = toStr(cell(12));
    const roadLand    = toStr(cell(13));
    const roadDimensions = typeB2 === '土' ? roadLand : roadDefault;

    // 融資承認予定日（和暦変換）
    const approvalDate = hasTaichou
      ? buildApprovalDate(T(8), T(12), T(20), T(24))
      : null;

    // 引き渡し予定（令和年数変換）
    const handoverDate = hasTaichou
      ? buildHandoverDate(T(7), T(16), T(22))
      : null;

    return {
      property_number:              propertyNumber,
      property_address:             toStr(cell(1)),
      seller_name:                  toStr(cell(2)),
      spreadsheet_url:              spreadsheetUrl,
      sales_assignee:               toStr(cell(3)),
      mediation_type:               toStr(cell(4)),
      mediation_deadline:           convertToDate(cell(5)),
      site_registration_deadline:   convertToDate(cell(6)),
      email_distribution:           toStr(cell(7)),
      sales_contract_deadline:      hasTaichou ? convertToDate(T(0)) : null,
      settlement_date:              convertToDate(fixedF11),
      brokerage_fee_seller:         hasTaichou ? parseNumber(T(13)) : null,
      brokerage_fee_buyer:          hasTaichou ? parseNumber(T(21)) : null,
      discount_reason:              hasTaichou ? toStr(T(26)) : null,
      sales_price:                  hasTaichou ? parseNumber(T(2)) : null,
      campaign:                     hasTaichou ? toStr(T(25)) : null,
      settlement_scheduled_month:   hasTaichou ? toStr(T(16)) : null,
      contract_type:                hasTaichou ? toStr(T(1)) : null,
      loan_approval_scheduled_date: toIsoDate(approvalDate),
      site_registration_ok_comment: '確認完了しました。',  // 空のときのみ適用（DB側で制御）
      floor_plan_ok_comment:        '図面OKです。',         // 空のときのみ適用（DB側で制御）
      property_type:                propertyType,
      sales_contract_admin:         hasTaichou ? toStr(T(9)) : null,
      broker:                       hasTaichou ? toStr(T(10)) : null,
      broker_contact:               hasTaichou ? toStr(T(19)) : null,
      judicial_scrivener:           hasTaichou ? toStr(T(6)) : null,
      judicial_scrivener_contact:   hasTaichou ? toStr(T(23)) : null,
      single_listing:               toStr(cell(10)),
      cadastral_map_sales_input:    toStr(cell(11)),
      road_dimensions:              roadDimensions,
      seller_contact_name:          hasTaichou ? toStr(T(4)) : null,
      seller_contact_email:         hasTaichou ? toStr(T(14)) : null,
      seller_contact_tel:           normalizePhone(hasTaichou ? T(17) : null),
      buyer_contact_name:           hasTaichou ? toStr(T(5)) : null,
      buyer_contact_email:          hasTaichou ? toStr(T(15)) : null,
      buyer_contact_tel:            normalizePhone(hasTaichou ? T(18) : null),
      loan:                         hasTaichou ? toStr(T(3)) : null,
      financial_institution:        hasTaichou ? toStr(T(11)) : null,
      delivery_scheduled_date:      toIsoDate(handoverDate),
      mediation_delivery_method:    toStr(cell(14)),
      mediation_pre_mail_check:     toStr(cell(15)),
    };
  }
}
