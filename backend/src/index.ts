import dotenv from 'dotenv';
import path from 'path';

// 譛蛻昴↓迺ｰ蠅・､画焚繧定ｪｭ縺ｿ霎ｼ繧
const envPath = path.resolve(__dirname, '../.env');
console.log('刀 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('笶・Error loading .env file:', result.error);
} else {
  console.log('笨・.env file loaded successfully');
  console.log('泊 All environment variables starting with GMAIL:');
  Object.keys(process.env)
    .filter(key => key.startsWith('GMAIL'))
    .forEach(key => {
      console.log(`  ${key}:`, process.env[key] ? `"${process.env[key]?.substring(0, 20)}..."` : 'Missing');
    });
  console.log('泊 All environment variables starting with GOOGLE_CALENDAR:');
  Object.keys(process.env)
    .filter(key => key.startsWith('GOOGLE_CALENDAR'))
    .forEach(key => {
      console.log(`  ${key}:`, process.env[key] ? `"${process.env[key]?.substring(0, 20)}..."` : 'Missing');
    });
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
import buyerAppointmentRoutes from './routes/buyer-appointments';
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
import propertyListingRoutes from './routes/propertyListings';
import buyerRoutes from './routes/buyers';
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
import { activityLogger } from './middleware/activityLogger';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize connections
const initializeConnections = async () => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('employees').select('count').limit(1);
    if (error) throw error;
    console.log('笨・Supabase connection verified');
  } catch (error) {
    console.error('笞・・Supabase connection test failed, but continuing:', error);
    // Don't exit, allow the server to start
  }

  // Connect to Redis (non-blocking, will fallback to memory store if unavailable)
  try {
    await connectRedis();
    console.log('笨・Session store initialized');
  } catch (error) {
    console.warn('笞・・Redis connection failed, using in-memory session store');
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:5175',
    'http://localhost:3000',  // 繝舌ャ繧ｯ繧ｨ繝ｳ繝芽・霄ｫ繧りｿｽ蜉
    'https://new-admin-management-system-v2.vercel.app',  // 社内管理システムフロントエンド
    'https://property-site-frontend-kappa.vercel.app',  // 譛ｬ逡ｪ迺ｰ蠅・ヵ繝ｭ繝ｳ繝医お繝ｳ繝・    'https://baikyaku-property-site3.vercel.app'  // 譛ｬ逡ｪ迺ｰ蠅・ヰ繝・け繧ｨ繝ｳ繝・  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' })); // 逕ｻ蜒丈ｻ倥″繝｡繝ｼ繝ｫ蟇ｾ蠢懊・縺溘ａ蛻ｶ髯舌ｒ蠅励ｄ縺・app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(activityLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cron Job: 蝠丞粋縺帙ｒ繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝医↓蜷梧悄・・蛻・＃縺ｨ縺ｫ螳溯｡鯉ｼ・// 笞・・驥崎ｦ・ 莉悶・繝ｫ繝ｼ繝医ｈ繧雁燕縺ｫ螳夂ｾｩ・医ｈ繧雁・菴鍋噪縺ｪ繝ｫ繝ｼ繝医ｒ蜆ｪ蜈茨ｼ・app.get('/api/cron/sync-inquiries', async (req, res) => {
  try {
    console.log('[Cron] Starting inquiry sync job...');
    
    // Vercel Cron Job縺ｮ隱崎ｨｼ繝√ぉ繝・け
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[Cron] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // pending迥ｶ諷九・蝠丞粋縺帙ｒ蜿門ｾ暦ｼ域怙螟ｧ10莉ｶ・・    const { data: pendingInquiries, error: fetchError } = await supabase
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
    
    // Google Sheets隱崎ｨｼ
    const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '雋ｷ荳ｻ繝ｪ繧ｹ繝・,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    
    await sheetsClient.authenticate();
    console.log('[Cron] Google Sheets authenticated');
    
    // 譛螟ｧ雋ｷ荳ｻ逡ｪ蜿ｷ繧貞叙蠕・    const { data: latestInquiry } = await supabase
      .from('property_inquiries')
      .select('buyer_number')
      .not('buyer_number', 'is', null)
      .order('buyer_number', { ascending: false })
      .limit(1)
      .single();
    
    let nextBuyerNumber = latestInquiry?.buyer_number ? latestInquiry.buyer_number + 1 : 1;
    
    // 蜷・撫蜷医○繧貞酔譛・    let syncedCount = 0;
    let failedCount = 0;
    
    for (const inquiry of pendingInquiries) {
      try {
        console.log(`[Cron] Syncing inquiry ${inquiry.id} (${inquiry.name})...`);
        
        // 髮ｻ隧ｱ逡ｪ蜿ｷ繧呈ｭ｣隕丞喧
        const normalizedPhone = inquiry.phone.replace(/[^0-9]/g, '');
        
        // 迴ｾ蝨ｨ譎ょ綾繧谷ST・域律譛ｬ譎る俣・峨〒蜿門ｾ・        const nowUtc = new Date(inquiry.created_at);
        const jstDate = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
        const jstDateString = jstDate.toISOString().replace('T', ' ').substring(0, 19);
        
        // 繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝医↓霑ｽ蜉
        const rowData = {
          '雋ｷ荳ｻ逡ｪ蜿ｷ': nextBuyerNumber.toString(),
          '菴懈・譌･譎・: jstDateString,
          '笳乗ｰ丞錐繝ｻ莨夂､ｾ蜷・: inquiry.name,
          '笳丞撫蜷域凾繝偵い繝ｪ繝ｳ繧ｰ': inquiry.message,
          '笳城崕隧ｱ逡ｪ蜿ｷ\n・医ワ繧､繝輔Φ荳崎ｦ・ｼ・: normalizedPhone,
          '笳上Γ繧｢繝・: inquiry.email,
          '笳丞撫蜷医○蜈・: '縺・・縺・峡閾ｪ繧ｵ繧､繝・,
          '迚ｩ莉ｶ逡ｪ蜿ｷ': inquiry.property_number || '',
          '縲仙撫蜷医Γ繝ｼ繝ｫ縲鷹崕隧ｱ蟇ｾ蠢・: '譛ｪ',
        };
        
        await sheetsClient.appendRow(rowData);
        
        // 繝・・繧ｿ繝吶・繧ｹ繧呈峩譁ｰ
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
        
        // 螟ｱ謨励ｒ繝・・繧ｿ繝吶・繧ｹ縺ｫ險倬鹸
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

// Routes
// 隱崎ｨｼ繝ｫ繝ｼ繝茨ｼ医Ο繝ｼ繧ｫ繝ｫ縺ｨ譛ｬ逡ｪ縺ｮ荳｡譁ｹ縺ｫ蟇ｾ蠢懶ｼ・app.use('/auth', authSupabaseRoutes);
app.use('/api/auth', authSupabaseRoutes);  // 譛ｬ逡ｪ迺ｰ蠅・畑
app.use('/api/sellers', sellerRoutes);
app.use('/api/sellers', sellersManagementRoutes);
app.use('/properties', propertyRoutes);
app.use('/api/sellers', valuationRoutes);
app.use('/api/sellers', emailRoutes);
app.use('/api/emails', emailRoutes);  // 逕ｻ蜒乗ｷｻ莉俶ｩ溯・逕ｨ縺ｮ霑ｽ蜉繝ｫ繝ｼ繝・app.use('/api/sellers', followUpRoutes);
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
// 雋ｷ荳ｻ繝ｫ繝ｼ繝医↓隱崎ｨｼ繝溘ラ繝ｫ繧ｦ繧ｧ繧｢繧帝←逕ｨ・医い繧ｯ繝・ぅ繝薙ユ繧｣繝ｭ繧ｰ險倬鹸縺ｮ縺溘ａ・・app.use('/api/buyers', authenticate, buyerRoutes);
app.use('/api', viewingResultRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/sellers', sellerRecoveryRoutes);
app.use('/api/inquiry-response', inquiryResponseRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/public/inquiries', publicInquiriesRoutes); // 蜈ｬ髢狗黄莉ｶ蝠上＞蜷医ｏ縺妁PI・郁ｪ崎ｨｼ荳崎ｦ・ｼ・app.use('/api/public', publicPropertiesRoutes); // 蜈ｬ髢狗黄莉ｶ繧ｵ繧､繝育畑API・郁ｪ崎ｨｼ荳崎ｦ√↑縺ｮ縺ｧ蜈医↓逋ｻ骭ｲ・・app.use('/api/geocode', geocodeRoutes); // 繧ｸ繧ｪ繧ｳ繝ｼ繝・ぅ繝ｳ繧ｰ蠎ｧ讓吩ｿ晏ｭ連PI・郁ｪ崎ｨｼ荳崎ｦ・ｼ・app.use('/api/url-redirect', urlRedirectRoutes); // 遏ｭ邵ｮURL繝ｪ繝繧､繝ｬ繧ｯ繝郁ｧ｣豎ｺAPI・郁ｪ崎ｨｼ荳崎ｦ・ｼ・app.use('/api', inquiryHistoryRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/property-listing-sync', propertyListingSyncRoutes);

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
  
  // SyncQueue繧貞・譛溷喧縺励※SellerService縺ｫ險ｭ螳・  try {
    const { SpreadsheetSyncService } = await import('./services/SpreadsheetSyncService');
    const { GoogleSheetsClient } = await import('./services/GoogleSheetsClient');
    const { SyncQueue } = await import('./services/SyncQueue');
    const { SellerService } = await import('./services/SellerService.supabase');
    
    const sheetsConfig = {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '螢ｲ荳ｻ繝ｪ繧ｹ繝・,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    };
    
    const sheetsClient = new GoogleSheetsClient(sheetsConfig);
    await sheetsClient.authenticate();
    
    const spreadsheetSyncService = new SpreadsheetSyncService(sheetsClient, supabase);
    const syncQueue = new SyncQueue(spreadsheetSyncService);
    
    // SellerService縺ｮ繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺ｫSyncQueue繧定ｨｭ螳・    // Note: SellerService縺ｯ蜷・Ν繝ｼ繝医〒蛟句挨縺ｫ繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ蛹悶＆繧後ｋ縺溘ａ縲・    // 繧ｰ繝ｭ繝ｼ繝舌Ν縺ｪ繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ繧剃ｽ懈・縺励※繧ｨ繧ｯ繧ｹ繝昴・繝医☆繧句ｿ・ｦ√′縺ゅｊ縺ｾ縺・    console.log('笨・SyncQueue initialized and ready');
  } catch (error) {
    console.error('笞・・Failed to initialize SyncQueue:', error);
    // SyncQueue蛻晄悄蛹門､ｱ謨励・閾ｴ蜻ｽ逧・〒縺ｯ縺ｪ縺・・縺ｧ邯夊｡・  }
  
  // Vercel迺ｰ蠅・〒縺ｯ app.listen() 繧貞他縺ｰ縺ｪ縺・  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      console.log(`噫 Server running on port ${PORT}`);
      console.log(`投 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // 蠑ｷ蛹也沿閾ｪ蜍募酔譛溘ｒ髱槫酔譛溘〒螳溯｡鯉ｼ医し繝ｼ繝舌・襍ｷ蜍輔ｒ繝悶Ο繝・け縺励↑縺・ｼ・      // 繝・ヵ繧ｩ繝ｫ繝医〒譛牙柑縲∵・遉ｺ逧・↓false縺ｮ蝣ｴ蜷医・縺ｿ辟｡蜉ｹ
      setTimeout(async () => {
        try {
          const { getEnhancedPeriodicSyncManager, isAutoSyncEnabled } = await import('./services/EnhancedAutoSyncService');
          
          if (!isAutoSyncEnabled()) {
            console.log('投 Auto-sync is disabled (AUTO_SYNC_ENABLED=false)');
            return;
          }
          
          const periodicSyncManager = getEnhancedPeriodicSyncManager();
          await periodicSyncManager.start();
          console.log(`投 Enhanced periodic auto-sync enabled (interval: ${periodicSyncManager.getIntervalMinutes()} minutes)`);
          console.log('   Using full comparison mode - all missing sellers will be detected');
        } catch (error: any) {
          console.error('笞・・Enhanced auto-sync failed (non-blocking):', error.message);
          console.log('   Will retry in 1 minute...');
        }
      }, 10000); // 10遘貞ｾ後↓螳溯｡鯉ｼ医け繧ｩ繝ｼ繧ｿ蛻ｶ髯仙ｯｾ遲厄ｼ・
      // 骭ｲ髻ｳ繝輔ぃ繧､繝ｫ繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・繝ｯ繝ｼ繧ｫ繝ｼ繧定ｵｷ蜍・      setTimeout(async () => {
        try {
          const { getRecordingCleanupWorker } = await import('./jobs/recordingCleanup');
          const cleanupWorker = getRecordingCleanupWorker();
          cleanupWorker.start();
          const config = cleanupWorker.getConfig();
          console.log(`ｧｹ Recording cleanup worker started (schedule: ${config.schedule}, retention: ${config.retentionDays} days)`);
        } catch (error: any) {
          console.error('笞・・Recording cleanup worker failed to start (non-blocking):', error.message);
        }
      }, 10000); // 10遘貞ｾ後↓螳溯｡・
      // 蝠上＞蜷医ｏ縺帛酔譛溘ず繝ｧ繝悶ｒ辟｡蜉ｹ蛹厄ｼ・PI繧ｨ繝ｳ繝峨・繧､繝ｳ繝医°繧臥峩謗･霆｢險倥☆繧九◆繧・ｼ・      // setTimeout(async () => {
      //   try {
      //     const { getInquirySyncJob } = await import('./jobs/inquirySyncJob');
      //     const inquirySyncJob = getInquirySyncJob();
      //     await inquirySyncJob.start(5); // 5蛻・＃縺ｨ縺ｫ螳溯｡・      //     console.log('搭 Inquiry sync job started (interval: 5 minutes)');
      //   } catch (error: any) {
      //     console.error('笞・・Inquiry sync job failed to start (non-blocking):', error.message);
      //   }
      // }, 15000); // 15遘貞ｾ後↓螳溯｡・      console.log('搭 Inquiry sync job disabled (direct sync from API endpoint)');
    });
  } else {
    console.log('噫 Running in Vercel serverless environment');
    console.log(`投 Environment: ${process.env.NODE_ENV || 'production'}`);
  }
};

// Vercel迺ｰ蠅・〒縺ｯ蛻晄悄蛹悶・縺ｿ螳溯｡・if (process.env.VERCEL === '1') {
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
