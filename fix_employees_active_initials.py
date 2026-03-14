"""
employees.ts の active-initials エンドポイントを
DBのemployeesテーブル参照からスプシ参照（StaffManagementService）に切り替える。
フォールバック付き（スプシ失敗時はDBから取得）。
"""

with open('backend/src/routes/employees.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 1. import に StaffManagementService を追加
old_import = "import { Router, Request, Response } from 'express';\nimport { GoogleAuthService } from '../services/GoogleAuthService';\nimport { EmployeeUtils } from '../utils/employeeUtils';\nimport { authenticate } from '../middleware/auth';"
new_import = "import { Router, Request, Response } from 'express';\nimport { GoogleAuthService } from '../services/GoogleAuthService';\nimport { EmployeeUtils } from '../utils/employeeUtils';\nimport { authenticate } from '../middleware/auth';\nimport { StaffManagementService } from '../services/StaffManagementService';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ StaffManagementService import を追加')
else:
    print('⚠️ import 箇所が見つかりません')

# 2. StaffManagementService インスタンスを追加
old_instance = "const router = Router();\nconst googleAuthService = new GoogleAuthService();\nconst employeeUtils = new EmployeeUtils();"
new_instance = "const router = Router();\nconst googleAuthService = new GoogleAuthService();\nconst employeeUtils = new EmployeeUtils();\nconst staffManagementService = new StaffManagementService();"

if old_instance in text:
    text = text.replace(old_instance, new_instance)
    print('✅ staffManagementService インスタンスを追加')
else:
    print('⚠️ インスタンス生成箇所が見つかりません')

# 3. active-initials エンドポイントを置き換え
old_endpoint = """/**
 * 有効なスタッフのイニシャル一覧を取得（後続担当ボタン用）
 * employeesテーブルのis_active=trueかつinitialsが存在するスタッフを返す
 */
router.get('/active-initials', async (req: Request, res: Response) => {
  try {
    const { data: employees, error } = await employeeUtils['table']('employees')
      .select('initials, name')
      .eq('is_active', true)
      .not('initials', 'is', null)
      .order('name');

    if (error) throw error;

    const activeInitials = (employees || [])
      .map((emp: any) => emp.initials)
      .filter((initial: any) => initial && String(initial).trim() !== '');

    console.log(`[active-initials] Returning ${activeInitials.length} active staff initials from DB:`, activeInitials);
    res.json({ initials: activeInitials });
  } catch (error: any) {
    console.error('[active-initials] Error:', error.message, error.stack);
    res.status(500).json({
      error: {
        code: 'GET_ACTIVE_INITIALS_ERROR',
        message: 'Failed to get active staff initials',
        detail: error.message,
        retryable: true,
      },
    });
  }
});"""

new_endpoint = """/**
 * 有効なスタッフのイニシャル一覧を取得（後続担当ボタン用）
 * スタッフ管理スプレッドシートのH列「有効」=TRUEのスタッフを返す
 * スプシ取得失敗時はDBのemployeesテーブルにフォールバック
 */
router.get('/active-initials', async (req: Request, res: Response) => {
  try {
    // スプシから有効なイニシャルを取得
    const activeInitials = await staffManagementService.getActiveInitials();
    console.log(`[active-initials] Returning ${activeInitials.length} active staff initials from spreadsheet:`, activeInitials);
    res.json({ initials: activeInitials });
  } catch (spreadsheetError: any) {
    console.warn('[active-initials] Spreadsheet fetch failed, falling back to DB:', spreadsheetError.message);
    // フォールバック: DBのemployeesテーブルから取得
    try {
      const { data: employees, error } = await employeeUtils['table']('employees')
        .select('initials, name')
        .eq('is_active', true)
        .not('initials', 'is', null)
        .order('name');

      if (error) throw error;

      const activeInitials = (employees || [])
        .map((emp: any) => emp.initials)
        .filter((initial: any) => initial && String(initial).trim() !== '');

      console.log(`[active-initials] Fallback: Returning ${activeInitials.length} active staff initials from DB:`, activeInitials);
      res.json({ initials: activeInitials });
    } catch (dbError: any) {
      console.error('[active-initials] DB fallback also failed:', dbError.message);
      res.status(500).json({
        error: {
          code: 'GET_ACTIVE_INITIALS_ERROR',
          message: 'Failed to get active staff initials',
          detail: dbError.message,
          retryable: true,
        },
      });
    }
  }
});"""

if old_endpoint in text:
    text = text.replace(old_endpoint, new_endpoint)
    print('✅ active-initials エンドポイントをスプシ参照に切り替え')
else:
    print('⚠️ active-initials エンドポイントが見つかりません')
    idx = text.find('active-initials')
    if idx >= 0:
        print('周辺テキスト:', repr(text[idx-50:idx+500]))

with open('backend/src/routes/employees.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ employees.ts の修正完了')

# 確認
with open('backend/src/routes/employees.ts', 'rb') as f:
    result = f.read().decode('utf-8')

if 'StaffManagementService' in result:
    print('✅ StaffManagementService が含まれています')
if 'getActiveInitials' in result:
    print('✅ getActiveInitials が含まれています')
if 'Spreadsheet fetch failed' in result:
    print('✅ フォールバック処理が含まれています')
