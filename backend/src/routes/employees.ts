import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { EmployeeUtils } from '../utils/employeeUtils';
import { authenticate } from '../middleware/auth';
import { StaffManagementService } from '../services/StaffManagementService';

const router = Router();
const googleAuthService = new GoogleAuthService();
const employeeUtils = new EmployeeUtils();
const staffManagementService = new StaffManagementService();

// Supabaseクライアントを作成
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// /active インメモリキャッシュ（TTL: 5分）
let activeEmployeesCache: { data: any[]; expiresAt: number } | null = null;
const ACTIVE_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000;

// jimu-staff / jimu-initials キャッシュ（TTL: 10分）
let jimuStaffCache: { data: { initials: string; name: string; email: string }[]; expiresAt: number } | null = null;
const JIMU_STAFF_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * スタッフスプレッドシートのヘッダー確認用デバッグエンドポイント
 * GET /api/employees/staff-debug
 */
router.get('/staff-debug', async (req: Request, res: Response) => {
  try {
    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const client = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const rows = await client.readAll();
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const sampleRows = rows.map((row: any) => ({
      イニシャル: row['イニシャル'],
      姓名: row['姓名'],
      電話番号: row['電話番号'],
      固定休: row['固定休'],
      メアド: row['メアド'],
      有効: row['有効'],
      事務あり: row['事務あり'],
    }));
    res.json({ headers, sampleRows, totalRows: rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * チャットシートのデバッグ用エンドポイント
 * GET /api/employees/chat-debug
 */
router.get('/chat-debug', async (req: Request, res: Response) => {
  try {
    const staffService = new StaffManagementService();
    staffService.clearCache();
    const staffData = await staffService.fetchStaffData();
    res.json({
      count: staffData.length,
      sample: staffData.slice(0, 10).map(s => ({
        initials: s.initials,
        name: s.name,
        hasWebhook: !!s.chatWebhook,
        webhookPreview: s.chatWebhook?.substring(0, 60),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * メアドから名字を取得（SMS送信者名表示用・認証不要）
 * スタッフアカウントシート E列（メアド）→ C列（名字）
 * GET /api/employees/name-by-email?email=xxx
 */
router.get('/name-by-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const client = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフアカウント',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const rows = await client.readAll();

    // E列「メアド」と照合してC列「名字」を返す
    const matched = rows.find((row: any) => {
      const rowEmail = (row['メアド'] || row['メールアドレス'] || row['email'] || '').trim().toLowerCase();
      return rowEmail === email.trim().toLowerCase();
    });

    if (!matched) {
      return res.json({ name: null });
    }

    const name = matched['名字'] || matched['名前'] || matched['氏名'] || null;
    res.json({ name });
  } catch (error: any) {
    console.error('[name-by-email] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 有効な社員のメールアドレス一覧を取得（Email送信元選択用）
 * GYOSHAユーザーは除外されますが、tenant@ifoo-oita.comは常に含まれます
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    // キャッシュ確認（5分TTL）
    if (activeEmployeesCache && Date.now() < activeEmployeesCache.expiresAt) {
      return res.json({ employees: activeEmployeesCache.data });
    }

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
    activeEmployeesCache = { data: validEmployees, expiresAt: Date.now() + ACTIVE_EMPLOYEES_CACHE_TTL_MS };
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
    // 除外すべき不要なイニシャル（スプシで有効=FALSEのもの）
    const EXCLUDED_INITIALS = ['TENANT', 'GYOSHA', 'tenant', 'gyosha'];
    try {
      const { data: employees, error } = await employeeUtils['table']('employees')
        .select('initials, name')
        .eq('is_active', true)
        .not('initials', 'is', null)
        .order('name');

      if (error) throw error;

      const activeInitials = (employees || [])
        .map((emp: any) => emp.initials)
        .filter((initial: any) => {
          if (!initial || String(initial).trim() === '') return false;
          const val = String(initial).trim();
          // 除外リストに含まれるものを除外
          if (EXCLUDED_INITIALS.includes(val)) return false;
          // 日本語のみのイニシャルを除外（例: 「生」）
          if (/^[\u3040-\u30FF\u4E00-\u9FFF]+$/.test(val)) return false;
          return true;
        });

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
});

/**
 * 通常スタッフのイニシャル一覧を取得（業務リストのスタッフ選択用）
 * スタッフ管理シートの「通常」=TRUEのスタッフを返す
 */
router.get('/normal-initials', async (req: Request, res: Response) => {
  try {
    // スタッフ管理シートの「通常」=TRUEのスタッフのイニシャルを取得
    const normalInitials = await staffManagementService.getNormalInitials();
    console.log(`[normal-initials] Returning ${normalInitials.length} normal staff initials from spreadsheet:`, normalInitials);
    res.json({ initials: normalInitials });
  } catch (error: any) {
    console.error('[normal-initials] Spreadsheet fetch failed, using fallback:', error.message);
    // フォールバック: ハードコードされたデフォルト値
    const fallbackInitials = ['K', 'Y', 'I', 'U', 'R', 'H'];
    res.json({ initials: fallbackInitials });
  }
});

/**
 * メールアドレスからイニシャルを取得（スプシのスタッフシートから）
 * ログインユーザーのイニシャルを確実に取得するために使用
 */
router.get('/initials-by-email', async (req: Request, res: Response) => {
  try {
    // authenticate ミドルウェアが設定した req.employee を直接使用（二重認証を排除）
    const email = req.employee?.email || '';
    if (!email) {
      console.log('[initials-by-email] No email found in req.employee');
      return res.json({ initials: null });
    }

    // DBのinitialsカラムを確認（上部で作成済みのsupabaseクライアントを使用）
    const { data: emp, error: dbError } = await supabase.from('employees').select('initials').ilike('email', email).single();
    if (dbError) {
      console.log(`[initials-by-email] DB lookup failed: ${dbError.message}, falling back to spreadsheet`);
    }
    if (emp?.initials) {
      console.log(`[initials-by-email] DB hit: email=${email} → initials=${emp.initials}`);
      return res.json({ initials: emp.initials });
    }

    // スプシのスタッフシートからメールでイニシャルを取得
    const initials = await staffManagementService.getInitialsByEmail(email);
    console.log(`[initials-by-email] Spreadsheet: email=${email} → initials=${initials}`);
    if (!initials) {
      console.log(`[initials-by-email] No initials found for email: ${email}`);
    }
    res.json({ initials: initials || null });
  } catch (error: any) {
    console.error('[initials-by-email] Failed:', error.message);
    res.json({ initials: null });
  }
});

/**
 * 事務ありスタッフのイニシャル一覧を取得（報告担当選択用）
 * スタッフ管理スプレッドシートの「事務あり」=TRUEのスタッフを返す
 */
router.get('/jimu-initials', async (req: Request, res: Response) => {
  try {
    // キャッシュがあれば返す
    if (jimuStaffCache && Date.now() < jimuStaffCache.expiresAt) {
      const initials = jimuStaffCache.data.map(s => s.initials);
      console.log(`[jimu-initials] Returning ${initials.length} jimu staff initials from cache`);
      return res.json({ initials });
    }
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
 * 事務ありスタッフの一覧（イニシャル + 姓名 + メールアドレス）を取得（報告担当フルネーム表示用）
 * getJimuInitials() と同じ GoogleSheetsClient を使い「事務あり」=TRUE の行を直接取得する。
 * メールアドレスが空欄のスタッフはレスポンスから除外する。
 */
router.get('/jimu-staff', async (req: Request, res: Response) => {
  try {
    // キャッシュがあれば返す
    if (jimuStaffCache && Date.now() < jimuStaffCache.expiresAt) {
      console.log(`[jimu-staff] Returning ${jimuStaffCache.data.length} jimu staff from cache`);
      return res.json({ staff: jimuStaffCache.data });
    }

    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const client = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const rows = await client.readAll();

    const seen = new Set<string>();
    const jimuStaff: { initials: string; name: string; email: string }[] = [];

    for (const row of rows) {
      // 「事務あり」列が TRUE のスタッフのみ対象
      const hasJimu = String(row['事務あり'] || '').toUpperCase() === 'TRUE';
      if (!hasJimu) continue;

      const initials = (row['イニシャル'] || row['スタッフID'] || '').trim();
      if (!initials || seen.has(initials)) continue;

      const name = (row['姓名'] || row['名前'] || row['氏名'] || initials).trim();
      const email = (row['メアド'] || row['メールアドレス'] || row['email'] || '').trim();

      // メールアドレスが空欄のスタッフは除外する
      if (!email) continue;

      seen.add(initials);
      jimuStaff.push({ initials, name, email });
    }

    // キャッシュに保存
    jimuStaffCache = { data: jimuStaff, expiresAt: Date.now() + JIMU_STAFF_CACHE_TTL_MS };

    console.log(`[jimu-staff] Returning ${jimuStaff.length} jimu staff with email`);
    res.json({ staff: jimuStaff });
  } catch (error: any) {
    console.error('[jimu-staff] Failed:', error.message);
    res.status(500).json({ error: 'Failed to get jimu staff' });
  }
});


/**
 * ログインユーザーが営業かどうかを確認
 * スタッフ管理シートのV列「営業」=TRUEかどうかを返す
 * GET /api/employees/is-sales
 */
router.get('/is-sales', async (req: Request, res: Response) => {
  try {
    const email = req.employee?.email || '';
    if (!email) {
      return res.json({ isSales: false });
    }

    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const client = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const rows = await client.readAll();

    const normalizedEmail = email.trim().toLowerCase();
    const matched = rows.find((row: any) => {
      const rowEmail = (row['メアド'] || row['メールアドレス'] || row['email'] || '').trim().toLowerCase();
      return rowEmail === normalizedEmail;
    });

    if (!matched) {
      console.log(`[is-sales] No staff found for email: ${email}`);
      return res.json({ isSales: false });
    }

    const isSales = String(matched['営業'] || '').toUpperCase() === 'TRUE';
    console.log(`[is-sales] email=${email}, isSales=${isSales}`);
    return res.json({ isSales });
  } catch (error: any) {
    console.error('[is-sales] Failed:', error.message);
    // エラー時はfalseを返す（安全側に倒す）
    return res.json({ isSales: false });
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
