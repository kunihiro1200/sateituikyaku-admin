import { GoogleSheetsClient } from './GoogleSheetsClient';

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
 * スタッフ管理スプレッドシートからスタッフ情報を取得し、
 * 担当者名からGoogle Chat Webhook URLを取得します。
 *
 * スプレッドシート構造:
 * - A列: イニシャル
 * - D列: 姓名（担当名）
 * - E列: メアド（メールアドレス）
 * - F列: Chat webhook
 * - H列: 有効（TRUE/FALSE）
 *
 * キャッシュ機能: スタッフ情報を60分間キャッシュ
 */
export class StaffManagementService {
  private cache: Map<string, StaffInfo> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 60分
  private readonly SPREADSHEET_ID = '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs';
  private readonly SHEET_NAME = 'スタッフチャット';

  /**
   * 担当者名からWebhook URLを取得
   * イニシャル（A列）または名字（C列）で検索
   */
  async getWebhookUrl(assigneeName: string): Promise<GetWebhookUrlResult> {
    try {
      const staffData = await this.fetchStaffData();

      console.log('[StaffManagementService] getWebhookUrl:', {
        assigneeName,
        staffCount: staffData.length,
        staffNames: staffData.map(s => ({ initials: s.initials, name: s.name })),
      });

      // 完全一致（イニシャルまたは姓名）→ 部分一致（姓名に含まれる）の順で検索
      const staff = staffData.find(
        s => s.initials === assigneeName || s.name === assigneeName
      ) || staffData.find(
        s => s.name && s.name.includes(assigneeName)
      ) || staffData.find(
        s => assigneeName && s.name && assigneeName.includes(s.name)
      );

      if (!staff) {
        return { success: false, error: '担当者が見つかりませんでした' };
      }

      if (!staff.chatWebhook) {
        return { success: false, error: '担当者のChat webhook URLが設定されていません' };
      }

      return { success: true, webhookUrl: staff.chatWebhook };
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting webhook URL:', {
        assigneeName,
        error: error.message,
      });
      return { success: false, error: 'スタッフ情報の取得に失敗しました' };
    }
  }

  async fetchStaffData(): Promise<StaffInfo[]> {
    const now = Date.now();
    if (this.cache.size > 0 && now < this.cacheExpiry) {
      console.log('[StaffManagementService] Using cached staff data');
      return Array.from(this.cache.values());
    }

    console.log('[StaffManagementService] Fetching staff data from spreadsheet (raw mode)');

    const client = new GoogleSheetsClient({
      spreadsheetId: this.SPREADSHEET_ID,
      sheetName: this.SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });

    await client.authenticate();

    // ヘッダー行を取得してF列のインデックスを特定
    const headers = await client.getHeaders();
    console.log('[StaffManagementService] Sheet headers:', headers);

    // 全行を生データで取得（A列〜F列以降）
    const rows = await client.readAll();

    const staffData: StaffInfo[] = [];
    for (const row of rows) {
      // ヘッダー名で取得を試みる（複数の候補に対応）
      const name = (
        row['姓名'] ||
        row['名前'] ||
        row['スタッフ名'] ||
        row['担当者名'] ||
        row[headers[0]] // A列
      ) as string | null;

      // F列（インデックス5）のチャットアドレスを取得
      // ヘッダー名が不明な場合はインデックスで取得
      const fColHeader = headers[5]; // F列のヘッダー名
      const chatWebhook = (
        row['Chat webhook'] ||
        row['チャットアドレス'] ||
        row['chat_webhook'] ||
        row['Webhook URL'] ||
        row['webhook'] ||
        (fColHeader ? row[fColHeader] : null)
      ) as string | null;

      // イニシャルはA列またはB列
      const initials = (
        row['イニシャル'] ||
        row[headers[0]] ||
        row[headers[1]]
      ) as string | null;

      if (name || initials) {
        const staff: StaffInfo = {
          initials: String(initials || ''),
          name: String(name || ''),
          chatWebhook: chatWebhook || null,
          isActive: true,
          isNormal: true,
          hasJimu: false,
          phone: null,
          email: null,
          regularHoliday: null,
        };
        staffData.push(staff);

        if (initials) this.cache.set(String(initials), staff);
        if (name) this.cache.set(String(name), staff);
      }
    }

    this.cacheExpiry = now + this.CACHE_DURATION_MS;
    console.log('[StaffManagementService] Fetched staff data:', {
      count: staffData.length,
      headers,
      sample: staffData.slice(0, 3).map(s => ({ name: s.name, initials: s.initials, hasWebhook: !!s.chatWebhook })),
    });

    return staffData;
  }

  /**
   * 通常スタッフのイニシャル一覧を取得（I列「通常」=TRUEのもの）
   * メール送信確認セクションのイニシャル選択肢用
   */
  async getActiveInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const normalInitials = [...new Set(
        staffData
          .filter(s => s.isNormal && s.initials && s.initials.trim() !== '')
          .map(s => s.initials)
      )];
      console.log('[StaffManagementService] Normal initials from spreadsheet (I列):', normalInitials);
      return normalInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting normal initials:', error.message);
      throw error;
    }
  }

  /**
   * 事務ありスタッフのイニシャル一覧を取得（「事務あり」=TRUEのもの）
   * 報告担当選択用
   */
  async getJimuInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const jimuInitials = [...new Set(
        staffData
          .filter(s => s.hasJimu && s.initials && s.initials.trim() !== '')
          .map(s => s.initials)
      )];
      console.log('[StaffManagementService] Jimu initials from spreadsheet:', jimuInitials);
      return jimuInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting jimu initials:', error.message);
      throw error;
    }
  }

  /**
   * イニシャルでスタッフ情報を取得
   */
  async getStaffByInitials(initials: string): Promise<StaffInfo | null> {
    try {
      const staffData = await this.fetchStaffData();
      return staffData.find(s => s.initials === initials) || null;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting staff by initials:', error.message);
      return null;
    }
  }

  /**
   * 姓名の部分一致でスタッフ情報を取得
   * 例: "裏" → "裏天真" にマッチ
   */
  async getStaffByNameContains(namePart: string): Promise<StaffInfo | null> {
    try {
      const staffData = await this.fetchStaffData();
      return staffData.find(s => s.name && s.name.includes(namePart)) || null;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting staff by name contains:', error.message);
      return null;
    }
  }

  clearCache(): void {
    console.log('[StaffManagementService] Clearing cache');
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}
