import { google } from 'googleapis';

export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
  isNormal: boolean;
  hasJimu: boolean;
  phone: string | null;
  email: string | null;
  regularHoliday: string | null;
}

export interface GetWebhookUrlResult {
  success: boolean;
  webhookUrl?: string;
  error?: string;
}

/**
 * スタッフ管理サービス
 * スタッフチャットスプレッドシートのF列からGoogle Chat Webhook URLを取得します。
 * シート: スタッフチャット
 * F列: チャットアドレス（Google Chat Webhook URL）
 */
export class StaffManagementService {
  private cache: Map<string, StaffInfo> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 60分
  private readonly SPREADSHEET_ID = '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs';
  private readonly SHEET_NAME = 'スタッフ'; // 通常スタッフ情報（イニシャル等）
  private readonly CHAT_SHEET_NAME = 'スタッフ'; // チャットアドレスも同じシートのF列

  /**
   * Google Sheets APIクライアントを作成（GOOGLE_SERVICE_ACCOUNT_JSONを使用）
   */
  private async createSheetsClient() {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!jsonStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
    }

    let keyFile: any;
    try {
      keyFile = JSON.parse(jsonStr);
    } catch {
      // Base64の場合はデコード
      keyFile = JSON.parse(Buffer.from(jsonStr, 'base64').toString('utf8'));
    }

    if (!keyFile.private_key.includes('\n')) {
      keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    await auth.authorize();
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * 担当者名からWebhook URLを取得
   */
  async getWebhookUrl(assigneeName: string): Promise<GetWebhookUrlResult> {
    try {
      const staffData = await this.fetchStaffData();

      console.log('[StaffManagementService] getWebhookUrl:', {
        assigneeName,
        staffCount: staffData.length,
        staffNames: staffData.map(s => ({ initials: s.initials, name: s.name, hasWebhook: !!s.chatWebhook })),
      });

      // 完全一致（イニシャルまたは姓名）→ 部分一致の順で検索
      const staff = staffData.find(
        s => s.initials === assigneeName || s.name === assigneeName
      ) || staffData.find(
        s => s.name && s.name.includes(assigneeName)
      ) || staffData.find(
        s => assigneeName && s.name && assigneeName.includes(s.name)
      );

      if (!staff) {
        return { success: false, error: `担当者「${assigneeName}」が見つかりませんでした` };
      }

      if (!staff.chatWebhook) {
        return { success: false, error: `担当者「${assigneeName}」のChat webhook URLが設定されていません` };
      }

      return { success: true, webhookUrl: staff.chatWebhook };
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting webhook URL:', error.message);
      return { success: false, error: `スタッフ情報の取得に失敗しました: ${error.message}` };
    }
  }

  async fetchStaffData(): Promise<StaffInfo[]> {
    const now = Date.now();
    if (this.cache.size > 0 && now < this.cacheExpiry) {
      return Array.from(this.cache.values());
    }

    console.log('[StaffManagementService] Fetching staff data from spreadsheet');

    const sheets = await this.createSheetsClient();

    // ヘッダー行を含む全データを取得（A列〜F列）
    // シート名を試す順序: スタッフ → スタッフチャット → Sheet1
    const sheetNamesToTry = [this.SHEET_NAME, 'スタッフチャット', 'Sheet1', 'シート1'];
    let rows: string[][] = [];
    let usedSheetName = '';

    for (const sheetName of sheetNamesToTry) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: this.SPREADSHEET_ID,
          range: `${sheetName}!A:F`,
        });
        rows = (response.data.values || []) as string[][];
        usedSheetName = sheetName;
        console.log(`[StaffManagementService] Successfully read sheet: ${sheetName}, rows: ${rows.length}`);
        break;
      } catch (e: any) {
        console.log(`[StaffManagementService] Sheet "${sheetName}" not found, trying next...`);
      }
    }

    if (rows.length === 0) {
      console.log('[StaffManagementService] No data found in any sheet');
      return [];
    }

    // 1行目をヘッダーとして取得
    const headers = rows[0] as string[];
    console.log('[StaffManagementService] Headers:', headers);

    // F列（インデックス5）がチャットアドレス
    const fColIndex = 5;

    const staffData: StaffInfo[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as string[];
      if (!row || row.length === 0) continue;

      // A列: イニシャルまたは名前（最初の列）
      const col0 = row[0]?.trim() || '';
      // B列
      const col1 = row[1]?.trim() || '';
      // F列: チャットアドレス
      const chatWebhook = row[fColIndex]?.trim() || null;

      // 名前として使える値を探す
      const name = col0 || col1;
      const initials = col0;

      if (!name) continue;

      const staff: StaffInfo = {
        initials,
        name,
        chatWebhook: chatWebhook || null,
        isActive: true,
        isNormal: true,
        hasJimu: false,
        phone: null,
        email: null,
        regularHoliday: null,
      };
      staffData.push(staff);

      if (initials) this.cache.set(initials, staff);
      if (name && name !== initials) this.cache.set(name, staff);
    }

    this.cacheExpiry = now + this.CACHE_DURATION_MS;
    console.log('[StaffManagementService] Fetched staff data:', {
      count: staffData.length,
      headers,
      sample: staffData.slice(0, 5).map(s => ({
        col0: s.initials,
        name: s.name,
        hasWebhook: !!s.chatWebhook,
        webhookPreview: s.chatWebhook?.substring(0, 50),
      })),
    });

    return staffData;
  }

  /**
   * 通常スタッフのイニシャル一覧を取得（「スタッフ」シートのI列「通常」=TRUEのもの）
   * normal-initialsエンドポイント用 - チャットシートとは別のシートを使用
   */
  async getActiveInitials(): Promise<string[]> {
    try {
      const { GoogleSheetsClient } = require('./GoogleSheetsClient');
      const client = new GoogleSheetsClient({
        spreadsheetId: this.SPREADSHEET_ID,
        sheetName: this.SHEET_NAME, // 「スタッフ」シート
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      });
      await client.authenticate();
      const rows = await client.readAll();

      const normalInitials = [...new Set(
        rows
          .filter((row: any) => {
            const isNormalRaw = row['通常'];
            return String(isNormalRaw).toUpperCase() === 'TRUE';
          })
          .map((row: any) => row['イニシャル'] as string)
          .filter((i: string) => i && i.trim() !== '')
      )] as string[];

      console.log('[StaffManagementService] Normal initials:', normalInitials);
      return normalInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting normal initials:', error.message);
      throw error;
    }
  }

  /**
   * 事務ありスタッフのイニシャル一覧を取得（「スタッフ」シートの「事務あり」=TRUEのもの）
   */
  async getJimuInitials(): Promise<string[]> {
    try {
      const { GoogleSheetsClient } = require('./GoogleSheetsClient');
      const client = new GoogleSheetsClient({
        spreadsheetId: this.SPREADSHEET_ID,
        sheetName: this.SHEET_NAME, // 「スタッフ」シート
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      });
      await client.authenticate();
      const rows = await client.readAll();

      const jimuInitials = [...new Set(
        rows
          .filter((row: any) => {
            const hasJimuRaw = row['事務あり'];
            return String(hasJimuRaw).toUpperCase() === 'TRUE';
          })
          .map((row: any) => row['イニシャル'] as string)
          .filter((i: string) => i && i.trim() !== '')
      )] as string[];

      return jimuInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting jimu initials:', error.message);
      throw error;
    }
  }

  async getStaffByInitials(initials: string): Promise<StaffInfo | null> {
    try {
      const staffData = await this.fetchStaffData();
      return staffData.find(s => s.initials === initials) || null;
    } catch (error: any) {
      return null;
    }
  }

  async getStaffByNameContains(namePart: string): Promise<StaffInfo | null> {
    try {
      const staffData = await this.fetchStaffData();
      return staffData.find(s => s.name && s.name.includes(namePart)) || null;
    } catch (error: any) {
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}
