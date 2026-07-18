"use strict";
/**
 * 定期カレンダー同期ジョブ
 * 15分ごとに実行して、すべての接続済み従業員のカレンダーを同期
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAllCalendars = syncAllCalendars;
const CalendarSyncService_1 = require("../services/CalendarSyncService");
const GoogleAuthService_1 = require("../services/GoogleAuthService");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
async function syncAllCalendars() {
    console.log('🔄 Starting periodic calendar sync job...');
    console.log(`   Time: ${new Date().toISOString()}`);
    const syncService = new CalendarSyncService_1.CalendarSyncService();
    const authService = new GoogleAuthService_1.GoogleAuthService();
    try {
        // すべての接続済み従業員を取得
        const { data: tokens, error } = await supabase
            .from('google_calendar_tokens')
            .select('employee_id');
        if (error) {
            throw new Error(`Failed to fetch connected employees: ${error.message}`);
        }
        if (!tokens || tokens.length === 0) {
            console.log('   ℹ️ No connected employees found');
            return;
        }
        console.log(`   Found ${tokens.length} connected employees`);
        let successCount = 0;
        let errorCount = 0;
        // 各従業員のカレンダーを同期
        for (const token of tokens) {
            try {
                console.log(`   Syncing employee ${token.employee_id}...`);
                // OAuth2クライアントを取得
                const oauth2Client = await authService.getAuthenticatedClient();
                // リトライ付きで同期
                const result = await syncService.syncWithRetry(token.employee_id, oauth2Client);
                console.log(`   ✅ Synced employee ${token.employee_id}`);
                console.log(`      Deleted: ${result.deletedEvents.length}`);
                console.log(`      Modified: ${result.modifiedEvents.length}`);
                successCount++;
            }
            catch (error) {
                console.error(`   ❌ Failed to sync employee ${token.employee_id}:`, error.message);
                errorCount++;
            }
        }
        console.log('');
        console.log('✅ Periodic calendar sync completed');
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
    }
    catch (error) {
        console.error('❌ Periodic calendar sync failed:', error);
        throw error;
    }
}
// スクリプトとして実行された場合
if (require.main === module) {
    syncAllCalendars()
        .then(() => {
        console.log('🎉 Sync job finished successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Sync job failed:', error);
        process.exit(1);
    });
}
