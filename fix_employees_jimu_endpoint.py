#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
employees.ts に /jimu-initials エンドポイントを追加
"""

with open('backend/src/routes/employees.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# active-initials エンドポイントの後に jimu-initials を追加
old_marker = """/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""

new_marker = """/**
 * 事務ありスタッフのイニシャル一覧を取得（報告担当選択用）
 * スタッフ管理スプレッドシートの「事務あり」=TRUEのスタッフを返す
 */
router.get('/jimu-initials', async (req: Request, res: Response) => {
  try {
    const jimuInitials = await staffManagementService.getJimuInitials();
    console.log(`[jimu-initials] Returning ${jimuInitials.length} jimu staff initials:`, jimuInitials);
    res.json({ initials: jimuInitials });
  } catch (error: any) {
    console.error('[jimu-initials] Failed to get jimu initials:', error.message);
    // フォールバック: active-initials と同じ一覧を返す
    try {
      const activeInitials = await staffManagementService.getActiveInitials();
      res.json({ initials: activeInitials });
    } catch (fallbackError: any) {
      res.status(500).json({
        error: {
          code: 'GET_JIMU_INITIALS_ERROR',
          message: 'Failed to get jimu staff initials',
          retryable: true,
        },
      });
    }
  }
});

/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""

text = text.replace(old_marker, new_marker)

with open('backend/src/routes/employees.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! employees.ts updated with /jimu-initials endpoint.')
