#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""StaffManagementService に phone/email/regularHoliday フィールドを追加"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# StaffInfo 型に phone/email/regularHoliday を追加
old_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
  hasJimu: boolean;
}"""

new_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
  hasJimu: boolean;
  phone: string | null;
  email: string | null;
  regularHoliday: string | null;
}"""

content = content.replace(old_interface, new_interface)

# fetchStaffData() でスプレッドシートから phone/email/regularHoliday を読み込む
old_staff_create = """        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
          hasJimu,
        };"""

new_staff_create = """        const phone = row['電話番号'] as string | null;
        const email = row['メールアドレス'] as string | null;
        const regularHoliday = row['固定休'] as string | null;

        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
          hasJimu,
          phone: phone || null,
          email: email || null,
          regularHoliday: regularHoliday || null,
        };"""

content = content.replace(old_staff_create, new_staff_create)

# getStaffByInitials メソッドを追加（イニシャルでスタッフ情報を取得）
old_clear_cache = """  clearCache(): void {
    console.log('[StaffManagementService] Clearing cache');
    this.cache.clear();
    this.cacheExpiry = 0;
  }"""

new_clear_cache = """  /**
   * イニシャルでスタッフ情報を取得
   */
  async getStaffByInitials(initials: string): Promise<StaffInfo | null> {
    try {
      const staffData = await this.fetchStaffData();
      return staffData.find(s => s.initials === initials) || null;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting staff by initials:', error.message);
      return null;
    }
  }

  clearCache(): void {
    console.log('[StaffManagementService] Clearing cache');
    this.cache.clear();
    this.cacheExpiry = 0;
  }"""

content = content.replace(old_clear_cache, new_clear_cache)

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done: StaffManagementService updated')
