#!/usr/bin/env python3
# BuyerWriteServiceにappendNewBuyerメソッドを追加するスクリプト

with open('backend/src/services/BuyerWriteService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# クラスの末尾（最後の }）の直前にメソッドを追加
new_method = '''
  /**
   * 新規買主をスプレッドシートに行追加
   * @param buyerData DBに保存された買主データ
   * @returns 書き込み結果
   */
  async appendNewBuyer(buyerData: Record<string, any>): Promise<WriteResult> {
    try {
      // DBデータをスプレッドシート形式に変換
      const spreadsheetRow = this.columnMapper.mapDatabaseToSpreadsheet(buyerData);
      
      // スプレッドシートに行を追加
      await this.sheetsClient.appendRow(spreadsheetRow);

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
'''

# 最後の } の直前に挿入
last_brace_idx = text.rfind('\n}')
if last_brace_idx == -1:
    print('ERROR: Could not find closing brace')
    exit(1)

text = text[:last_brace_idx] + new_method + text[last_brace_idx:]

with open('backend/src/services/BuyerWriteService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! appendNewBuyer method added to BuyerWriteService.ts')
