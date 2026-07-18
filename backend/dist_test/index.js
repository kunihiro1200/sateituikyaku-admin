"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 最初に環境変数を読み込む（Vercel環境では.envファイルは存在しない）
try {
    const envPath = path_1.default.resolve(__dirname, '../.env');
    if (fs_1.default.existsSync(envPath)) {
        console.log('🔧 Loading .env from:', envPath);
        const result = dotenv_1.default.config({ path: envPath });
        if (result.error) {
            console.error('❌ Error loading .env file:', result.error);
        }
        else {
            console.log('✅ .env file loaded successfully');
        }
    }
}
catch (e) {
    // Vercel環境では無視
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const supabase_1 = __importDefault(require("./config/supabase"));
const redis_1 = require("./config/redis");
const auth_supabase_1 = __importDefault(require("./routes/auth.supabase"));
const sellers_1 = __importDefault(require("./routes/sellers"));
const sellersManagement_1 = __importDefault(require("./routes/sellersManagement"));
const properties_1 = __importDefault(require("./routes/properties"));
const valuations_1 = __importDefault(require("./routes/valuations"));
const emails_1 = __importDefault(require("./routes/emails"));
const activityLogs_1 = __importDefault(require("./routes/activityLogs"));
const followUps_1 = __importDefault(require("./routes/followUps"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const buyer_appointments_1 = __importDefault(require("./routes/buyer-appointments")); // buyer appointments
const summarize_1 = __importDefault(require("./routes/summarize"));
const googleCalendar_1 = __importDefault(require("./routes/googleCalendar"));
const employees_1 = __importDefault(require("./routes/employees"));
const chatNotifications_1 = __importDefault(require("./routes/chatNotifications"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const integration_1 = __importDefault(require("./routes/integration"));
const sync_1 = __importDefault(require("./routes/sync"));
const validation_1 = __importDefault(require("./routes/validation"));
const cache_1 = __importDefault(require("./routes/cache"));
const drive_1 = __importDefault(require("./routes/drive"));
const workTasks_1 = __importDefault(require("./routes/workTasks"));
const sharedItems_1 = __importDefault(require("./routes/sharedItems"));
const propertyListings_1 = __importDefault(require("./routes/propertyListings"));
const buyers_1 = __importDefault(require("./routes/buyers"));
const buyer_sidebar_counts_1 = __importDefault(require("./routes/buyer-sidebar-counts"));
const viewingResults_1 = __importDefault(require("./routes/viewingResults"));
const calls_1 = __importDefault(require("./routes/calls"));
const sellerRecovery_1 = __importDefault(require("./routes/sellerRecovery"));
const inquiryResponse_1 = __importDefault(require("./routes/inquiryResponse"));
const emailTemplates_1 = __importDefault(require("./routes/emailTemplates"));
const gmail_1 = __importDefault(require("./routes/gmail"));
const inquiryHistories_1 = __importDefault(require("./routes/inquiryHistories"));
const auditLogs_1 = __importDefault(require("./routes/auditLogs"));
const publicProperties_1 = __importDefault(require("./routes/publicProperties"));
const publicInquiries_1 = __importDefault(require("./routes/publicInquiries"));
const propertyListingSync_1 = __importDefault(require("./routes/propertyListingSync"));
const geocode_1 = __importDefault(require("./routes/geocode"));
const urlRedirect_1 = __importDefault(require("./routes/urlRedirect"));
const staff_sync_1 = __importDefault(require("./routes/staff-sync"));
const nearbyMap_1 = __importDefault(require("./routes/nearbyMap"));
const managementRules_1 = __importDefault(require("./routes/managementRules"));
const mansionJyucho_1 = __importDefault(require("./routes/mansionJyucho"));
const tokiExtract_1 = __importDefault(require("./routes/tokiExtract"));
const propertyPreview_1 = __importDefault(require("./routes/propertyPreview"));
const tateuriPreview_1 = __importDefault(require("./routes/tateuriPreview"));
const scraped_urls_1 = __importDefault(require("./routes/scraped-urls"));
const testEmail_1 = __importDefault(require("./routes/testEmail"));
const aiPropertyEnhance_1 = __importDefault(require("./routes/aiPropertyEnhance"));
const hazardAnalyze_1 = __importDefault(require("./routes/hazardAnalyze"));
const sitemap_1 = __importDefault(require("./routes/sitemap"));
const activityLogger_1 = require("./middleware/activityLogger");
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Initialize connections
const initializeConnections = async () => {
    try {
        const { data, error } = await supabase_1.default.from('employees').select('count').limit(1);
        if (error)
            throw error;
        console.log('✅ Supabase connection verified');
    }
    catch (error) {
        console.error('⚠️ Supabase connection test failed, but continuing:', error);
    }
    try {
        await (0, redis_1.connectRedis)();
        console.log('✅ Session store initialized');
    }
    catch (error) {
        console.warn('⚠️ Redis connection failed, using in-memory session store');
    }
    // Vercel環境でもSyncQueueを初期化（DB→スプレッドシート同期のため）
    try {
        const { SpreadsheetSyncService } = await Promise.resolve().then(() => __importStar(require('./services/SpreadsheetSyncService')));
        const { GoogleSheetsClient } = await Promise.resolve().then(() => __importStar(require('./services/GoogleSheetsClient')));
        const { SyncQueue } = await Promise.resolve().then(() => __importStar(require('./services/SyncQueue')));
        const { SellerService: SellerServiceClass } = await Promise.resolve().then(() => __importStar(require('./services/SellerService.supabase')));
        const sheetsConfig = {
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        };
        const sheetsClient = new GoogleSheetsClient(sheetsConfig);
        await sheetsClient.authenticate();
        const spreadsheetSyncService = new SpreadsheetSyncService(sheetsClient, supabase_1.default);
        const syncQueue = new SyncQueue(spreadsheetSyncService);
        SellerServiceClass.setSharedSyncQueue(syncQueue);
        console.log('✅ SyncQueue initialized and ready');
    }
    catch (error) {
        console.error('⚠️ Failed to initialize SyncQueue:', error);
    }
};
// Middleware
// Helmetの設定を調整（CORSと競合しないように）
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
// CORS設定を最優先で適用
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3000',
        'http://localhost:8080',
        'https://new-admin-management-system-v2.vercel.app',
        'https://sateituikyaku-admin-frontend.vercel.app',
        'https://property-site-frontend-kappa.vercel.app',
        'https://baikyaku-property-site3.vercel.app',
        'https://oita-tateuri.com',
        'https://www.oita-tateuri.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200, // プリフライトリクエストの成功ステータス
};
app.use((0, cors_1.default)(corsOptions));
// プリフライトリクエストを明示的に処理
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(activityLogger_1.activityLogger);
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
        const { data: pendingInquiries, error: fetchError } = await supabase_1.default
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
        const { GoogleSheetsClient } = await Promise.resolve().then(() => __importStar(require('./services/GoogleSheetsClient')));
        const sheetsClient = new GoogleSheetsClient({
            spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID,
            sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        });
        await sheetsClient.authenticate();
        console.log('[Cron] Google Sheets authenticated');
        // 最大買主番号を取得
        const { data: latestInquiry } = await supabase_1.default
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
                await supabase_1.default
                    .from('property_inquiries')
                    .update({
                    sheet_sync_status: 'synced',
                    buyer_number: nextBuyerNumber
                })
                    .eq('id', inquiry.id);
                console.log(`[Cron] Synced inquiry ${inquiry.id} with buyer number ${nextBuyerNumber}`);
                syncedCount++;
                nextBuyerNumber++;
            }
            catch (error) {
                console.error(`[Cron] Failed to sync inquiry ${inquiry.id}:`, error);
                // 失敗をデータベースに記録
                await supabase_1.default
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
    }
    catch (error) {
        console.error('[Cron] Error in sync job:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Cron Job: サイト登録・間取図納期1時間前メール通知（毎時0分に実行）
app.get('/api/cron/business-site-deadline-hourly-notification', async (req, res) => {
    try {
        console.log('[Cron BusinessSiteDeadline] サイト登録・間取図納期通知ジョブ開始');
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron BusinessSiteDeadline] 認証失敗');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { BusinessSiteDeadlineHourlyNotificationService } = await Promise.resolve().then(() => __importStar(require('./services/BusinessSiteDeadlineHourlyNotificationService')));
        const service = new BusinessSiteDeadlineHourlyNotificationService();
        const targets = await service.getTargets();
        console.log(`[Cron BusinessSiteDeadline] 通知対象: ${targets.length}件`);
        if (targets.length === 0) {
            return res.status(200).json({ success: true, sent: 0, failed: 0, skipped: 0 });
        }
        const result = await service.sendNotifications(targets);
        console.log(`[Cron BusinessSiteDeadline] 完了: 送信成功=${result.sent}, 失敗=${result.failed}, スキップ=${result.skipped}`);
        return res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        console.error('[Cron BusinessSiteDeadline] エラー:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Cron Job: 業務リスト締切日当日メール通知（毎日 UTC 00:00 = JST 09:00 に実行）
app.get('/api/cron/work-task-deadline-notification', async (req, res) => {
    try {
        console.log('[Cron WorkTaskDeadline] 業務リスト締切日通知ジョブ開始');
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron WorkTaskDeadline] 認証失敗');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { WorkTaskDeadlineNotificationService } = await Promise.resolve().then(() => __importStar(require('./services/WorkTaskDeadlineNotificationService')));
        const service = new WorkTaskDeadlineNotificationService();
        const targets = await service.getTodayDeadlineTargets();
        console.log(`[Cron WorkTaskDeadline] 当日締切対象: ${targets.length}件`);
        if (targets.length === 0) {
            return res.status(200).json({ success: true, sent: 0, failed: 0, skipped: 0 });
        }
        const result = await service.sendNotifications(targets);
        console.log(`[Cron WorkTaskDeadline] 完了: 送信成功=${result.sent}, 失敗=${result.failed}, スキップ=${result.skipped}`);
        return res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        console.error('[Cron WorkTaskDeadline] エラー:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Cron Job: 業務リスト締切日迫る通知（毎日 UTC 00:00 = JST 09:00 に実行）
// サイト登録締め日2日前・売買契約締め日3日前・媒介作成締め日2日前
app.get('/api/cron/work-task-upcoming-deadline-notification', async (req, res) => {
    try {
        console.log('[Cron WorkTaskUpcomingDeadline] 締切日迫る通知ジョブ開始');
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron WorkTaskUpcomingDeadline] 認証失敗');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { WorkTaskUpcomingDeadlineNotificationService } = await Promise.resolve().then(() => __importStar(require('./services/WorkTaskUpcomingDeadlineNotificationService')));
        const service = new WorkTaskUpcomingDeadlineNotificationService();
        const targets = await service.getTargets();
        console.log(`[Cron WorkTaskUpcomingDeadline] 通知対象: ${targets.length}件`);
        if (targets.length === 0) {
            return res.status(200).json({ success: true, sent: 0, failed: 0, skipped: 0 });
        }
        const result = await service.sendNotifications(targets);
        console.log(`[Cron WorkTaskUpcomingDeadline] 完了: 送信成功=${result.sent}, 失敗=${result.failed}, スキップ=${result.skipped}`);
        return res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        console.error('[Cron WorkTaskUpcomingDeadline] エラー:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Cron Job: 値下げ予約日メール配信（毎日 UTC 00:00 = JST 09:00 に実行）
// ⚠️ 注意: 他のルートより前に設定（より具体的なルートを優先）
app.get('/api/cron/price-reduction-notification', async (req, res) => {
    try {
        console.log('[Cron PriceReduction] 値下げ予約日メール配信ジョブ開始');
        // Vercel Cron Jobの認証チェック
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron PriceReduction] 認証失敗: 不正なアクセス');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // 値下げ予約日メール配信サービスをインポート
        const { PriceReductionNotificationService } = await Promise.resolve().then(() => __importStar(require('./services/PriceReductionNotificationService')));
        const service = new PriceReductionNotificationService();
        // 当日（JST）の値下げ予約対象物件を取得
        const targets = await service.getTodayTargets();
        console.log(`[Cron PriceReduction] 対象物件数: ${targets.length}件`);
        // 対象物件が0件の場合はスキップして正常終了
        if (targets.length === 0) {
            console.log('[Cron PriceReduction] 対象物件なし。メール送信をスキップして終了');
            return res.status(200).json({ success: true, sent: 0, failed: 0 });
        }
        // 各物件へメール通知を送信
        const result = await service.sendNotifications(targets);
        console.log(`[Cron PriceReduction] 完了サマリー: 送信成功=${result.sent}件, 送信失敗=${result.failed}件`);
        return res.status(200).json({
            success: true,
            sent: result.sent,
            failed: result.failed,
        });
    }
    catch (error) {
        console.error('[Cron PriceReduction] 予期しないエラーが発生:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
// Cron Job: 毎月第2土曜日に非公開配信メールを「未」にリセット（毎日 UTC 00:00 = JST 09:00 に実行、第2土曜日のみ処理）
app.get('/api/cron/reset-private-mail-delivery', async (req, res) => {
    try {
        console.log('[Cron PrivateMailDelivery] 非公開配信メールリセットジョブ開始');
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron PrivateMailDelivery] 認証失敗');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // 今日が日本時間で第2土曜日かチェック
        const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const dayOfWeek = nowJST.getUTCDay(); // 0=日, 6=土
        const dayOfMonth = nowJST.getUTCDate();
        // 第2土曜日 = 土曜日(6) かつ 8日〜14日
        const isSecondSaturday = dayOfWeek === 6 && dayOfMonth >= 8 && dayOfMonth <= 14;
        if (!isSecondSaturday) {
            console.log(`[Cron PrivateMailDelivery] 本日は第2土曜日ではないためスキップ (dayOfWeek=${dayOfWeek}, dayOfMonth=${dayOfMonth})`);
            return res.status(200).json({ success: true, skipped: true, reset: 0 });
        }
        console.log('[Cron PrivateMailDelivery] 本日は第2土曜日 - リセット実行');
        const { PropertyListingService } = await Promise.resolve().then(() => __importStar(require('./services/PropertyListingService')));
        const service = new PropertyListingService();
        const result = await service.resetPrivateMailDeliveryForSecondSaturday();
        console.log(`[Cron PrivateMailDelivery] 完了: ${result.reset}件リセット`);
        return res.status(200).json({ success: true, skipped: false, reset: result.reset });
    }
    catch (error) {
        console.error('[Cron PrivateMailDelivery] エラー:', error.message);
        return res.status(500).json({ success: false, error: error.message });
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
        const { GoogleSheetsClient } = await Promise.resolve().then(() => __importStar(require('./services/GoogleSheetsClient')));
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
            const { data: existing } = await supabase_1.default
                .from('employees')
                .select('id, name, initials')
                .ilike('email', email)
                .single();
            if (existing) {
                // 既存レコードを更新（イニシャルまたは名前が異なる場合のみ）
                if (existing.initials !== initials || existing.name !== name) {
                    const { error } = await supabase_1.default
                        .from('employees')
                        .update({
                        name: name,
                        initials: initials,
                    })
                        .eq('id', existing.id);
                    if (error) {
                        console.error(`[Sync Staff] Update failed: ${email} - ${error.message}`);
                    }
                    else {
                        console.log(`[Sync Staff] Updated: ${email} (${existing.initials} → ${initials})`);
                        updatedCount++;
                    }
                }
                else {
                    skippedCount++;
                }
            }
            else {
                // 新規レコードを作成
                const { error } = await supabase_1.default
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
                }
                else {
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
    }
    catch (error) {
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
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const updates = {};
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
    }
    catch (error) {
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
        // 🚨 修正: 任意の2文字アルファベットプレフィックス + 数字の形式に対応
        if (!sellerNumber || typeof sellerNumber !== 'string' || !/^[A-Z]{2}\d+$/.test(sellerNumber)) {
            return res.status(400).json({ success: false, error: '売主番号が不正です' });
        }
        console.log(`[Cron seller-row] Processing: ${sellerNumber}`);
        const { getEnhancedAutoSyncService } = await Promise.resolve().then(() => __importStar(require('./services/EnhancedAutoSyncService')));
        const syncService = getEnhancedAutoSyncService();
        await syncService.initialize();
        // DBに売主が存在するか確認
        const { data: existing } = await supabase_1.default
            .from('sellers')
            .select('seller_number')
            .eq('seller_number', sellerNumber)
            .single();
        if (existing) {
            // 既存売主はスキップ（新規のみ同期ポリシー）
            // スプシで値が変更されてもDBには反映しない。DBでの作業を保護するため。
            console.log(`⏭️ [Cron seller-row] Skipped (existing): ${sellerNumber}`);
            res.json({ success: true, action: 'skipped', sellerNumber });
        }
        else {
            await syncService.syncSingleSeller(sellerNumber, row);
            console.log(`✅ [Cron seller-row] Created: ${sellerNumber}`);
            res.json({ success: true, action: 'created', sellerNumber });
        }
    }
    catch (error) {
        console.error('[Cron seller-row] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// GASのonEditTriggerが呼ぶパス（/api/sync/seller-row）のエイリアス
// GASコードが /api/sync/seller-row を使用しているため、同じ処理を登録
app.post('/api/sync/seller-row', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            console.error('[sync seller-row] Unauthorized access attempt');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const row = req.body;
        const sellerNumber = row['売主番号'];
        if (!sellerNumber || typeof sellerNumber !== 'string' || !/^[A-Z]{2}\d+$/.test(sellerNumber)) {
            return res.status(400).json({ success: false, error: '売主番号が不正です' });
        }
        console.log(`[sync seller-row] Processing: ${sellerNumber}`);
        const { getEnhancedAutoSyncService } = await Promise.resolve().then(() => __importStar(require('./services/EnhancedAutoSyncService')));
        const syncService = getEnhancedAutoSyncService();
        await syncService.initialize();
        const { data: existing } = await supabase_1.default
            .from('sellers')
            .select('seller_number')
            .eq('seller_number', sellerNumber)
            .single();
        if (existing) {
            // 既存売主はスキップ（新規のみ同期ポリシー）
            // スプシで値が変更されてもDBには反映しない。DBでの作業を保護するため。
            console.log(`⏭️ [sync seller-row] Skipped (existing): ${sellerNumber}`);
            res.json({ success: true, action: 'skipped', sellerNumber });
        }
        else {
            await syncService.syncSingleSeller(sellerNumber, row);
            console.log(`✅ [sync seller-row] Created: ${sellerNumber}`);
            res.json({ success: true, action: 'created', sellerNumber });
        }
    }
    catch (error) {
        console.error('[sync seller-row] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Routes
app.use('/auth', auth_supabase_1.default);
app.use('/api/auth', auth_supabase_1.default);
// 認証不要ルート（最優先で登録）
app.use('/api/tateuri', tateuriPreview_1.default); // 建売専門HP（認証不要・公開）
app.use('/api/property-preview', propertyPreview_1.default); // 物件プレビュー（認証不要・公開）
app.use('/api', sitemap_1.default); // サイトマップ（認証不要・公開）
// テスト用エンドポイント（認証不要）
app.get('/api/test/simple', (req, res) => {
    res.json({
        success: true,
        message: 'シンプルテスト成功',
        timestamp: new Date().toISOString(),
    });
});
app.get('/api/test/tateuri-property-count', async (req, res) => {
    try {
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        // 掲載中の建売物件数を取得
        const { count: activeCount, error: activeError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true)
            .eq('is_active', true);
        if (activeError)
            throw activeError;
        // 全建売物件数も取得
        const { count: totalCount, error: totalError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true);
        if (totalError)
            throw totalError;
        // source_urlが設定されている物件数
        const { count: withUrlCount, error: urlError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true)
            .eq('is_active', true)
            .not('source_url', 'is', null)
            .neq('source_url', '');
        if (urlError)
            throw urlError;
        // サンプル物件を5件取得
        const { data: sampleProperties, error: sampleError } = await supabase
            .from('property_previews')
            .select('slug, title, price, address, source_url')
            .eq('is_tateuri', true)
            .eq('is_active', true)
            .limit(5);
        if (sampleError)
            throw sampleError;
        res.json({
            success: true,
            activeProperties: activeCount || 0,
            totalProperties: totalCount || 0,
            propertiesWithUrl: withUrlCount || 0,
            sampleProperties: sampleProperties || [],
            message: `掲載中物件: ${activeCount || 0}件 / 全物件: ${totalCount || 0}件 / URL設定済み: ${withUrlCount || 0}件`,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Test] 物件数確認エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
app.get('/api/test/tateuri-price-check-small', async (req, res) => {
    try {
        console.log('[Test] 建売専門HP価格チェック（小規模テスト）開始');
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        // 最初の10件のみを取得
        const { data: properties, error } = await supabase
            .from('property_previews')
            .select('slug, title, price, address, source_url')
            .eq('is_tateuri', true)
            .eq('is_active', true)
            .not('source_url', 'is', null)
            .neq('source_url', '')
            .limit(10);
        if (error)
            throw error;
        if (!properties || properties.length === 0) {
            return res.json({
                success: true,
                checked: 0,
                changed: 0,
                errors: 0,
                message: 'テスト対象物件なし',
                timestamp: new Date().toISOString(),
            });
        }
        console.log(`[Test] ${properties.length}件をテスト`);
        const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';
        const results = [];
        let errors = 0;
        // 1件ずつ順次処理（テスト用）
        for (const property of properties) {
            try {
                console.log(`[Test] チェック中: ${property.slug}`);
                const res = await fetch(`${scrapeApiUrl}/scrape`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: property.source_url }),
                    signal: AbortSignal.timeout(15000), // 15秒タイムアウト
                });
                const result = {
                    slug: property.slug,
                    title: property.title,
                    currentPrice: property.price,
                    sourceUrl: property.source_url,
                    status: res.status,
                    success: res.ok,
                };
                if (res.ok) {
                    const data = await res.json();
                    result['scrapedPrice'] = data?.data?.price || null;
                    result['scrapedTitle'] = data?.data?.title || null;
                }
                else {
                    result['error'] = `HTTP ${res.status}`;
                }
                results.push(result);
            }
            catch (err) {
                console.error(`[Test] エラー ${property.slug}:`, err.message);
                results.push({
                    slug: property.slug,
                    title: property.title,
                    sourceUrl: property.source_url,
                    error: err.message,
                    success: false,
                });
                errors++;
            }
        }
        console.log(`[Test] 小規模テスト完了: ${properties.length}件, エラー=${errors}件`);
        res.json({
            success: true,
            checked: properties.length,
            errors: errors,
            results: results,
            message: `小規模テスト完了: ${properties.length}件チェック, ${errors}件エラー`,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Test] 小規模テストエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
        });
    }
});
// Sidebar counts endpoint (authentication not required) - must be registered before other /api/sellers routes
app.use('/api/sellers', sellers_1.default);
app.use('/api/sellers', sellersManagement_1.default);
app.use('/properties', properties_1.default);
app.use('/api/sellers', valuations_1.default);
app.use('/api/sellers', emails_1.default);
app.use('/api/emails', emails_1.default);
app.use('/api/sellers', followUps_1.default);
app.use('/appointments', appointments_1.default);
app.use('/api/buyer-appointments', buyer_appointments_1.default);
app.use('/api/activity-logs', activityLogs_1.default);
app.use('/summarize', summarize_1.default);
app.use('/api/summarize', summarize_1.default);
app.use('/api/auth/google/calendar', googleCalendar_1.default);
app.use('/api/employees', employees_1.default);
app.use('/api/chat-notifications', chatNotifications_1.default);
app.use('/api/webhooks', webhooks_1.default);
app.use('/api/integration', integration_1.default);
app.use('/api/sync', sync_1.default);
app.use('/cache', cache_1.default);
app.use('/api/drive', drive_1.default);
app.use('/api/work-tasks', workTasks_1.default);
app.use('/api/property-listings', propertyListings_1.default);
app.use('/api/buyers', buyers_1.default);
app.use('/api/buyer-sidebar-counts', buyer_sidebar_counts_1.default);
app.use('/api', viewingResults_1.default);
app.use('/api/calls', calls_1.default);
app.use('/api/validation', validation_1.default);
app.use('/api/sellers', sellerRecovery_1.default);
app.use('/api/inquiry-response', inquiryResponse_1.default);
app.use('/api/email-templates', emailTemplates_1.default);
app.use('/api/gmail', auth_1.authenticate, gmail_1.default);
app.use('/api/test-email', testEmail_1.default);
app.use('/api/shared-items', sharedItems_1.default); // 共有アイテムAPI（認証不要）
app.use('/api/public/inquiries', publicInquiries_1.default);
app.use('/api/public', publicProperties_1.default);
app.use('/api/geocode', geocode_1.default);
app.use('/api/url-redirect', urlRedirect_1.default);
app.use('/api/management-rules', managementRules_1.default); // 管理規約解析API（認証不要 - /api catchallより前に登録）
app.use('/api/mansion-jyucho', mansionJyucho_1.default); // マンション重調解析API（認証不要 - /api catchallより前に登録）
app.use('/api/toki-extract', tokiExtract_1.default); // 謄本読み取りAPI（認証不要 - /api catchallより前に登録）
app.use('/api/scraped-urls', scraped_urls_1.default); // スクレイピングURL重複チェック（認証不要 - /api catchallより前に登録）
app.use('/api/hazard', hazardAnalyze_1.default); // ハザードマップAI解析（認証不要 - /api catchallより前に登録）
app.use('/api', inquiryHistories_1.default);
app.use('/api/audit-logs', auditLogs_1.default);
app.use('/api/property-listing-sync', propertyListingSync_1.default);
app.use('/api/staff-sync', staff_sync_1.default); // スタッフ同期API
app.use('/api/nearby-map', nearbyMap_1.default); // 近隣MAPapi
app.use('/api/property-preview', propertyPreview_1.default); // 物件プレビュー（認証不要・公開）
app.use('/api/ai', aiPropertyEnhance_1.default); // AI物件情報解析（認証不要）
// Cron Job: 買主の建売専門HP価格変動チェック（毎日実行）
app.post('/api/cron/check-property-prices', async (req, res) => {
    try {
        console.log('[Cron BuyerPriceMonitor] 買主建売専門HP価格チェック開始');
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Cron BuyerPriceMonitor] 認証失敗');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { PropertyPriceMonitorService } = await Promise.resolve().then(() => __importStar(require('./services/PropertyPriceMonitorService')));
        const monitorService = new PropertyPriceMonitorService();
        const changes = await monitorService.checkAllPriceChanges();
        if (changes.length > 0) {
            await monitorService.sendPriceChangeNotification(changes);
        }
        console.log(`[Cron BuyerPriceMonitor] 完了: ${changes.length}件の変更`);
        return res.status(200).json({
            success: true,
            changesCount: changes.length,
            message: `価格変動チェック完了: ${changes.length}件の変更`,
        });
    }
    catch (err) {
        console.error('[Cron BuyerPriceMonitor] エラー:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});
// Error handling middleware
app.use((err, req, res, next) => {
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
                    const { GoogleSheetsClient } = await Promise.resolve().then(() => __importStar(require('./services/GoogleSheetsClient')));
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
                        if (!email || !initials)
                            continue;
                        const { data: existing } = await supabase_1.default
                            .from('employees')
                            .select('id, name, initials')
                            .ilike('email', email)
                            .single();
                        if (existing) {
                            if (existing.initials !== initials || existing.name !== name) {
                                await supabase_1.default
                                    .from('employees')
                                    .update({ name, initials })
                                    .eq('id', existing.id);
                                updatedCount++;
                            }
                        }
                        else {
                            await supabase_1.default
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
                }
                catch (error) {
                    console.error('⚠️ Staff sync failed (non-blocking):', error.message);
                }
            }, 5000); // 5秒後に実行
            setTimeout(async () => {
                try {
                    const { getEnhancedPeriodicSyncManager, isAutoSyncEnabled } = await Promise.resolve().then(() => __importStar(require('./services/EnhancedAutoSyncService')));
                    if (!isAutoSyncEnabled()) {
                        console.log('🌍 Auto-sync is disabled (AUTO_SYNC_ENABLED=false)');
                        return;
                    }
                    const periodicSyncManager = getEnhancedPeriodicSyncManager();
                    await periodicSyncManager.start();
                    console.log(`🌍 Enhanced periodic auto-sync enabled (interval: ${periodicSyncManager.getIntervalMinutes()} minutes)`);
                }
                catch (error) {
                    console.error('⚠️ Enhanced auto-sync failed (non-blocking):', error.message);
                }
            }, 10000);
            setTimeout(async () => {
                try {
                    const { scheduleRecordingCleanup } = await Promise.resolve().then(() => __importStar(require('./jobs/recordingCleanup')));
                    await scheduleRecordingCleanup();
                    console.log('🧹 Recording cleanup worker started (schedule: daily at 2:00 AM)');
                }
                catch (error) {
                    console.error('⚠️ Recording cleanup worker failed to start (non-blocking):', error.message);
                }
            }, 10000);
            console.log('📭 Inquiry sync job disabled (direct sync from API endpoint)');
        });
    }
    else {
        console.log('🚀 Running in Vercel serverless environment');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
    }
};
if (process.env.VERCEL === '1') {
    initializeConnections().catch((error) => {
        console.error('Failed to initialize connections:', error);
    });
}
else {
    startServer().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
exports.default = app;
