#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StaffManagementService.ts の getActiveInitials に重複排除を追加する
"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# getActiveInitials に [...new Set(...)] を追加
old = """  async getActiveInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const activeInitials = staffData
        .filter(s => s.isActive && s.initials && s.initials.trim() !== '')
        .map(s => s.initials);
      console.log('[StaffManagementService] Active initials from spreadsheet:', activeInitials);
      return activeInitials;"""

new = """  async getActiveInitials(): Promise<string[]> {
    try {
      const staffData = await this.fetchStaffData();
      const activeInitials = [...new Set(
        staffData
          .filter(s => s.isActive && s.initials && s.initials.trim() !== '')
          .map(s => s.initials)
      )];
      console.log('[StaffManagementService] Active initials from spreadsheet:', activeInitials);
      return activeInitials;"""

if old in text:
    text = text.replace(old, new)
    print("✅ getActiveInitials に重複排除を追加しました")
else:
    print("❌ ターゲット文字列が見つかりません")

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイルを保存しました")
