import { GoogleSheetsClient } from './GoogleSheetsClient';

export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
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
 * - C列: 名字
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
  private readonly SHEET_NAME = 'スタッフ';

  /**
   * 担当者名からWebhook URLを取得
   * イニシャル（A列）または名字（C列）で検索
   */
  async getWebhookUrl(assigneeName: string): Promise<GetWebhookUrlResult> {
    try {
      const staffData = await this.fetchStaffData();

      const staff = staffData.find(
        s => s.initials === assigneeName || s.name === assigneeName
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

  private async fetchStaffData(): Promise<StaffInfo[]> {
    const now = Date.now();
    if (this.cache.size > 0 && now < this.cacheExpiry) {
      console.log('[StaffManagementService] Using cached staff data');
      return Array.from(this.cache.values());
    }

    console.log('[StaffManagementService] Fetching staff data from spreadsheet');

    const client = new GoogleSheetsClient({
      spreadsheetId: this.SPREADSHEET_ID,
      sheetName: this.SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });

    await client.authenticate();
    const rows = await client.readAll();

    const staffData: StaffInfo[] = [];
    for (const row of rows) {
      const initials = row['イニシャル'] as string;
      const name = row['名字'] as string;
      const chatWebhook = row['Chat webhook'] as string | null;

      const isActiveRaw = row['有効'];
      const isActive = String(isActiveRaw).toUpperCase() === 'TRUE';

      if (initials || name) {
        const hasJimuRaw = row['事務あり'];
        const hasJimu = String(hasJimuRaw).toUpperCase() === 'TRUE';

        const phone = row['電話番号'] as string | null;
        const email = row['メールアドレス'] as string | null;
        const regularHoliday = row['固定休'] as string | null;

        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
          hasJimu,
          phone: phone || null,
          email: email || null,
          regularHoliday: regularHoliday || null,
        };
        staffData.push(staff);

        if (initials) this.cache.set(initials, staff);
        if (name) this.cache.set(name, staff);
      }
    }

    this.cacheExpiry = now + this.CACHE_DURATION_MS;
    console.log('[StaffManagementService] Fetched staff data:', { count: staffData.length });

    return staffData;
  }

  /**
   * 有効なスタッフのイニシャル一覧を取得（H列「有効」=TRUEのもの）
   * 後続担当ボタン用
   */
  async getActiveInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const activeInitials = staffData
        .filter(s => s.isActive && s.initials && s.initials.trim() !== '')
        .map(s => s.initials);
      console.log('[StaffManagementService] Active initials from spreadsheet:', activeInitials);
      return activeInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting active initials:', error.message);
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

  clearCache(): void {
    console.log('[StaffManagementService] Clearing cache');
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}
