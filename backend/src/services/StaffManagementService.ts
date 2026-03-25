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
  private readonly SHEET_NAME = 'スタッフチャット';

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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.SPREADSHEET_ID,
      range: `'${this.SHEET_NAME}'!A1:F`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log('[StaffManagementService] No data found in spreadsheet');
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
   * 通常スタッフのイニシャル一覧を取得
   */
  async getActiveInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      return [...new Set(
        staffData
          .filter(s => s.isNormal && s.initials && s.initials.trim() !== '')
          .map(s => s.initials)
      )];
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting normal initials:', error.message);
      throw error;
    }
  }

  /**
   * 事務ありスタッフのイニシャル一覧を取得
   */
  async getJimuInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      return [...new Set(
        staffData
          .filter(s => s.hasJimu && s.initials && s.initials.trim() !== '')
          .map(s => s.initials)
      )];
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
