#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StaffManagementService.ts に hasJimu フィールドと getJimuInitials() を追加
"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. StaffInfo インターフェースに hasJimu を追加
old_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
}"""
new_interface = """export interface StaffInfo {
  initials: string;
  name: string;
  chatWebhook: string | null;
  isActive: boolean;
  hasJimu: boolean;
}"""
text = text.replace(old_interface, new_interface)

# 2. fetchStaffData で hasJimu を読み取る
old_staff_create = """      if (initials || name) {
        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
        };"""
new_staff_create = """      if (initials || name) {
        const hasJimuRaw = row['事務あり'];
        const hasJimu = String(hasJimuRaw).toUpperCase() === 'TRUE';

        const staff: StaffInfo = {
          initials: initials || '',
          name: name || '',
          chatWebhook: chatWebhook || null,
          isActive,
          hasJimu,
        };"""
text = text.replace(old_staff_create, new_staff_create)

# 3. getJimuInitials() メソッドを clearCache の前に追加
old_clear = """  clearCache(): void {"""
new_clear = """  /**
   * 事務ありスタッフのイニシャル一覧を取得（「事務あり」=TRUEのもの）
   * 報告担当選択用
   */
  async getJimuInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const jimuInitials = staffData
        .filter(s => s.hasJimu && s.initials && s.initials.trim() !== '')
        .map(s => s.initials);
      console.log('[StaffManagementService] Jimu initials from spreadsheet:', jimuInitials);
      return jimuInitials;
    } catch (error: any) {
      console.error('[StaffManagementService] Error getting jimu initials:', error.message);
      throw error;
    }
  }

  clearCache(): void {"""
text = text.replace(old_clear, new_clear)

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! StaffManagementService.ts updated with hasJimu and getJimuInitials().')
