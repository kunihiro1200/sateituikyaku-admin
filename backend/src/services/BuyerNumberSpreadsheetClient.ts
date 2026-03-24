// 買主番号採番用スプレッドシートクライアント
// 採番スプレッドシートの指定セルの値+1を次の買主番号として返す

import { GoogleSheetsClient } from './GoogleSheetsClient';

export class BuyerNumberSpreadsheetClient {
  private sheetsClient: GoogleSheetsClient;
  private cell: string;

  constructor(sheetsClient: GoogleSheetsClient, cell: string) {
    this.sheetsClient = sheetsClient;
    this.cell = cell;
  }

  /**
   * 採番スプレッドシートから次の買主番号を取得する
   * 指定セルの値 + 1 を返す
   * @throws Error スプレッドシートアクセス失敗時
   * @throws Error セルの値が空欄の場合
   * @throws Error セルの値が数値でない場合
   */
  async getNextBuyerNumber(): Promise<string> {
    try {
      // readRange は rowToObject を使うためヘッダーが必要だが、
      // 連番シートは単一セルのため直接 Sheets API を呼ぶ
      // GoogleSheetsClient の protected な sheets インスタンスにアクセスできないため、
      // readRange を利用して値を取得する（ヘッダーなしシートでも最初の値を取得）
      const rows = await (this.sheetsClient as any).readRawRange(this.cell);

      const rawValue: string | null | undefined = rows?.[0]?.[0];

      if (rawValue === undefined || rawValue === null || rawValue === '') {
        const msg = `Buyer number cell ${this.cell} is empty`;
        console.error(`[BuyerNumberSpreadsheetClient] ${msg}`);
        throw new Error(msg);
      }

      const n = parseInt(String(rawValue), 10);
      if (isNaN(n)) {
        const msg = `Buyer number cell value is not a valid number: ${rawValue}`;
        console.error(`[BuyerNumberSpreadsheetClient] ${msg}`);
        throw new Error(msg);
      }

      return String(n + 1);
    } catch (error: any) {
      // 自分でスローしたエラーはそのまま再スロー
      if (
        error.message?.startsWith('Buyer number cell') 
      ) {
        throw error;
      }
      const msg = `Failed to access buyer number spreadsheet: ${error.message}`;
      console.error(`[BuyerNumberSpreadsheetClient] ${msg}`);
      throw new Error(msg);
    }
  }
}
