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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const GoogleAuthService_1 = require("../services/GoogleAuthService");
const CalendarSyncService_1 = require("../services/CalendarSyncService");
// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '../../.env') });
async function testSync() {
    console.log('🔄 Testing calendar sync...\n');
    try {
        const authService = new GoogleAuthService_1.GoogleAuthService();
        const syncService = new CalendarSyncService_1.CalendarSyncService();
        // カレンダーが接続されているか確認
        const isConnected = await authService.isConnected();
        if (!isConnected) {
            console.error('❌ Google Calendar is not connected');
            process.exit(1);
        }
        console.log('✅ Calendar is connected');
        // OAuth2クライアントを取得
        console.log('🔑 Getting authenticated client...');
        const oauth2Client = await authService.getAuthenticatedClient();
        // 会社アカウントIDを取得
        const supabase = syncService['supabase'];
        const { data: admin } = await supabase
            .from('employees')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();
        if (!admin) {
            console.error('❌ No admin user found');
            process.exit(1);
        }
        console.log(`👤 Admin employee ID: ${admin.id}`);
        // 同期を実行
        console.log('\n🔄 Starting sync...');
        const result = await syncService.syncCalendarChanges(admin.id, oauth2Client);
        console.log('\n✅ Sync completed!');
        console.log(`   Deleted events: ${result.deletedEvents.length}`);
        console.log(`   Modified events: ${result.modifiedEvents.length}`);
        console.log(`   New events: ${result.newEvents.length}`);
        if (result.deletedEvents.length > 0) {
            console.log('\n🗑️ Deleted event IDs:');
            result.deletedEvents.forEach((id) => console.log(`   - ${id}`));
        }
        console.log('\n🎉 Test complete!');
    }
    catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        console.error('\nDetails:', error);
        process.exit(1);
    }
}
testSync();
