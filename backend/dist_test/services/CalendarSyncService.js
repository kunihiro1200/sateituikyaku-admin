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
exports.CalendarSyncService = void 0;
const googleapis_1 = require("googleapis");
const BaseRepository_1 = require("../repositories/BaseRepository");
class CalendarSyncService extends BaseRepository_1.BaseRepository {
    constructor() {
        super();
        this.MAX_RETRIES = 5;
        this.INITIAL_BACKOFF_MS = 1000;
    }
    /**
     * Sync tokenを取得
     * @param employeeId 従業員ID
     * @returns Sync token（存在しない場合はnull）
     */
    async getSyncToken(employeeId) {
        try {
            const { data, error } = await this.table('calendar_sync_tokens')
                .select('sync_token')
                .eq('employee_id', employeeId)
                .single();
            if (error || !data) {
                return null;
            }
            return data.sync_token;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Sync tokenを保存
     * @param employeeId 従業員ID
     * @param syncToken 新しいsync token
     */
    async saveSyncToken(employeeId, syncToken) {
        try {
            const { error } = await this.table('calendar_sync_tokens').upsert({
                employee_id: employeeId,
                sync_token: syncToken,
                last_sync_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'employee_id',
            });
            if (error) {
                throw new Error(`Failed to save sync token: ${error.message}`);
            }
            console.log(`✅ Sync token saved for employee ${employeeId}`);
        }
        catch (error) {
            console.error('Failed to save sync token:', error);
            throw error;
        }
    }
    /**
     * カレンダーの変更を増分同期
     * @param employeeId 従業員ID
     * @param oauth2Client 認証済みOAuth2クライアント
     * @returns 同期結果
     */
    async syncCalendarChanges(employeeId, oauth2Client) {
        try {
            console.log(`🔄 Starting calendar sync for employee ${employeeId}`);
            const calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
            const syncToken = await this.getSyncToken(employeeId);
            let response;
            if (syncToken) {
                // 増分同期（sync tokenを使用）
                console.log(`   Using sync token for incremental sync`);
                response = await calendar.events.list({
                    calendarId: 'primary',
                    syncToken: syncToken,
                    maxResults: 100,
                });
            }
            else {
                // 初回同期（sync tokenを取得するため）
                console.log(`   Performing initial sync`);
                response = await calendar.events.list({
                    calendarId: 'primary',
                    maxResults: 2500, // 最大値を指定してsync tokenを取得
                });
            }
            const events = response.data.items || [];
            const nextSyncToken = response.data.nextSyncToken;
            console.log(`   API Response: nextSyncToken=${nextSyncToken ? 'present' : 'missing'}, events=${events.length}`);
            if (!nextSyncToken) {
                // nextPageTokenがある場合は、すべてのページを取得する必要がある
                if (response.data.nextPageToken) {
                    console.log(`   ⚠️ More pages available, fetching all pages...`);
                    let pageToken = response.data.nextPageToken;
                    let allEvents = [...events];
                    while (pageToken) {
                        const pageResponse = await calendar.events.list({
                            calendarId: 'primary',
                            maxResults: 2500,
                            pageToken: pageToken,
                        });
                        allEvents = [...allEvents, ...(pageResponse.data.items || [])];
                        pageToken = pageResponse.data.nextPageToken;
                        if (pageResponse.data.nextSyncToken) {
                            // sync tokenを取得
                            response = pageResponse;
                            break;
                        }
                    }
                    if (!response.data.nextSyncToken) {
                        throw new Error('No sync token received after fetching all pages');
                    }
                }
                else {
                    throw new Error('No sync token received from Google Calendar API');
                }
            }
            // nextSyncTokenが確実に存在することを確認
            if (!response.data.nextSyncToken) {
                throw new Error('No sync token in final response');
            }
            const finalNextSyncToken = response.data.nextSyncToken;
            // イベントを分類
            const deletedEvents = [];
            const modifiedEvents = [];
            const newEvents = [];
            for (const event of events) {
                if (!event.id)
                    continue;
                if (event.status === 'cancelled') {
                    deletedEvents.push(event.id);
                }
                else if (event.updated) {
                    // 既存イベントの更新か新規イベントかを判定
                    // ここでは簡略化のため、すべてmodifiedとして扱う
                    modifiedEvents.push(event.id);
                }
            }
            console.log(`   Found ${deletedEvents.length} deleted events`);
            console.log(`   Found ${modifiedEvents.length} modified events`);
            // 削除されたイベントを処理
            if (deletedEvents.length > 0) {
                await this.processDeletedEvents(deletedEvents);
            }
            // 新しいsync tokenを保存
            await this.saveSyncToken(employeeId, finalNextSyncToken);
            console.log(`✅ Calendar sync completed for employee ${employeeId}`);
            return {
                deletedEvents,
                modifiedEvents,
                newEvents,
                nextSyncToken: finalNextSyncToken,
            };
        }
        catch (error) {
            console.error('Calendar sync error:', error);
            // Sync tokenが無効な場合は削除して再試行を促す
            if (error.message?.includes('Sync token is no longer valid')) {
                console.warn(`⚠️ Invalid sync token, clearing for employee ${employeeId}`);
                await this.clearSyncToken(employeeId);
            }
            throw new Error(`Calendar sync failed: ${error.message}`);
        }
    }
    /**
     * 削除されたイベントを処理
     * @param deletedEventIds 削除されたイベントIDのリスト
     */
    async processDeletedEvents(deletedEventIds) {
        try {
            console.log(`🗑️ Processing ${deletedEventIds.length} deleted events`);
            // CalendarServiceをインポートして使用
            const { CalendarService } = await Promise.resolve().then(() => __importStar(require('./CalendarService')));
            const calendarService = new CalendarService();
            // 各削除イベントに対して予約を削除
            for (const eventId of deletedEventIds) {
                try {
                    await calendarService.deleteAppointmentByCalendarEventId(eventId, 'calendar_sync');
                }
                catch (error) {
                    console.error(`   ⚠️ Failed to delete appointment for event ${eventId}:`, error.message);
                    // 個別のエラーは記録するが、処理は継続
                }
            }
            console.log(`✅ Deleted events processed`);
        }
        catch (error) {
            console.error('Failed to process deleted events:', error);
            throw error;
        }
    }
    /**
     * Sync tokenをクリア
     * @param employeeId 従業員ID
     */
    async clearSyncToken(employeeId) {
        try {
            const { error } = await this.table('calendar_sync_tokens')
                .delete()
                .eq('employee_id', employeeId);
            if (error) {
                console.error(`Failed to clear sync token: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error clearing sync token:', error);
        }
    }
    /**
     * リトライロジック付きで同期を実行
     * @param employeeId 従業員ID
     * @param oauth2Client 認証済みOAuth2クライアント
     * @returns 同期結果
     */
    async syncWithRetry(employeeId, oauth2Client) {
        let lastError = null;
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    // 指数バックオフ: 1s, 2s, 4s, 8s, 16s
                    const backoffMs = this.INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                    console.log(`⏳ Retry attempt ${attempt + 1}/${this.MAX_RETRIES} after ${backoffMs}ms`);
                    await this.sleep(backoffMs);
                }
                return await this.syncCalendarChanges(employeeId, oauth2Client);
            }
            catch (error) {
                lastError = error;
                console.error(`❌ Sync attempt ${attempt + 1} failed:`, error.message);
                // 認証エラーの場合はリトライしない
                if (error.message?.includes('GOOGLE_AUTH_REQUIRED')) {
                    throw error;
                }
            }
        }
        throw new Error(`Calendar sync failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
    }
    /**
     * スリープ
     * @param ms ミリ秒
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * すべての接続済み従業員のカレンダーを同期
     * @returns 同期結果のマップ（従業員ID -> 同期結果）
     */
    async syncAllConnectedEmployees() {
        try {
            console.log(`🔄 Starting sync for all connected employees`);
            // すべての接続済み従業員を取得
            const { data: tokens, error } = await this.table('google_calendar_tokens')
                .select('employee_id');
            if (error) {
                throw new Error(`Failed to fetch connected employees: ${error.message}`);
            }
            if (!tokens || tokens.length === 0) {
                console.log(`   No connected employees found`);
                return new Map();
            }
            console.log(`   Found ${tokens.length} connected employees`);
            const results = new Map();
            // 各従業員のカレンダーを同期
            for (const token of tokens) {
                try {
                    // OAuth2クライアントを取得
                    // この実装はGoogleAuthServiceを使用
                    console.log(`   Syncing employee ${token.employee_id}`);
                    // TODO: 実装
                }
                catch (error) {
                    console.error(`   Failed to sync employee ${token.employee_id}:`, error.message);
                }
            }
            console.log(`✅ Sync completed for all employees`);
            return results;
        }
        catch (error) {
            console.error('Failed to sync all employees:', error);
            throw error;
        }
    }
}
exports.CalendarSyncService = CalendarSyncService;
