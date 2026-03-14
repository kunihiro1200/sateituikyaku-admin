#!/usr/bin/env python3
# StaffManagementServiceにisActiveフィールドとgetActiveInitialsメソッドを追加

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# StaffInfoインターフェースにisActiveを追加
old_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
}"""

new_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
}"""

text = text.replace(old_interface, new_interface)

# コメントのスプレッドシート構造にH列を追加
old_comment = """ * スプレッドシート構造:
 * - A列: イニシャル
 * - C列: 名字
 * - F列: Chat webhook"""

new_comment = """ * スプレッドシート構造:
 * - A列: イニシャル
 * - C列: 名字
 * - F列: Chat webhook
 * - H列: 有効（TRUE/FALSE）"""

text = text.replace(old_comment, new_comment)

# fetchStaffDataのStaffInfo生成部分にisActiveを追加
old_fetch = """      if (initials || name) {
        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
        };
        staffData.push(staff);

        if (initials) this.cache.set(initials, staff);
        if (name) this.cache.set(name, staff);
      }"""

new_fetch = """      if (initials || name) {
        const isActiveRaw = row['有効'];
        const isActive = isActiveRaw === true || isActiveRaw === 'TRUE' || isActiveRaw === 1;
        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
        };
        staffData.push(staff);

        if (initials) this.cache.set(initials, staff);
        if (name) this.cache.set(name, staff);
      }"""

text = text.replace(old_fetch, new_fetch)

# clearCache()の前にgetActiveInitialsメソッドを追加
old_clear = """  clearCache(): void {"""

new_clear = """  /**
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

  clearCache(): void {"""

text = text.replace(old_clear, new_clear)

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! StaffManagementService.ts updated.')
