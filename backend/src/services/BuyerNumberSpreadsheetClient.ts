// 買主番号採番用スプレッドシートクライアント
// 採番スプレッドシートの指定セルの値+1を次の買主番号として返す
// 通常: B2セル → 数字のみ（例: 7282）
// 福岡: C2セル → FK + 数字（例: FK1）

import { GoogleSheetsClient } from './GoogleSheetsClient';

export class BuyerNumberSpreadsheetClient {
  private sheetsClient: GoogleSheetsClient;
  private cell: string;
  private prefix: string;

  /**
   * @param sheetsClient GoogleSheetsClientインスタンス
   * @param cell 採番セルのA1表記（例: 'B2', 'C2'）
   * @param prefix 買主番号のプレフィックス（通常は空文字、福岡は 'FK'）
   */
  constructor(sheetsClient: GoogleSheetsClient, cell: string, prefix: string = '') {
    this.sheetsClient = sheetsClient;
    this.cell = cell;
    this.prefix = prefix;
  }

  /**
   * 採番スプレッドシートから次の買主番号を取得する
   * - 通常: セルの値 + 1 を文字列で返す（例: '7282'）
   * - 福岡: 'FK' + (セルの値 + 1) を返す（例: 'FK3'）
   * @throws Error スプレッドシートアクセス失敗時
   * @throws Error セルの値が空欄の場合
   * @throws Error セルの値が数値でない場合
   */
  async getNextBuyerNumber(): Promise<string> {
    try {
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

      const next: number = n + 1;
      const buyerNumber = this.prefix ? `${this.prefix}${next}` : String(next);
      console.log(`[BuyerNumberSpreadsheetClient] cell=${this.cell}, prefix='${this.prefix}', rawValue=${JSON.stringify(rawValue)}, n=${n}, next=${next}, buyerNumber=${buyerNumber}`);
      return buyerNumber;
    } catch (error: any) {
      // 自分でスローしたエラーはそのまま再スロー
      if (error.message?.startsWith('Buyer number cell')) {
        throw error;
      }
      const msg = `Failed to access buyer number spreadsheet: ${error.message}`;
      console.error(`[BuyerNumberSpreadsheetClient] ${msg}`);
      throw new Error(msg);
    }
  }

  /**
   * 採番スプレッドシートの指定セルを新しい連番（数値部分のみ）で更新する
   * - 通常: buyerNumber がそのまま数値文字列（例: '7282'）
   * - 福岡: buyerNumber が 'FK3' の場合、数値部分 '3' を書き込む
   * @param buyerNumber 採番した買主番号（文字列）
   * @throws Error スプレッドシートへの書き込み失敗時
   */
  async updateBuyerNumber(buyerNumber: string): Promise<void> {
    try {
      // プレフィックスがある場合は数値部分のみをセルに書き込む
      let cellValue: string;
      if (this.prefix && buyerNumber.startsWith(this.prefix)) {
        cellValue = buyerNumber.slice(this.prefix.length);
      } else {
        cellValue = buyerNumber;
      }
      await (this.sheetsClient as any).writeRawCell(this.cell, cellValue);
      console.log(`[BuyerNumberSpreadsheetClient] Updated cell ${this.cell} to ${cellValue} (buyerNumber=${buyerNumber})`);
    } catch (error: any) {
      const msg = `Failed to update buyer number cell ${this.cell}: ${error.message}`;
      console.error(`[BuyerNumberSpreadsheetClient] ${msg}`);
      throw new Error(msg);
    }
  }
}
