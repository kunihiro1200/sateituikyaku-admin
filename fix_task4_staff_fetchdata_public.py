#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StaffManagementService.ts: fetchStaffData を public に変更
"""

filepath = 'backend/src/services/StaffManagementService.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "  private async fetchStaffData(): Promise<StaffInfo[]> {"
new = "  async fetchStaffData(): Promise<StaffInfo[]> {"

if old in text:
    text = text.replace(old, new)
    print('fetchStaffData を public に変更しました')
else:
    print('ERROR: 対象箇所が見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
