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
const supabase_js_1 = require("@supabase/supabase-js");
// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
async function checkWebhookStatus() {
    console.log('🔍 Checking webhook status...\n');
    // Webhookチャンネルを確認
    const { data: channels, error: channelError } = await supabase
        .from('calendar_webhook_channels')
        .select('*');
    if (channelError) {
        console.error('❌ Error fetching webhook channels:', channelError);
    }
    else {
        console.log(`📡 Webhook Channels: ${channels?.length || 0}`);
        if (channels && channels.length > 0) {
            channels.forEach((channel) => {
                console.log(`   - Channel ID: ${channel.channel_id}`);
                console.log(`     Employee ID: ${channel.employee_id}`);
                console.log(`     Expiration: ${channel.expiration}`);
                console.log(`     Expired: ${new Date(channel.expiration) < new Date() ? 'YES' : 'NO'}`);
                console.log('');
            });
        }
        else {
            console.log('   ⚠️ No webhooks registered');
        }
    }
    // Sync tokenを確認
    const { data: tokens, error: tokenError } = await supabase
        .from('calendar_sync_tokens')
        .select('*');
    if (tokenError) {
        console.error('❌ Error fetching sync tokens:', tokenError);
    }
    else {
        console.log(`🔄 Sync Tokens: ${tokens?.length || 0}`);
        if (tokens && tokens.length > 0) {
            tokens.forEach((token) => {
                console.log(`   - Employee ID: ${token.employee_id}`);
                console.log(`     Last Sync: ${token.last_sync_at}`);
                console.log('');
            });
        }
        else {
            console.log('   ℹ️ No sync tokens found');
        }
    }
    // カレンダー接続を確認
    const { data: calendarTokens, error: calendarError } = await supabase
        .from('google_calendar_tokens')
        .select('employee_id');
    if (calendarError) {
        console.error('❌ Error fetching calendar tokens:', calendarError);
    }
    else {
        console.log(`📅 Connected Calendars: ${calendarTokens?.length || 0}`);
        if (calendarTokens && calendarTokens.length > 0) {
            calendarTokens.forEach((token) => {
                console.log(`   - Employee ID: ${token.employee_id}`);
            });
        }
        else {
            console.log('   ⚠️ No calendars connected');
        }
    }
    console.log('\n✅ Check complete');
}
checkWebhookStatus().catch(console.error);
