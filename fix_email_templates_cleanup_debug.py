#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
emailTemplates.ts からデバッグ用コードを削除
"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# staff-debug エンドポイントを削除
old_staff_debug = """/**
 * スタッフ検索デバッグエンドポイント
 * GET /api/email-templates/staff-debug?name=裏
 */
router.get('/staff-debug', async (req, res) => {
  try {
    const name = (req.query.name as string) || '裏';
    const byInitials = await staffService.getStaffByInitials(name);
    const byNameContains = await staffService.getStaffByNameContains(name);
    res.json({
      searchName: name,
      byInitials,
      byNameContains,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

"""

if old_staff_debug in text:
    text = text.replace(old_staff_debug, '')
    print('✅ staff-debug エンドポイントを削除しました')
else:
    print('❌ staff-debug エンドポイントが見つかりませんでした')

# _debug フィールドをレスポンスから削除
old_debug_res = """    res.json({ subject: mergedSubject, body: mergedBody, sellerName, _debug: { salesAssignee: salesAssignee, staffInfoFound: !!staffInfo, staffPhone: staffInfo?.phone || null, staffEmail: staffInfo?.email || null, staffHoliday: staffInfo?.regularHoliday || null } });"""
new_debug_res = """    res.json({ subject: mergedSubject, body: mergedBody, sellerName });"""

if old_debug_res in text:
    text = text.replace(old_debug_res, new_debug_res)
    print('✅ _debug フィールドをレスポンスから削除しました')
else:
    print('❌ _debug フィールドが見つかりませんでした')

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
