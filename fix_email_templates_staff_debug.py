#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
emailTemplates.ts にスタッフ検索デバッグエンドポイントを追加
"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# デバッグエンドポイントの後にスタッフ検索デバッグエンドポイントを追加
old = """/**
 * Get all available email templates
 * GET /api/email-templates
 */
/**
 * 物件区分のテンプレート一覧を取得
 * GET /api/email-templates/property
 */"""

new = """/**
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

/**
 * Get all available email templates
 * GET /api/email-templates
 */
/**
 * 物件区分のテンプレート一覧を取得
 * GET /api/email-templates/property
 */"""

if old in text:
    text = text.replace(old, new)
    print('✅ スタッフ検索デバッグエンドポイントを追加しました')
else:
    print('❌ 対象箇所が見つかりませんでした')
    # 現在の内容を確認
    idx = text.find('物件区分のテンプレート一覧を取得')
    print(f'  物件区分の位置: {idx}')
    if idx > 0:
        print(f'  前後: {repr(text[idx-100:idx+50])}')

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
