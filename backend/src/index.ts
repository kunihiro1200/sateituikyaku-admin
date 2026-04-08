import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 最初に環境変数を読み込む（Vercel環境では.envファイルは存在しない）
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    console.log('🔧 Loading .env from:', envPath);
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error('❌ Error loading .env file:', result.error);
    } else {
      console.log('✅ .env file loaded successfully');
    }
  }
} catch (e) {
  // Vercel環境では無視
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import supabase from './config/supabase';
import redisClient, { connectRedis } from './config/redis';
import authRoutes from './routes/auth';
import authSupabaseRoutes from './routes/auth.supabase';
import sellerRoutes from './routes/sellers';
import sellersManagementRoutes from './routes/sellersManagement';
import propertyRoutes from './routes/properties';
import valuationRoutes from './routes/valuations';
import emailRoutes from './routes/emails';
import activityLogRoutes from './routes/activityLogs';
import followUpRoutes from './routes/followUps';
import appointmentRoutes from './routes/appointments';
import buyerAppointmentRoutes from './routes/buyer-appointments'; // buyer appointments
import summarizeRoutes from './routes/summarize';
import googleCalendarRoutes from './routes/googleCalendar';
import employeeRoutes from './routes/employees';
import chatNotificationRoutes from './routes/chatNotifications';
import webhookRoutes from './routes/webhooks';
import integrationRoutes from './routes/integration';
import syncRoutes from './routes/sync';
import validationRoutes from './routes/validation';
import cacheRoutes from './routes/cache';
import driveRoutes from './routes/drive';
import workTaskRoutes from './routes/workTasks';
import sharedItemsRoutes from './routes/sharedItems';
import propertyListingRoutes from './routes/propertyListings';
import buyerRoutes from './routes/buyers';
import buyerSidebarCountsRoutes from './routes/buyer-sidebar-counts';
import viewingResultRoutes from './routes/viewingResults';
import callRoutes from './routes/calls';
import sellerRecoveryRoutes from './routes/sellerRecovery';
import inquiryResponseRoutes from './routes/inquiryResponse';
import emailTemplateRoutes from './routes/emailTemplates';
import gmailRoutes from './routes/gmail';
import inquiryHistoryRoutes from './routes/inquiryHistories';
import auditLogRoutes from './routes/auditLogs';
import publicPropertiesRoutes from './routes/publicProperties';
import publicInquiriesRoutes from './routes/publicInquiries';
import propertyListingSyncRoutes from './routes/propertyListingSync';
import geocodeRoutes from './routes/geocode';
import urlRedirectRoutes from './routes/urlRedirect';
import staffSyncRoutes from './routes/staff-sync';
import { activityLogger } from './middleware/activityLogger';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize connections
const initializeConnections = async () => {
  try {
    const { data, error } = await supabase.from('employees').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection verified');
  } catch (error) {
    console.error('⚠️ Supabase connection test failed, but continuing:', error);
  }

  try {
    await connectRedis();
    console.log('✅ Session store initialized');
  } catch (error) {
    console.warn('⚠️ Redis connection failed, using in-memory session store');
  }

  // Vercel環境でもSyncQueueを初期化（DB→スプレッドシート同期のため）
  try {
    const { SpreadsheetSyncService } = await import('./services/SpreadsheetSyncService');
    const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
    const { SyncQueue } = await import('./services/SyncQueue');
    const { SellerService: SellerServiceClass } = await import('./services/SellerService.supabase');

    const sheetsConfig = {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    };

    const sheetsClient = new GoogleSheetsClient(sheetsConfig);
    await sheetsClient.authenticate();

    const spreadsheetSyncService = new SpreadsheetSyncService(sheetsClient, supabase);
    const syncQueue = new SyncQueue(spreadsheetSyncService);
    SellerServiceClass.setSharedSyncQueue(syncQueue);

    console.log('✅ SyncQueue initialized and ready');
  } catch (error) {
    console.error('⚠️ Failed to initialize SyncQueue:', error);
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://new-admin-management-system-v2.vercel.app',
    'https://sateituikyaku-admin-frontend.vercel.app',
    'https://property-site-frontend-kappa.vercel.app',
    'https://baikyaku-property-site3.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(activityLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cron Job: 問い合わせをスプレッドシートに同期（一定ごとに実行）
// ⚠️ 注意: 他のルートより前に設定（より具体的なルートを優先）
app.get('/api/cron/sync-inquiries', async (req, res) => {
  try {
    console.log('[Cron] Starting inquiry sync job...');

    // Vercel Cron Jobの認証チェック
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[Cron] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // pending状態の問い合わせを取得（最大10件）
    const { data: pendingInquiries, error: fetchError } = await supabase
      .from('property_inquiries')
      .select('*')
      .eq('sheet_sync_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[Cron] Error fetching pending inquiries:', fetchError);
      throw fetchError;
    }

    if (!pendingInquiries || pendingInquiries.length === 0) {
      console.log('[Cron] No pending inquiries to sync');
      return res.status(200).json({
        success: true,
        message: 'No pending inquiries',
        synced: 0
      });
    }

    console.log(`[Cron] Found ${pendingInquiries.length} pending inquiries`);

    // Google Sheets認証
    const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();
    console.log('[Cron] Google Sheets authenticated');

    // 最大買主番号を取得
    const { data: latestInquiry } = await supabase
      .from('property_inquiries')
      .select('buyer_number')
      .not('buyer_number', 'is', null)
      .order('buyer_number', { ascending: false })
      .limit(1)
      .single();

    let nextBuyerNumber = latestInquiry?.buyer_number ? latestInquiry.buyer_number + 1 : 1;

    // 各問い合わせを同期
    let syncedCount = 0;
    let failedCount = 0;

    for (const inquiry of pendingInquiries) {
      try {
        console.log(`[Cron] Syncing inquiry ${inquiry.id} (${inquiry.name})...`);

        // 電話番号を正規化
        const normalizedPhone = inquiry.phone.replace(/[^0-9]/g, '');

        // 現在時刻をJST（日本時間）で取得
        const nowUtc = new Date(inquiry.created_at);
        const jstDate = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
        const jstDateString = jstDate.toISOString().replace('T', ' ').substring(0, 19);

        // スプレッドシートに追加
        const rowData = {
          '買主番号': nextBuyerNumber.toString(),
          '作成日時': jstDateString,
          '氏名・名義人名': inquiry.name,
          '問い合わせ時間ヒアリング': inquiry.message,
          '電話番号\n（ハイフン不要）': normalizedPhone,
          'メアド': inquiry.email,
          '問い合わせ元': 'いえいえ自サイト',
          '物件番号': inquiry.property_number || '',
          '「問い合わせメール」査定対応': '未',
        };

        await sheetsClient.appendRow(rowData);

        // データベースを更新
        await supabase
          .from('property_inquiries')
          .update({
            sheet_sync_status: 'synced',
            buyer_number: nextBuyerNumber
          })
          .eq('id', inquiry.id);

        console.log(`[Cron] Synced inquiry ${inquiry.id} with buyer number ${nextBuyerNumber}`);
        syncedCount++;
        nextBuyerNumber++;

      } catch (error) {
        console.error(`[Cron] Failed to sync inquiry ${inquiry.id}:`, error);

        // 失敗をデータベースに記録
        await supabase
          .from('property_inquiries')
          .update({
            sheet_sync_status: 'failed',
            sync_retry_count: (inquiry.sync_retry_count || 0) + 1
          })
          .eq('id', inquiry.id);

        failedCount++;
      }
    }

    console.log(`[Cron] Sync job completed: ${syncedCount} synced, ${failedCount} failed`);

    res.status(200).json({
      success: true,
      synced: syncedCount,
      failed: failedCount,
      total: pendingInquiries.length
    });

  } catch (error: any) {
    console.error('[Cron] Error in sync job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// スタッフ同期エンドポイント（手動実行用）
app.post('/api/cron/sync-staff', async (req, res) => {
  try {
    console.log('[Sync Staff] Starting staff sync job...');

    // CRON_SECRET認証チェック
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[Sync Staff] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // スタッフ管理シートから取得
    const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    
    await sheetsClient.authenticate();
    const rows = await sheetsClient.readAll();
    
    console.log(`[Sync Staff] Fetched ${rows.length} staff records from spreadsheet`);

    let syncedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const initials = row['イニシャル'] || row['スタッフID'] || '';
      const name = row['姓名'] || row['名前'] || '';
      const email = row['メアド'] || row['メールアドレス'] || row['email'] || '';
      
      if (!email || !initials) {
        console.log(`[Sync Staff] Skipping: ${name || initials} (no email or initials)`);
        skippedCount++;
        continue;
      }

      // データベースに既存のレコードがあるか確認
      const { data: existing } = await supabase
        .from('employees')
        .select('id, name, initials')
        .ilike('email', email)
        .single();

      if (existing) {
        // 既存レコードを更新（イニシャルまたは名前が異なる場合のみ）
        if (existing.initials !== initials || existing.name !== name) {
          const { error } = await supabase
            .from('employees')
            .update({
              name: name,
              initials: initials,
            })
            .eq('id', existing.id);

          if (error) {
            console.error(`[Sync Staff] Update failed: ${email} - ${error.message}`);
          } else {
            console.log(`[Sync Staff] Updated: ${email} (${existing.initials} → ${initials})`);
            updatedCount++;
          }
        } else {
          skippedCount++;
        }
      } else {
        // 新規レコードを作成
        const { error } = await supabase
          .from('employees')
          .insert({
            email: email,
            name: name,
            initials: initials,
            is_active: true,
            role: 'agent',
          });

        if (error) {
          console.error(`[Sync Staff] Insert failed: ${email} - ${error.message}`);
        } else {
          console.log(`[Sync Staff] Created: ${email} (${initials})`);
          syncedCount++;
        }
      }
    }

    console.log(`[Sync Staff] Sync completed: ${syncedCount} created, ${updatedCount} updated, ${skippedCount} skipped`);

    res.status(200).json({
      success: true,
      created: syncedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: rows.length
    });

  } catch (error: any) {
    console.error('[Sync Staff] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GASバックフィル用: inquiry_id / inquiry_detailed_datetime / site_url を更新
// CRON_SECRET認証（認証ミドルウェア不要）
app.post('/api/sellers/backfill-inquiry', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { sellerNumber, inquiryId, inquiryDetailedDatetime, siteUrl } = req.body;

    if (!sellerNumber) {
      return res.status(400).json({ error: 'sellerNumber is required' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const updates: any = {};
    if (inquiryId !== undefined && inquiryId !== null && inquiryId !== '') {
      updates.inquiry_id = String(inquiryId);
    }
    if (inquiryDetailedDatetime !== undefined && inquiryDetailedDatetime !== null && inquiryDetailedDatetime !== '') {
      updates.inquiry_detailed_datetime = inquiryDetailedDatetime;
    }
    if (siteUrl !== undefined && siteUrl !== null && siteUrl !== '') {
      updates.site_url = String(siteUrl);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { error } = await db
      .from('sellers')
      .update(updates)
      .eq('seller_number', sellerNumber)
      .is('deleted_at', null);

    if (error) {
      console.error(`[backfill-inquiry] ${sellerNumber}: DB error`, error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[backfill-inquiry] ✅ ${sellerNumber}: updated`, updates);
    res.json({ success: true, sellerNumber, updated: updates });
  } catch (error: any) {
    console.error('[backfill-inquiry] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GAS onEditトリガー用 - スプレッドシートの1行分のデータを受け取ってDBを更新
// ⚠️ 注意: /api/cron/ パスはVercelが保護するため /api/webhook/ パスを使用
app.post('/api/webhook/seller-row', async (req, res) => {
  try {
    // CRON_SECRET認証チェック
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron seller-row] Unauthorized access attempt');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const row = req.body;
    const sellerNumber = row['売主番号'];

    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.startsWith('AA')) {
      return res.status(400).json({ success: false, error: '売主番号が不正です' });
    }

    console.log(`[Cron seller-row] Processing: ${sellerNumber}`);

    const { getEnhancedAutoSyncService } = await import('./services/EnhancedAutoSyncService');
    const syncService = getEnhancedAutoSyncService();
    await syncService.initialize();

    // DBに売主が存在するか確認
    const { data: existing } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('seller_number', sellerNumber)
      .single();

    if (existing) {
      await syncService.updateSingleSeller(sellerNumber, row);
      console.log(`✅ [Cron seller-row] Updated: ${sellerNumber}`);
      res.json({ success: true, action: 'updated', sellerNumber });
    } else {
      await syncService.syncSingleSeller(sellerNumber, row);
      console.log(`✅ [Cron seller-row] Created: ${sellerNumber}`);
      res.json({ success: true, action: 'created', sellerNumber });
    }
  } catch (error: any) {
    console.error('[Cron seller-row] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Routes
app.use('/auth', authSupabaseRoutes);
app.use('/api/auth', authSupabaseRoutes);
// Sidebar counts endpoint (authentication not required) - must be registered before other /api/sellers routes
app.use('/api/sellers', sellerRoutes);
app.use('/api/sellers', sellersManagementRoutes);
app.use('/properties', propertyRoutes);
app.use('/api/sellers', valuationRoutes);
app.use('/api/sellers', emailRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/sellers', followUpRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/api/buyer-appointments', buyerAppointmentRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/summarize', summarizeRoutes);
app.use('/api/auth/google/calendar', googleCalendarRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/chat-notifications', chatNotificationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/sync', syncRoutes);
app.use('/cache', cacheRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/work-tasks', workTaskRoutes);
app.use('/api/property-listings', propertyListingRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/buyer-sidebar-counts', buyerSidebarCountsRoutes);
app.use('/api', viewingResultRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/sellers', sellerRecoveryRoutes);
app.use('/api/inquiry-response', inquiryResponseRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/gmail', authenticate, gmailRoutes);
app.use('/api/shared-items', sharedItemsRoutes); // 共有アイテムAPI（認証不要）
app.use('/api/public/inquiries', publicInquiriesRoutes);
app.use('/api/public', publicPropertiesRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/url-redirect', urlRedirectRoutes);
app.use('/api', inquiryHistoryRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/property-listing-sync', propertyListingSyncRoutes);
app.use('/api/staff-sync', staffSyncRoutes); // スタッフ同期API

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      retryable: false,
    },
  });
});

const startServer = async () => {
  await initializeConnections();

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

      // スタッフ同期を起動時に実行（バックグラウンド）
      setTimeout(async () => {
        try {
          console.log('👥 Starting staff sync on startup...');
          const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
          const sheetsClient = new GoogleSheetsClient({
            spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
            sheetName: 'スタッフ',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
          });
          
          await sheetsClient.authenticate();
          const rows = await sheetsClient.readAll();
          
          let syncedCount = 0;
          let updatedCount = 0;

          for (const row of rows) {
            const initials = row['イニシャル'] || row['スタッフID'] || '';
            const name = row['姓名'] || row['名前'] || '';
            const email = row['メアド'] || row['メールアドレス'] || row['email'] || '';
            
            if (!email || !initials) continue;

            const { data: existing } = await supabase
              .from('employees')
              .select('id, name, initials')
              .ilike('email', email)
              .single();

            if (existing) {
              if (existing.initials !== initials || existing.name !== name) {
                await supabase
                  .from('employees')
                  .update({ name, initials })
                  .eq('id', existing.id);
                updatedCount++;
              }
            } else {
              await supabase
                .from('employees')
                .insert({
                  email,
                  name,
                  initials,
                  is_active: true,
                  role: 'agent',
                });
              syncedCount++;
            }
          }

          console.log(`✅ Staff sync completed: ${syncedCount} created, ${updatedCount} updated`);
        } catch (error: any) {
          console.error('⚠️ Staff sync failed (non-blocking):', error.message);
        }
      }, 5000); // 5秒後に実行

      setTimeout(async () => {
        try {
          const { getEnhancedPeriodicSyncManager, isAutoSyncEnabled } = await import('./services/EnhancedAutoSyncService');

          if (!isAutoSyncEnabled()) {
            console.log('🌍 Auto-sync is disabled (AUTO_SYNC_ENABLED=false)');
            return;
          }

          const periodicSyncManager = getEnhancedPeriodicSyncManager();
          await periodicSyncManager.start();
          console.log(`🌍 Enhanced periodic auto-sync enabled (interval: ${periodicSyncManager.getIntervalMinutes()} minutes)`);
        } catch (error: any) {
          console.error('⚠️ Enhanced auto-sync failed (non-blocking):', error.message);
        }
      }, 10000);

      setTimeout(async () => {
        try {
          const { scheduleRecordingCleanup } = await import('./jobs/recordingCleanup');
          await scheduleRecordingCleanup();
          console.log('🧹 Recording cleanup worker started (schedule: daily at 2:00 AM)');
        } catch (error: any) {
          console.error('⚠️ Recording cleanup worker failed to start (non-blocking):', error.message);
        }
      }, 10000);

      console.log('📭 Inquiry sync job disabled (direct sync from API endpoint)');
    });
  } else {
    console.log('🚀 Running in Vercel serverless environment');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  }
};

if (process.env.VERCEL === '1') {
  initializeConnections().catch((error) => {
    console.error('Failed to initialize connections:', error);
  });
} else {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default app;
