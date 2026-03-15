#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
employees.ts: jimu-staff エンドポイントを追加（イニシャル→姓名マッピング）
"""

filepath = 'backend/src/routes/employees.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# jimu-initials エンドポイントの後に jimu-staff エンドポイントを追加
old_section = """/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""

new_section = """/**
 * 事務ありスタッフの一覧（イニシャル + 姓名）を取得（報告担当フルネーム表示用）
 */
router.get('/jimu-staff', async (req: Request, res: Response) => {
  try {
    const staffData = await staffManagementService['fetchStaffData']();
    const jimuStaff = staffData
      .filter((s: any) => s.hasJimu && s.initials && s.initials.trim() !== '')
      .map((s: any) => ({ initials: s.initials, name: s.name || s.initials }));
    // 重複除去
    const seen = new Set<string>();
    const unique = jimuStaff.filter((s: any) => {
      if (seen.has(s.initials)) return false;
      seen.add(s.initials);
      return true;
    });
    res.json({ staff: unique });
  } catch (error: any) {
    console.error('[jimu-staff] Failed:', error.message);
    res.status(500).json({ error: 'Failed to get jimu staff' });
  }
});

/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""

if old_section in text:
    text = text.replace(old_section, new_section)
    print('jimu-staff エンドポイントを追加しました')
else:
    print('ERROR: 対象箇所が見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
