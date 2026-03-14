#!/usr/bin/env python3
# BuyerService.ts から db_updated_at / db_created_at を削除するスクリプト
# UTF-8で安全に書き込む

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. create メソッド内の db_created_at と db_updated_at を削除
old1 = """    const newBuyer = {
      ...buyerData,
      buyer_number: buyerNumber,
      db_created_at: new Date().toISOString(),
      db_updated_at: new Date().toISOString(),
    };"""

new1 = """    const newBuyer = {
      ...buyerData,
      buyer_number: buyerNumber,
    };"""

# 2. update メソッド内の protectedFields から 'db_created_at' を削除し、
#    db_updated_at の設定行を削除
old2 = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 更新タイムスタンプを追加
    allowedData.db_updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('buyer_id', buyerUuid)
      .select()
      .single();"""

new2 = """    // 更新不可フィールドを除外
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

# 3. updateWithSync メソッド内の protectedFields と db_updated_at 設定行を修正
old3 = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 更新タイムスタンプを追加
    allowedData.db_updated_at = new Date().toISOString();

    // 競合チェック"""

new3 = """    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'db_updated_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 競合チェック"""

# 変換を適用
count1 = text.count(old1)
count2 = text.count(old2)
count3 = text.count(old3)

print(f'Pattern 1 (create db_created_at/db_updated_at): {count1} matches')
print(f'Pattern 2 (update db_updated_at): {count2} matches')
print(f'Pattern 3 (updateWithSync db_updated_at): {count3} matches')

if count1 == 1:
    text = text.replace(old1, new1)
    print('✅ Pattern 1 replaced')
else:
    print(f'❌ Pattern 1: expected 1 match, got {count1}')

if count2 == 1:
    text = text.replace(old2, new2)
    print('✅ Pattern 2 replaced')
else:
    print(f'❌ Pattern 2: expected 1 match, got {count2}')

if count3 == 1:
    text = text.replace(old3, new3)
    print('✅ Pattern 3 replaced')
else:
    print(f'❌ Pattern 3: expected 1 match, got {count3}')

# UTF-8で書き込む（BOMなし）
with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! BuyerService.ts updated.')

# BOMチェック
with open('backend/src/services/BuyerService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b"\\xef\\xbb\\xbf")')
