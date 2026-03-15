#!/usr/bin/env python3
# StaffManagementService.ts に getStaffByNameContains メソッドを追加

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# clearCache の前に新メソッドを追加
old = '''  clearCache(): void {
    console.log('[StaffManagementService] Clearing cache');
    this.cache.clear();
    this.cacheExpiry = 0;
  }'''

new = '''  /**
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
  }'''

if old in text:
    text = text.replace(old, new)
    print('✅ StaffManagementService.ts: getStaffByNameContains 追加')
else:
    print('❌ 対象箇所が見つかりません')

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('StaffManagementService.ts 書き込み完了')
