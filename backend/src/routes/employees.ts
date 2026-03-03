import { Router, Request, Response } from 'express';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { EmployeeUtils } from '../utils/employeeUtils';
import { authenticate } from '../middleware/auth';

const router = Router();
const googleAuthService = new GoogleAuthService();
const employeeUtils = new EmployeeUtils();

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 有効な社員のメールアドレス一覧を取得（Email送信元選択用）
 * GYOSHAユーザーは除外されますが、tenant@ifoo-oita.comは常に含まれます
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    // 有効な社員でメールアドレスが存在するものを取得
    const employees = await employeeUtils.getActiveEmployeesWithEmail();

    // メールアドレスが空文字列でないものをフィルタリング
    // GYOSHAユーザーを除外（ただしtenant@ifoo-oita.comは除く）
    const validEmployees = employees.filter(emp => {
      if (!emp.email || emp.email.trim() === '') {
        return false;
      }
      
      // tenant@ifoo-oita.comは常に含める
      if (emp.email.toLowerCase() === 'tenant@ifoo-oita.com') {
        return true;
      }
      
      // GYOSHAを含むメールアドレスは除外
      if (emp.email.toLowerCase().includes('gyosha')) {
        console.log(`Excluding GYOSHA user: ${emp.name} (${emp.email})`);
        return false;
      }
      
      return true;
    });

    console.log(`Returning ${validEmployees.length} active employees (excluding GYOSHA users)`);
    res.json({ employees: validEmployees });
  } catch (error) {
    console.error('Get active employees error:', error);
    res.status(500).json({
      error: {
        code: 'GET_ACTIVE_EMPLOYEES_ERROR',
        message: 'Failed to get active employees',
        retryable: true,
      },
    });
  }
});

/**
 * 有効なスタッフのイニシャル一覧を取得（電話担当プルダウン用）
 * スタッフ管理スプレッドシートの「通常=TRUE」のスタッフのイニシャルを返す
 */
router.get('/active-initials', async (req: Request, res: Response) => {
  try {
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const spreadsheetId = process.env.STAFF_SPREADSHEET_ID || '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xx';

    // シート名の候補（「スタッフ」が見つからない場合は「Sheet1」等を試す）
    const sheetNameCandidates = ['スタッフ', 'Staff', 'Sheet1', 'シート1'];
    let rows: any[] = [];
    let usedSheetName = '';

    for (const sheetName of sheetNameCandidates) {
      try {
        const sheetsClient = new GoogleSheetsClient({ spreadsheetId, sheetName });
        await sheetsClient.authenticate();
        rows = await sheetsClient.readAll();
        usedSheetName = sheetName;
        console.log(`[active-initials] Found sheet: "${sheetName}", rows: ${rows.length}`);
        break;
      } catch (sheetError: any) {
        console.warn(`[active-initials] Sheet "${sheetName}" not found: ${sheetError.message}`);
      }
    }

    if (rows.length === 0) {
      console.warn('[active-initials] No rows found in any sheet candidate');
      return res.json({ initials: [] });
    }

    // ヘッダーをログ出力（デバッグ用）
    const headers = Object.keys(rows[0] || {});
    console.log(`[active-initials] Sheet "${usedSheetName}" headers:`, headers);

    // 「通常」列と「イニシャル」列を探す（列名の揺れに対応）
    const normalColKey = headers.find(h => h.includes('通常') || h.toLowerCase() === 'normal') || '通常';
    const initialColKey = headers.find(h => h.includes('イニシャル') || h.toLowerCase() === 'initial') || 'イニシャル';

    console.log(`[active-initials] Using columns: normalCol="${normalColKey}", initialCol="${initialColKey}"`);

    // 通常=TRUEのスタッフのイニシャルを抽出
    const activeInitials = rows
      .filter((row: any) => {
        const val = row[normalColKey];
        return val === 'TRUE' || val === true || val === '1' || val === 1;
      })
      .map((row: any) => row[initialColKey])
      .filter((initial: any) => initial && String(initial).trim() !== '');

    console.log(`[active-initials] Returning ${activeInitials.length} active staff initials:`, activeInitials);
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
});

/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { calendarStatus } = req.query;

    // 全従業員を取得
    const { data: employees, error } = await employeeUtils['table']('employees')
      .select('id, name, email, role, is_active, initials')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw error;
    }

    if (!employees) {
      return res.json([]);
    }

    // 会社アカウントのカレンダー接続状態を取得
    const isCompanyConnected = await googleAuthService.isConnected();

    let tokenExpiry = null;
    let isExpired = false;

    if (isCompanyConnected) {
      try {
        const { data: tokenData } = await googleAuthService['table'](
          'google_calendar_tokens'
        )
          .select('token_expiry')
          .eq('employee_id', 'company_calendar_account')
          .single();

        if (tokenData && tokenData.token_expiry) {
          tokenExpiry = tokenData.token_expiry;
          isExpired = new Date(tokenData.token_expiry) < new Date();
        }
      } catch (error) {
        // トークン情報取得エラーは無視
      }
    }

    const status = isCompanyConnected ? (isExpired ? 'expired' : 'connected') : 'not_connected';

    // 全従業員に同じ接続状態を適用
    const employeesWithStatus = employees.map((employee) => ({
      ...employee,
      calendarStatus: {
        isConnected: isCompanyConnected,
        tokenExpiry,
        isExpired,
        status,
      },
    }));

    // カレンダー接続状態でフィルタリング
    let filteredEmployees = employeesWithStatus;
    if (calendarStatus) {
      filteredEmployees = employeesWithStatus.filter(
        (emp) => emp.calendarStatus.status === calendarStatus
      );
    }

    res.json(filteredEmployees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      error: {
        code: 'GET_EMPLOYEES_ERROR',
        message: 'Failed to get employees',
        retryable: true,
      },
    });
  }
});

/**
 * 特定の従業員のGoogleカレンダー接続状態を取得
 */
router.get('/:id/calendar-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 従業員が存在するか確認
    const employee = await employeeUtils.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
          retryable: false,
        },
      });
    }

    // 会社アカウントのカレンダー接続状態を確認
    const isConnected = await googleAuthService.isConnected();

    // トークン情報を取得
    let tokenExpiry = null;
    let isExpired = false;

    if (isConnected) {
      try {
        // トークン情報を取得
        const { data: tokenData } = await googleAuthService['table']('google_calendar_tokens')
          .select('token_expiry')
          .eq('employee_id', 'company_calendar_account')
          .single();

        if (tokenData && tokenData.token_expiry) {
          tokenExpiry = tokenData.token_expiry;
          isExpired = new Date(tokenData.token_expiry) < new Date();
        }
      } catch (error) {
        console.error('Error fetching token info:', error);
      }
    }

    res.json({
      employeeId: id,
      employeeName: employee.name,
      isConnected,
      tokenExpiry,
      isExpired,
      status: isConnected ? (isExpired ? 'expired' : 'connected') : 'not_connected',
    });
  } catch (error) {
    console.error('Get calendar status error:', error);
    res.status(500).json({
      error: {
        code: 'GET_CALENDAR_STATUS_ERROR',
        message: 'Failed to get calendar status',
        retryable: true,
      },
    });
  }
});

export default router;
