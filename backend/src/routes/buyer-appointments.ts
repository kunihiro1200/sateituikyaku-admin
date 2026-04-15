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

      const { buyerNumber, startTime, endTime, assignedTo, buyerName, buyerPhone, buyerEmail, viewingMobile, viewingTypeGeneral, viewingDate, viewingTime, followUpAssignee, propertyAddress, propertyGoogleMapUrl, inquiryHearing, creatorName, customTitle, customDescription, propertyNumber } = req.body;

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
        `買主番号: ${buyerNumber}\n` +
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
        // 1. 物件担当者（sales_assignee）のメールアドレスを取得
        let salesEmployee = null;
        let displayAddress = '（住所未設定）';
        if (propertyNumber) {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee, display_address, address')
            .eq('property_number', propertyNumber)
            .single();

          // display_address → address → '（住所未設定）' のフォールバック
          displayAddress = propertyData?.display_address || propertyData?.address || '（住所未設定）';

          if (propertyData?.sales_assignee) {
            salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
          }
        }

        // sales_assignee が存在しない or メールアドレスなし → スキップ
        if (!salesEmployee?.email) {
          console.log('[BuyerAppointments] No sales_assignee email found, skipping notification email');
        } else {
          // 2. 売主情報を取得（物件番号 = 売主番号）
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

          const subject = `${displayAddress}の内覧入りました！`;
          const body = [
            `内覧担当は${followUpAssignee || assignedTo || ''}です。`,
            `${viewingMobile || viewingTypeGeneral || ''}`,
            `物件所在地${displayAddress}`,
            `内覧日${viewingDate || ''}${viewingTime ? ' ' + viewingTime : ''}`,
            `問合時コメント：${inquiryHearing || 'なし'}`,
            `売主様：${ownerName}様`,
            `所有者連絡先${ownerPhone}`,
            `買主番号：${buyerNumber}`,
            `物件番号：${propertyNumber || 'なし'}`,
          ].join('\n');

          await emailService.sendEmail({ to: [salesEmployee.email], subject, body });
          console.log('[BuyerAppointments] Notification email sent to:', salesEmployee.email);
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
    body('propertyNumber').optional().isString(),
    body('previousViewingDate').optional().isString(),
    body('viewingMobile').optional().isString(),
    body('viewingTypeGeneral').optional().isString(),
    body('followUpAssignee').optional().isString(),
    body('inquiryHearing').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('[BuyerAppointments] POST /cancel-notification - Request received');

      const { buyerNumber, propertyNumber, previousViewingDate, viewingMobile, viewingTypeGeneral, followUpAssignee, inquiryHearing } = req.body;

      // 1. 物件担当者（sales_assignee）のメールアドレスを取得
      let salesEmployee = null;
      let displayAddress = '（住所未設定）';

      if (propertyNumber) {
        const { data: propertyData } = await supabase
          .from('property_listings')
          .select('sales_assignee, display_address, address')
          .eq('property_number', propertyNumber)
          .single();

        // display_address → address → '（住所未設定）' のフォールバック
        displayAddress = propertyData?.display_address || propertyData?.address || '（住所未設定）';

        if (propertyData?.sales_assignee) {
          try {
            salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
          } catch (e) {
            console.warn('[BuyerAppointments] Could not resolve sales_assignee for cancel:', propertyData.sales_assignee);
          }
        }
      }

      // sales_assignee が存在しない or メールアドレスなし → スキップ
      if (!salesEmployee?.email) {
        console.log('[BuyerAppointments] No sales_assignee email found, skipping cancel notification email');
        return res.status(200).json({ success: true, recipients: [] });
      }

      // 2. 売主情報を取得（物件番号 = 売主番号）
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

      const subject = `${displayAddress}の内覧キャンセルです`;
      const body = [
        `内覧担当は${followUpAssignee || ''}でした。`,
        `${viewingMobile || viewingTypeGeneral || ''}`,
        `物件所在地${displayAddress}`,
        `内覧日${previousViewingDate || ''}の予定でしたがキャンセルとなりました。報告書記入の際はお気をつけください。`,
        `問合時コメント：${inquiryHearing || 'なし'}`,
        `売主様：${ownerName}様`,
        `所有者連絡先${ownerPhone}`,
        `買主番号：${buyerNumber}`,
        `物件番号：${propertyNumber || 'なし'}`,
      ].join('\n');

      await emailService.sendEmail({ to: [salesEmployee.email], subject, body });
      console.log('[BuyerAppointments] Cancel notification email sent to:', salesEmployee.email);

      res.status(200).json({ success: true, recipients: [salesEmployee.email] });
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
