"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarWebhookService = void 0;
const googleapis_1 = require("googleapis");
const BaseRepository_1 = require("../repositories/BaseRepository");
const uuid_1 = require("uuid");
class CalendarWebhookService extends BaseRepository_1.BaseRepository {
    constructor() {
        super();
        this.WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
        this.WEBHOOK_TOKEN = process.env.WEBHOOK_VERIFICATION_TOKEN || (0, uuid_1.v4)();
    }
    /**
     * Webhookチャンネルを登録
     * @param employeeId 従業員ID
     * @param oauth2Client 認証済みOAuth2クライアント
     * @returns 登録されたWebhookチャンネル情報
     */
    async registerWebhook(employeeId, oauth2Client) {
        try {
            const calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
            const channelId = (0, uuid_1.v4)();
            const callbackUrl = `${this.WEBHOOK_BASE_URL}/api/webhooks/calendar`;
            console.log(`📡 Registering webhook for employee ${employeeId}`);
            console.log(`   Callback URL: ${callbackUrl}`);
            // Google Calendar APIでWebhookを登録
            const response = await calendar.events.watch({
                calendarId: 'primary',
                requestBody: {
                    id: channelId,
                    type: 'web_hook',
                    address: callbackUrl,
                    token: this.WEBHOOK_TOKEN,
                },
            });
            const { resourceId, expiration } = response.data;
            if (!resourceId || !expiration) {
                throw new Error('Invalid webhook response from Google Calendar API');
            }
            // データベースに保存
            const { data, error } = await this.table('calendar_webhook_channels')
                .insert({
                channel_id: channelId,
                resource_id: resourceId,
                employee_id: employeeId,
                expiration: new Date(parseInt(expiration)).toISOString(),
            })
                .select()
                .single();
            if (error || !data) {
                throw new Error(`Failed to save webhook channel: ${error?.message}`);
            }
            console.log(`✅ Webhook registered successfully for employee ${employeeId}`);
            console.log(`   Channel ID: ${channelId}`);
            console.log(`   Expires: ${new Date(parseInt(expiration)).toISOString()}`);
            return data;
        }
        catch (error) {
            console.error('Failed to register webhook:', error);
            throw new Error(`Webhook registration failed: ${error.message}`);
        }
    }
    /**
     * Webhookチャンネルを更新（期限切れ前に再登録）
     * @param channelId 既存のチャンネルID
     * @param oauth2Client 認証済みOAuth2クライアント
     * @returns 新しいWebhookチャンネル情報
     */
    async renewWebhook(channelId, oauth2Client) {
        try {
            // 既存のチャンネル情報を取得
            const { data: existingChannel, error: fetchError } = await this.table('calendar_webhook_channels')
                .select('*')
                .eq('channel_id', channelId)
                .single();
            if (fetchError || !existingChannel) {
                throw new Error(`Webhook channel not found: ${channelId}`);
            }
            console.log(`🔄 Renewing webhook for employee ${existingChannel.employee_id}`);
            // 既存のWebhookを停止
            await this.unregisterWebhook(channelId, oauth2Client);
            // 新しいWebhookを登録
            const newChannel = await this.registerWebhook(existingChannel.employee_id, oauth2Client);
            console.log(`✅ Webhook renewed successfully`);
            return newChannel;
        }
        catch (error) {
            console.error('Failed to renew webhook:', error);
            throw new Error(`Webhook renewal failed: ${error.message}`);
        }
    }
    /**
     * Webhookチャンネルを削除
     * @param channelId チャンネルID
     * @param oauth2Client 認証済みOAuth2クライアント
     */
    async unregisterWebhook(channelId, oauth2Client) {
        try {
            // データベースからチャンネル情報を取得
            const { data: channel, error: fetchError } = await this.table('calendar_webhook_channels')
                .select('*')
                .eq('channel_id', channelId)
                .single();
            if (fetchError || !channel) {
                console.warn(`⚠️ Webhook channel not found in database: ${channelId}`);
                return;
            }
            console.log(`🗑️ Unregistering webhook ${channelId}`);
            // Google Calendar APIでWebhookを停止
            try {
                const calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
                await calendar.channels.stop({
                    requestBody: {
                        id: channel.channel_id,
                        resourceId: channel.resource_id,
                    },
                });
            }
            catch (apiError) {
                // APIエラーは警告として記録（チャンネルが既に期限切れの場合など）
                console.warn(`⚠️ Failed to stop webhook via API: ${apiError.message}`);
            }
            // データベースから削除
            const { error: deleteError } = await this.table('calendar_webhook_channels')
                .delete()
                .eq('channel_id', channelId);
            if (deleteError) {
                throw new Error(`Failed to delete webhook from database: ${deleteError.message}`);
            }
            console.log(`✅ Webhook unregistered successfully`);
        }
        catch (error) {
            console.error('Failed to unregister webhook:', error);
            throw new Error(`Webhook unregistration failed: ${error.message}`);
        }
    }
    /**
     * Webhook署名を検証
     * @param headers Webhookリクエストヘッダー
     * @returns 検証結果
     */
    async verifyWebhookSignature(headers) {
        try {
            const channelId = headers['x-goog-channel-id'];
            const channelToken = headers['x-goog-channel-token'];
            const resourceId = headers['x-goog-resource-id'];
            if (!channelId || !resourceId) {
                console.warn('⚠️ Missing required webhook headers');
                return false;
            }
            // データベースでチャンネルを確認
            const { data: channel, error } = await this.table('calendar_webhook_channels')
                .select('*')
                .eq('channel_id', channelId)
                .eq('resource_id', resourceId)
                .single();
            if (error || !channel) {
                console.warn(`⚠️ Unknown webhook channel: ${channelId}`);
                return false;
            }
            // トークンが設定されている場合は検証
            if (channelToken && channelToken !== this.WEBHOOK_TOKEN) {
                console.warn(`⚠️ Invalid webhook token for channel: ${channelId}`);
                return false;
            }
            // 有効期限を確認
            const now = new Date();
            const expiration = new Date(channel.expiration);
            if (now > expiration) {
                console.warn(`⚠️ Webhook channel expired: ${channelId}`);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Webhook verification error:', error);
            return false;
        }
    }
    /**
     * Webhook通知を処理
     * @param headers Webhookリクエストヘッダー
     * @param body リクエストボディ
     */
    async handleWebhookNotification(headers, _body) {
        try {
            const resourceState = headers['x-goog-resource-state'];
            const channelId = headers['x-goog-channel-id'];
            const messageNumber = headers['x-goog-message-number'];
            console.log(`📨 Webhook notification received`);
            console.log(`   Channel: ${channelId}`);
            console.log(`   State: ${resourceState}`);
            console.log(`   Message: ${messageNumber}`);
            // 署名を検証
            const isValid = await this.verifyWebhookSignature(headers);
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
            // sync状態は初回通知なのでスキップ
            if (resourceState === 'sync') {
                console.log('   ℹ️ Sync notification - skipping');
                return;
            }
            // exists状態の場合、カレンダーに変更があったことを示す
            if (resourceState === 'exists') {
                console.log('   📅 Calendar changes detected');
                // CalendarSyncServiceを呼び出して変更を同期
                // この実装はタスク3で行う
                console.log('   ⏳ Sync will be implemented in CalendarSyncService');
            }
            console.log(`✅ Webhook notification processed`);
        }
        catch (error) {
            console.error('Failed to handle webhook notification:', error);
            throw error;
        }
    }
    /**
     * 期限切れ間近のWebhookを取得
     * @param hoursBeforeExpiry 有効期限の何時間前か（デフォルト: 24時間）
     * @returns 期限切れ間近のWebhookチャンネルリスト
     */
    async getExpiringWebhooks(hoursBeforeExpiry = 24) {
        try {
            const thresholdDate = new Date();
            thresholdDate.setHours(thresholdDate.getHours() + hoursBeforeExpiry);
            const { data, error } = await this.table('calendar_webhook_channels')
                .select('*')
                .lt('expiration', thresholdDate.toISOString())
                .order('expiration', { ascending: true });
            if (error) {
                throw new Error(`Failed to fetch expiring webhooks: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            console.error('Failed to get expiring webhooks:', error);
            throw error;
        }
    }
    /**
     * 従業員のWebhookチャンネルを取得
     * @param employeeId 従業員ID
     * @returns Webhookチャンネル情報（存在しない場合はnull）
     */
    async getWebhookByEmployeeId(employeeId) {
        try {
            const { data, error } = await this.table('calendar_webhook_channels')
                .select('*')
                .eq('employee_id', employeeId)
                .single();
            if (error) {
                return null;
            }
            return data;
        }
        catch (error) {
            return null;
        }
    }
}
exports.CalendarWebhookService = CalendarWebhookService;
