import { GoogleSheetsClient, SheetRow } from './GoogleSheetsClient';

export interface SharedItem {
  id: string;
  sharing_location: string;  // D列「共有場」
  sharing_date: string | null;  // P列「共有日」
  staff_not_shared: string | null;  // S列「共有できていない」
  confirmation_date: string | null;  // 確認日
  [key: string]: any;  // その他のカラム
}

export interface SharedItemCategory {
  key: string;
  label: string;
  count: number;
}

export interface Staff {
  name: string;
  is_normal: boolean;
}

/**
 * 社内共有事項管理サービス
 * 
 * Google Spreadsheet（ID: 1BuvYd9cKOdgIAy0XhL-voVx1tiGA-cd6MCU_dYvbAQE）の
 * シート「共有」と連携し、社内共有事項を管理します。
 */
export class SharedItemsService {
  private sheetsClient: GoogleSheetsClient;

  constructor() {
    this.sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '1BuvYd9cKOdgIAy0XhL-voVx1tiGA-cd6MCU_dYvbAQE',
      sheetName: '共有',
      // Vercel環境では GOOGLE_SERVICE_ACCOUNT_JSON 環境変数を使用
      // ローカル環境では serviceAccountKeyPath を使用
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
  }

  /**
   * 初期化（認証）
   */
  async initialize(): Promise<void> {
    await this.sheetsClient.authenticate();
  }

  /**
   * 全件取得（A2:ZZZから読み取り）
   */
  async getAll(): Promise<SharedItem[]> {
    try {
      const rows = await this.sheetsClient.readAll();
      return rows.map((row, index) => this.mapRowToItem(row, index + 2));
    } catch (error: any) {
      console.error('Failed to fetch shared items:', error);
      throw new Error('共有データの取得に失敗しました');
    }
  }

  /**
   * カテゴリーでフィルタリング
   */
  async getByCategory(category: string): Promise<SharedItem[]> {
    const allItems = await this.getAll();
    return allItems.filter(item => this.calculateCategory(item) === category);
  }

  /**
   * 英語キー → 日本語キー（スプレッドシートヘッダー）マッピング
   */
  private static readonly FIELD_KEY_MAP: Record<string, string> = {
    'id': 'ID',
    'date': '日付',
    'input_person': '入力者',
    'sharing_location': '共有場',
    'category': '項目',
    'title': 'タイトル',
    'content': '内容',
    'sharing_date': '共有日',
    'staff_not_shared': '共有できていない',
    'confirmation_date': '確認日',
    'pdf1': 'PDF1',
    'pdf2': 'PDF2',
    'pdf3': 'PDF3',
    'pdf4': 'PDF4',
    'image1': '画像１',
    'image2': '画像２',
    'image3': '画像３',
    'image4': '画像４',
    'url': 'URL',
    'meeting_content': '打ち合わせ内容',
  };

  /**
   * 英語キーを日本語キーに変換する
   * すでに日本語キーの場合はそのまま返す
   */
  private normalizeKeys(item: Record<string, any>): SheetRow {
    const normalized: SheetRow = {};
    for (const [key, value] of Object.entries(item)) {
      const mappedKey = SharedItemsService.FIELD_KEY_MAP[key] || key;
      normalized[mappedKey] = value;
    }
    return normalized;
  }

  /**
   * 新規作成（appendRow使用）
   */
  async create(item: Partial<SharedItem>): Promise<SharedItem> {
    try {
      // 英語キーを日本語キー（スプレッドシートヘッダー）に変換
      const normalizedItem = this.normalizeKeys(item as Record<string, any>);

      // デバッグ: ヘッダーと送信データのキー照合を確認
      const headers = await this.sheetsClient.getHeaders();
      const sentKeys = Object.keys(normalizedItem);
      const matchedKeys = sentKeys.filter(k => headers.includes(k));
      const unmatchedKeys = sentKeys.filter(k => !headers.includes(k));
      const missingHeaders = headers.filter(h => !sentKeys.includes(h));
      console.log('[SharedItemsService.create] headers:', JSON.stringify(headers));
      console.log('[SharedItemsService.create] sentKeys:', JSON.stringify(sentKeys));
      console.log('[SharedItemsService.create] matchedKeys:', JSON.stringify(matchedKeys));
      console.log('[SharedItemsService.create] unmatchedKeys (送信したがヘッダーにない):', JSON.stringify(unmatchedKeys));
      console.log('[SharedItemsService.create] missingHeaders (ヘッダーにあるが送信していない):', JSON.stringify(missingHeaders));

      await this.sheetsClient.appendRow(normalizedItem);
      return item as SharedItem;
    } catch (error: any) {
      console.error('Failed to create shared item:', error);
      throw new Error('共有データの作成に失敗しました');
    }
  }

  /**
   * 更新（updateRow使用）
   */
  async update(id: string, updates: Partial<SharedItem>): Promise<SharedItem> {
    try {
      // IDから行番号を検索
      const rowIndex = await this.sheetsClient.findRowByColumn('ID', id);
      
      if (!rowIndex) {
        throw new Error(`ID ${id} が見つかりません`);
      }

      // updateRowPartial を使って指定カラムのみ更新（他のカラムを消さない）
      await this.sheetsClient.updateRowPartial(rowIndex, updates as SheetRow);
      return { ...updates, id } as SharedItem;
    } catch (error: any) {
      console.error('Failed to update shared item:', error);
      throw new Error('共有データの更新に失敗しました');
    }
  }

  /**
   * カテゴリー計算ロジック
   * D列「共有場」からカテゴリーを計算
   */
  calculateCategory(item: SharedItem): string {
    // スタッフ確認カテゴリー: S列「共有できていない」が空でない場合
    if (item.staff_not_shared && !item.confirmation_date) {
      return `${item.staff_not_shared}は要確認`;
    }
    
    // 基本カテゴリー: D列の値をそのまま使用
    return item.sharing_location || 'その他';
  }

  /**
   * カテゴリー一覧取得
   */
  async getCategories(): Promise<SharedItemCategory[]> {
    const allItems = await this.getAll();
    const categoryMap = new Map<string, number>();

    // カテゴリーごとにアイテムをグループ化
    for (const item of allItems) {
      const category = this.calculateCategory(item);
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    // カテゴリー一覧を生成
    const categories: SharedItemCategory[] = [];
    categoryMap.forEach((count, key) => {
      categories.push({
        key,
        label: key,
        count,
      });
    });

    return categories;
  }

  /**
   * ソートロジック
   * P列「共有日」が空のアイテムを先に表示
   * P列「共有日」が入っているアイテムを後に表示（日付降順）
   */
  sortItems(items: SharedItem[]): SharedItem[] {
    return items.sort((a, b) => {
      // 共有日が空のアイテムを先に表示
      if (!a.sharing_date && b.sharing_date) return -1;
      if (a.sharing_date && !b.sharing_date) return 1;
      
      // 両方とも共有日が空の場合、順序を維持
      if (!a.sharing_date && !b.sharing_date) return 0;
      
      // 両方とも共有日がある場合、日付降順
      return new Date(b.sharing_date!).getTime() - new Date(a.sharing_date!).getTime();
    });
  }

  /**
   * スタッフ確認追加
   * S列「共有できていない」にスタッフ名を追加
   */
  async addStaffConfirmation(itemId: string, staffName: string): Promise<void> {
    try {
      // IDから行番号を検索
      const rowIndex = await this.sheetsClient.findRowByColumn('ID', itemId);
      
      if (!rowIndex) {
        throw new Error(`ID ${itemId} が見つかりません`);
      }

      await this.sheetsClient.updateRowPartial(rowIndex, {
        '共有できていない': staffName,
      } as SheetRow);
    } catch (error: any) {
      console.error('Failed to add staff confirmation:', error);
      throw new Error('スタッフ確認の追加に失敗しました');
    }
  }

  /**
   * スタッフ確認完了
   * 「確認日」に日付を設定
   */
  async markStaffConfirmed(itemId: string, staffName: string): Promise<void> {
    try {
      // IDから行番号を検索
      const rowIndex = await this.sheetsClient.findRowByColumn('ID', itemId);
      
      if (!rowIndex) {
        throw new Error(`ID ${itemId} が見つかりません`);
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式

      await this.sheetsClient.updateRowPartial(rowIndex, {
        '確認日': today,
      } as SheetRow);
    } catch (error: any) {
      console.error('Failed to mark staff confirmed:', error);
      throw new Error('スタッフ確認完了の設定に失敗しました');
    }
  }

  /**
   * 日付フォーマット関数（YYYY-MM-DD形式に変換）
   */
  private formatDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    
    try {
      // 既にYYYY-MM-DD形式の場合はそのまま返す
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // YYYY/M/D または YYYY/MM/DD 形式の場合
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // 数値（Excelシリアル値）の場合
      const numValue = Number(dateStr);
      if (!isNaN(numValue) && numValue > 0) {
        // Excelシリアル値を日付に変換（1900年1月1日を基準）
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (numValue - 2) * 24 * 60 * 60 * 1000);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 行データをSharedItemに変換
   */
  private mapRowToItem(row: SheetRow, rowIndex: number): SharedItem {
    // 日付フィールドを変換
    const formattedRow = { ...row };
    
    // 日付フィールドを変換
    if (formattedRow['日付']) {
      formattedRow['日付'] = this.formatDate(formattedRow['日付'] as string);
    }
    if (formattedRow['共有日']) {
      formattedRow['共有日'] = this.formatDate(formattedRow['共有日'] as string);
    }
    if (formattedRow['確認日']) {
      formattedRow['確認日'] = this.formatDate(formattedRow['確認日'] as string);
    }
    
    // A列のIDを使用（存在しない場合は行番号をフォールバック）
    const id = formattedRow['ID'] ? String(formattedRow['ID']) : rowIndex.toString();
    
    return {
      id,
      sharing_location: (formattedRow['共有場'] as string) || '',
      sharing_date: formattedRow['共有日'] as string || null,
      staff_not_shared: (formattedRow['共有できていない'] as string) || null,
      confirmation_date: formattedRow['確認日'] as string || null,
      ...formattedRow,
    };
  }
}
