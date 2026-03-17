#!/usr/bin/env python3
# BuyerService.ts の update() と updateWithSync() で db_updated_at を自動セットするよう修正

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# update() メソッドの修正:
# protectedFields から db_updated_at を外し、allowedData に自動セット
old_update = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'db_updated_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('buyer_id', buyerUuid)
      .select()
      .single();"""

new_update = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 手動更新時刻を記録（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('buyer_id', buyerUuid)
      .select()
      .single();"""

if old_update in text:
    text = text.replace(old_update, new_update)
    print('✅ update() メソッドを修正しました')
else:
    print('❌ update() メソッドのパターンが見つかりませんでした')

# updateWithSync() メソッドの修正:
# protectedFields から db_updated_at を外し、allowedData に自動セット
old_update_with_sync = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'db_updated_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 競合チェック"""

new_update_with_sync = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 手動更新時刻を記録（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    // 競合チェック"""

if old_update_with_sync in text:
    text = text.replace(old_update_with_sync, new_update_with_sync)
    print('✅ updateWithSync() メソッドを修正しました')
else:
    print('❌ updateWithSync() メソッドのパターンが見つかりませんでした')

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
