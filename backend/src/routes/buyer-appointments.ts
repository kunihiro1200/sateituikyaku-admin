import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { CalendarService } from '../services/CalendarService.supabase';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { EmployeeUtils } from '../utils/employeeUtils';
import { EmailService } from '../services/EmailService';
import { authenticate } from '../middleware/auth';
import { decrypt } from '../utils/encryption';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const calendarService = new CalendarService();
const googleAuthService = new GoogleAuthService();
const employeeUtils = new EmployeeUtils();
const emailService = new EmailService();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 買主内覧予約を作成
 */
router.post(
  '/',
  [
    body('buyerNumber').isString().withMessage('Invalid buyer number'),
    body('startTime').isISO8601().withMessage('Invalid start time'),
    body('endTime').isISO8601().withMessage('Invalid end time'),
    body('assignedTo').isString().withMessage('Assigned employee is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('[BuyerAppointments] POST /buyer-appointments - Request received');
      console.log('[BuyerAppointments] Request details:', {
        buyerNumber: req.body.buyerNumber,
        assignedTo: req.body.assignedTo,
        creatorEmployeeId: req.employee!.id,
        creatorEmployeeName: req.employee!.name,
        timestamp: new Date().toISOString(),
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('[BuyerAppointments] Validation failed:', errors.array());
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { buyerNumber, startTime, endTime, assignedTo, buyerName, buyerPhone, buyerEmail, viewingMobile, propertyAddress, propertyGoogleMapUrl, inquiryHearing, creatorName, customTitle, customDescription, propertyNumber } = req.body;

      // 後続担当イニシャルから従業員情報を取得
      console.log('[BuyerAppointments] Looking up assigned employee by initials:', assignedTo);
      
      let assignedEmployee;
      try {
        assignedEmployee = await employeeUtils.getEmployeeByInitials(assignedTo);
      } catch (error: any) {
        // 重複イニシャルエラーをキャッチ
        if (error.message && error.message.includes('複数の社員に一致します')) {
          console.error('[BuyerAppointments] Ambiguous initials detected:', error.message);
          return res.status(400).json({
            error: {
              code: 'AMBIGUOUS_INITIALS',
              message: error.message,
              retryable: false,
            },
          });
        }
        throw error;
      }
      
      if (!assignedEmployee) {
        console.error('[BuyerAppointments] Assigned employee not found:', assignedTo);
        return res.status(404).json({
          error: {
            code: 'ASSIGNED_EMPLOYEE_NOT_FOUND',
            message: `後続担当（${assignedTo}）が見つかりません`,
            retryable: false,
          },
        });
      }

      console.log('[BuyerAppointments] Assigned employee resolved:', {
        initials: assignedTo,
        employeeId: assignedEmployee.id,
        employeeName: assignedEmployee.name,
        employeeEmail: assignedEmployee.email,
      });

      // 後続担当がメールアドレスを持っているか検証
      console.log('[BuyerAppointments] Validating assigned employee email');
      if (!assignedEmployee.email) {
        console.error('[BuyerAppointments] Assigned employee email missing:', {
          employeeId: assignedEmployee.id,
          employeeName: assignedEmployee.name,
        });
        return res.status(400).json({
          error: {
            code: 'EMPLOYEE_EMAIL_MISSING',
            message: `後続担当（${assignedEmployee.name}）のメールアドレスが設定されていません`,
            retryable: false,
          },
        });
      }
      console.log('[BuyerAppointments] Assigned employee email validation passed');

      // Google Calendar接続確認
      const isCalendarConnected = await googleAuthService.isConnected();
      if (!isCalendarConnected) {
        console.error('[BuyerAppointments] Google Calendar not connected');
        return res.status(400).json({
          error: {
            code: 'GOOGLE_AUTH_REQUIRED',
            message: `会社アカウント（tenant@ifoo-oita.com）がGoogleカレンダーを接続していません。管理者に連絡してください。`,
            retryable: false,
          },
        });
      }

      // カレンダーイベントを作成
      const defaultTitle = `${viewingMobile || '内覧'} ${propertyAddress || ''} ${buyerName || buyerNumber}`;
      const defaultDescription =
        `物件住所: ${propertyAddress || 'なし'}\n` +
        `GoogleMap: ${propertyGoogleMapUrl || 'なし'}\n` +
        `\n` +
        `お客様名: ${buyerName || buyerNumber}\n` +
        `電話番号: ${buyerPhone || 'なし'}\n` +
        `問合時ヒアリング: ${inquiryHearing || 'なし'}\n` +
        `内覧取得者名: ${creatorName || 'なし'}\n` +
        `\n` +
        `買主詳細ページ:\n${(process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim()}/buyers/${buyerNumber}`;

      const eventData = {
        summary: customTitle || defaultTitle,
        location: propertyAddress || '',
        description: customDescription || defaultDescription,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      };

      console.log('[BuyerAppointments] Creating Google Calendar event');
      console.log('[BuyerAppointments] Event details:', {
        assignedEmployeeId: assignedEmployee.id,
        assignedEmployeeName: assignedEmployee.name,
        assignedEmployeeEmail: assignedEmployee.email,
        startTime: eventData.startTime.toISOString(),
        endTime: eventData.endTime.toISOString(),
      });

      const calendarEventId = await calendarService.createGoogleCalendarEventForEmployee(
        assignedEmployee.id,
        assignedEmployee.email,
        eventData
      );

      console.log('[BuyerAppointments] Calendar event created successfully:', {
        calendarEventId,
        assignedEmployeeId: assignedEmployee.id,
        assignedEmployeeName: assignedEmployee.name,
      });

      // カレンダー登録成功後にメール通知を送信（失敗してもカレンダー登録は成功扱い）
      try {
        const recipients: string[] = [];

        // 1. 後続担当のメールアドレスを追加
        if (assignedEmployee.email) {
          recipients.push(assignedEmployee.email);
        }

        // 2. 物件担当者（sales_assignee）のメールアドレスを取得して追加
        let salesAssigneeInitials = '';
        if (propertyNumber) {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee')
            .eq('property_number', propertyNumber)
            .single();

          if (propertyData?.sales_assignee) {
            salesAssigneeInitials = propertyData.sales_assignee;
            const salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
            if (salesEmployee?.email && salesEmployee.email !== assignedEmployee.email) {
              recipients.push(salesEmployee.email);
            }
          }
        }

        // 3. 売主情報を取得（物件番号 = 売主番号）
        let ownerName = 'なし';
        let ownerPhone = 'なし';
        if (propertyNumber) {
          const { data: sellerData } = await supabase
            .from('sellers')
            .select('name, phone_number')
            .eq('seller_number', propertyNumber)
            .single();
          if (sellerData) {
            try {
              ownerName = sellerData.name ? decrypt(sellerData.name) : 'なし';
            } catch {
              ownerName = sellerData.name || 'なし';
            }
            try {
              ownerPhone = sellerData.phone_number ? decrypt(sellerData.phone_number) : 'なし';
            } catch {
              ownerPhone = sellerData.phone_number || 'なし';
            }
          }
        }

        if (recipients.length > 0) {
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
          const weekday = weekdays[startDate.getDay()];
          const dateStr = `${startDate.getFullYear()}/${startDate.getMonth() + 1}/${startDate.getDate()}`;
          const startTimeStr = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const endTimeStr = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const frontendUrl = (process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim();

          const subject = `${propertyAddress || '物件住所未設定'}の内覧入りました！内覧担当：${assignedEmployee.name}`;
          const body = [
            `内覧担当は${assignedEmployee.name}です。`,
            `${viewingMobile || ''}`,
            `物件所在地「${propertyAddress || 'なし'}」`,
            `内覧日：${dateStr}(${weekday})`,
            `時間：${startTimeStr}〜${endTimeStr}`,
            `問合時コメント：${inquiryHearing || 'なし'}`,
            `売主様：${ownerName}`,
            `所有者連絡先：${ownerPhone}`,
            `買主番号：${buyerNumber}`,
            `物件番号：${propertyNumber || 'なし'}`,
            '',
            `${frontendUrl}/buyers/${buyerNumber}`,
          ].join('\n');

          await emailService.sendEmail({ to: recipients, subject, body });
          console.log('[BuyerAppointments] Notification email sent to:', recipients);
        }
      } catch (emailError: any) {
        // メール送信失敗はログのみ（カレンダー登録の成功に影響させない）
        console.error('[BuyerAppointments] Failed to send notification email (non-fatal):', emailError.message);
      }

      res.status(201).json({
        success: true,
        calendarEventId,
        assignedEmployee: {
          id: assignedEmployee.id,
          name: assignedEmployee.name,
          email: assignedEmployee.email,
        },
      });
    } catch (error: any) {
      console.error('Create buyer appointment error:', error);

      // Google Calendar認証エラー
      if (error.message === 'GOOGLE_AUTH_REQUIRED') {
        console.error('[BuyerAppointments] Google Calendar not connected');
        return res.status(400).json({
          error: {
            code: 'GOOGLE_AUTH_REQUIRED',
            message: `会社アカウント（tenant@ifoo-oita.com）がGoogleカレンダーを接続していません。管理者に連絡してください。`,
            retryable: false,
          },
        });
      }

      // メールアドレス不足エラー
      if (error.message && error.message.includes('メールアドレスが設定されていません')) {
        console.error('[BuyerAppointments] Employee email missing:', error.message);
        return res.status(400).json({
          error: {
            code: 'EMPLOYEE_EMAIL_MISSING',
            message: error.message,
            retryable: false,
          },
        });
      }

      // その他のエラー
      console.error('[BuyerAppointments] Unexpected error:', {
        message: error.message,
        stack: error.stack,
        assignedTo: req.body.assignedTo,
        buyerNumber: req.body.buyerNumber,
        errorCode: error.code,
        errorStatus: error.status,
        errorResponse: error.response?.data,
      });
      
      res.status(500).json({
        error: {
          code: 'CREATE_APPOINTMENT_ERROR',
          message: `カレンダー登録に失敗しました: ${error.message}`,
          details: error.message,
          retryable: true,
        },
      });
    }
  }
);


/**
 * 内覧キャンセル通知メールを送信
 * 内覧日が空欄になった（キャンセルされた）ときに呼び出す
 */
router.post(
  '/cancel-notification',
  [
    body('buyerNumber').isString().withMessage('Invalid buyer number'),
    body('propertyAddress').optional().isString(),
    body('propertyNumber').optional().isString(),
    body('assignedTo').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('[BuyerAppointments] POST /cancel-notification - Request received');

      const { buyerNumber, propertyAddress, propertyNumber, assignedTo, inquiryHearing } = req.body;

      const recipients: string[] = [];

      // 1. 担当者のメールアドレスを追加
      if (assignedTo) {
        try {
          const assignedEmployee = await employeeUtils.getEmployeeByInitials(assignedTo);
          if (assignedEmployee?.email) {
            recipients.push(assignedEmployee.email);
          }
        } catch (e) {
          console.warn('[BuyerAppointments] Could not resolve assignedTo for cancel:', assignedTo);
        }
      }

      // 2. 物件担当者のメールアドレスを追加
      if (propertyNumber) {
        try {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee')
            .eq('property_number', propertyNumber)
            .single();
          if (propertyData?.sales_assignee) {
            const salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
            if (salesEmployee?.email && !recipients.includes(salesEmployee.email)) {
              recipients.push(salesEmployee.email);
            }
          }
        } catch (e) {
          console.warn('[BuyerAppointments] Could not resolve sales_assignee for cancel:', propertyNumber);
        }
      }

      // 3. 国広智子（固定）を追加
      const kunihiroEmail = 'tomoko.kunihiro@ifoo-oita.com';
      if (!recipients.includes(kunihiroEmail)) {
        recipients.push(kunihiroEmail);
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim();

      const subject = `【キャンセル】${propertyAddress || '物件住所未設定'}の内覧がキャンセルされました`;
      const body = [
        `この内覧はキャンセルされました。`,
        ``,
        `${assignedTo || ''}`,
        `物件所在地「${propertyAddress || 'なし'}」`,
        `内覧日：（キャンセル済み）`,
        `問合時コメント：${inquiryHearing || 'なし'}`,
        `買主番号：${buyerNumber}`,
        `物件番号：${propertyNumber || 'なし'}`,
        ``,
        `${frontendUrl}/buyers/${buyerNumber}`,
      ].join('\n');

      await emailService.sendEmail({ to: recipients, subject, body });
      console.log('[BuyerAppointments] Cancel notification email sent to:', recipients);

      res.status(200).json({ success: true, recipients });
    } catch (error: any) {
      console.error('[BuyerAppointments] Failed to send cancel notification:', error.message);
      res.status(500).json({
        error: {
          code: 'CANCEL_NOTIFICATION_ERROR',
          message: error.message,
          retryable: true,
        },
      });
    }
  }
);

export default router;
