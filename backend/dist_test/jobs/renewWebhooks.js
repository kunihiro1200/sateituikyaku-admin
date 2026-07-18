"use strict";
/**
 * Webhook更新ジョブ
 * 1日1回実行して、有効期限が24時間以内のWebhookを更新
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
exports.renewExpiringWebhooks = renewExpiringWebhooks;
const CalendarWebhookService_1 = require("../services/CalendarWebhookService");
const GoogleAuthService_1 = require("../services/GoogleAuthService");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '../../.env') });
async function renewExpiringWebhooks() {
    console.log('🔄 Starting webhook renewal job...');
    console.log(`   Time: ${new Date().toISOString()}`);
    const webhookService = new CalendarWebhookService_1.CalendarWebhookService();
    const authService = new GoogleAuthService_1.GoogleAuthService();
    try {
        // 有効期限が24時間以内のWebhookを取得
        const expiringWebhooks = await webhookService.getExpiringWebhooks(24);
        if (expiringWebhooks.length === 0) {
            console.log('   ℹ️ No expiring webhooks found');
            return;
        }
        console.log(`   Found ${expiringWebhooks.length} expiring webhooks`);
        let successCount = 0;
        let errorCount = 0;
        // 各Webhookを更新
        for (const webhook of expiringWebhooks) {
            try {
                console.log(`   Renewing webhook ${webhook.channel_id}...`);
                console.log(`      Employee: ${webhook.employee_id}`);
                console.log(`      Expires: ${webhook.expiration}`);
                // OAuth2クライアントを取得
                const oauth2Client = await authService.getAuthenticatedClient();
                // Webhookを更新
                const newChannel = await webhookService.renewWebhook(webhook.channel_id, oauth2Client);
                console.log(`   ✅ Webhook renewed`);
                console.log(`      New channel: ${newChannel.channel_id}`);
                console.log(`      New expiration: ${newChannel.expiration}`);
                successCount++;
            }
            catch (error) {
                console.error(`   ❌ Failed to renew webhook ${webhook.channel_id}:`, error.message);
                errorCount++;
            }
        }
        console.log('');
        console.log('✅ Webhook renewal completed');
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
    }
    catch (error) {
        console.error('❌ Webhook renewal failed:', error);
        throw error;
    }
}
// スクリプトとして実行された場合
if (require.main === module) {
    renewExpiringWebhooks()
        .then(() => {
        console.log('🎉 Webhook renewal job finished successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Webhook renewal job failed:', error);
        process.exit(1);
    });
}
