with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# update() メソッドに db_updated_at を追加
old1 = '''    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    const { data, error } = await this.supabase'''

new1 = '''    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 手動更新時はdb_updated_atをセット（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    const { data, error } = await this.supabase'''

# updateWithSync() メソッドに db_updated_at を追加
old2 = '''    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 競合チェック'''

new2 = '''    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 手動更新時はdb_updated_atをセット（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    // 競合チェック'''

if old1 in text:
    text = text.replace(old1, new1)
    print('update() に db_updated_at を追加しました')
else:
    print('ERROR: update() の対象箇所が見つかりません')

if old2 in text:
    text = text.replace(old2, new2)
    print('updateWithSync() に db_updated_at を追加しました')
else:
    print('ERROR: updateWithSync() の対象箇所が見つかりません')

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
