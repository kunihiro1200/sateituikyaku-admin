#!/usr/bin/env python3
# BuyerService.create()にスプレッドシート行追加処理を追加するスクリプト

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 既存のcreateメソッドの採番スプレッドシート更新後の部分を置換
old_code = '''    // DB保存成功後、採番スプレッドシートのB2セルを更新
    // 失敗しても登録自体は成功とする（警告ログのみ）
    try {
      const client = await this.initBuyerNumberClient();
      await client.updateBuyerNumber(buyerNumber);
    } catch (updateError: any) {
      console.warn(`[BuyerService] Failed to update buyer number cell after registration (buyer_number=${buyerNumber}): ${updateError.message}`);
    }

    return data;'''

new_code = '''    // DB保存成功後、採番スプレッドシートのB2セルを更新
    // 失敗しても登録自体は成功とする（警告ログのみ）
    try {
      const client = await this.initBuyerNumberClient();
      await client.updateBuyerNumber(buyerNumber);
    } catch (updateError: any) {
      console.warn(`[BuyerService] Failed to update buyer number cell after registration (buyer_number=${buyerNumber}): ${updateError.message}`);
    }

    // DB保存成功後、買主リストスプレッドシートに新規行を追加
    // 失敗しても登録自体は成功とする（警告ログのみ）
    try {
      await this.initSyncServices();
      if (this.writeService) {
        const appendResult = await this.writeService.appendNewBuyer(data);
        if (!appendResult.success) {
          console.warn(`[BuyerService] Failed to append new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendResult.error}`);
        } else {
          console.log(`[BuyerService] Successfully appended buyer ${buyerNumber} to spreadsheet`);
        }
      }
    } catch (appendError: any) {
      console.warn(`[BuyerService] Error appending new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendError.message}`);
    }

    return data;'''

if old_code not in text:
    print('ERROR: Target code not found')
    exit(1)

text = text.replace(old_code, new_code, 1)

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Spreadsheet append logic added to BuyerService.create()')
