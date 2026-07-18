"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarService = void 0;
const googleapis_1 = require("googleapis");
const BaseRepository_1 = require("../repositories/BaseRepository");
const types_1 = require("../types");
class CalendarService extends BaseRepository_1.BaseRepository {
    constructor() {
        super();
        this.initializeCalendar();
    }
    /**
     * Google Calendar APIを初期化
     * @param employeeEmail 営担のメールアドレス（オプション）
     */
    initializeCalendar(employeeEmail) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        // 営担のメールアドレスに基づいてリフレッシュトークンを取得
        let refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
        if (employeeEmail) {
            // メールアドレスから環境変数名を生成（例：genta@example.com → GOOGLE_CALENDAR_REFRESH_TOKEN_GENTA）
            const emailPrefix = employeeEmail.split('@')[0].toUpperCase();
            const envVarName = `GOOGLE_CALENDAR_REFRESH_TOKEN_${emailPrefix}`;
            const userSpecificToken = process.env[envVarName];
            if (userSpecificToken) {
                console.log(`✅ Using user-specific refresh token for ${employeeEmail} (${envVarName})`);
                refreshToken = userSpecificToken;
            }
            else {
                console.log(`⚠️ No user-specific refresh token found for ${employeeEmail} (${envVarName}), using default`);
            }
        }
        // リフレッシュトークンを設定
        if (refreshToken) {
            console.log('✅ GOOGLE_CALENDAR_REFRESH_TOKEN is set');
            oauth2Client.setCredentials({
                refresh_token: refreshToken,
            });
        }
        else {
            console.warn('⚠️ GOOGLE_CALENDAR_REFRESH_TOKEN is not set. Calendar events will not be created.');
        }
        this.calendar = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
    }
    /**
     * 訪問査定予約を作成
     */
    async createAppointment(request, sellerName, sellerPhone, propertyAddress, employeeEmail) {
        try {
            // 営担のメールアドレスに基づいてカレンダーAPIを再初期化
            if (employeeEmail) {
                console.log(`🔄 Re-initializing calendar for employee: ${employeeEmail}`);
                this.initializeCalendar(employeeEmail);
            }
            // カレンダーイベントを作成
            const event = await this.createCalendarEvent(request, sellerName, sellerPhone, propertyAddress);
            // データベースに予約を保存
            const { data: appointment, error: appointmentError } = await this.table('appointments')
                .insert({
                seller_id: request.sellerId,
                employee_id: request.employeeId,
                start_time: request.startTime.toISOString(),
                end_time: request.endTime.toISOString(),
                location: request.location,
                calendar_event_id: event.id,
                notes: request.notes,
            })
                .select()
                .single();
            if (appointmentError || !appointment) {
                throw new Error('Failed to create appointment');
            }
            // 売主のステータスを更新
            const { error: statusError } = await this.table('sellers')
                .update({ status: types_1.SellerStatus.APPOINTMENT_SCHEDULED })
                .eq('id', request.sellerId);
            if (statusError) {
                throw new Error('Failed to update seller status');
            }
            return appointment;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * 予約をキャンセル
     */
    async cancelAppointment(appointmentId) {
        try {
            // 予約情報を取得
            const { data: appointment, error: fetchError } = await this.table('appointments')
                .select('*')
                .eq('id', appointmentId)
                .single();
            if (fetchError || !appointment) {
                throw new Error('Appointment not found');
            }
            // カレンダーイベントを削除
            if (appointment.calendar_event_id) {
                await this.deleteCalendarEvent(appointment.calendar_event_id);
            }
            // データベースから予約を削除
            const { error: deleteError } = await this.table('appointments')
                .delete()
                .eq('id', appointmentId);
            if (deleteError) {
                throw new Error('Failed to delete appointment');
            }
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * 予約を更新
     */
    async updateAppointment(appointmentId, updates) {
        try {
            // 既存の予約を取得
            const { data: appointment, error: fetchError } = await this.table('appointments')
                .select('*')
                .eq('id', appointmentId)
                .single();
            if (fetchError || !appointment) {
                throw new Error('Appointment not found');
            }
            // カレンダーイベントを更新
            if (appointment.calendar_event_id) {
                await this.updateCalendarEvent(appointment.calendar_event_id, updates);
            }
            // データベースを更新
            const updateData = {};
            if (updates.startTime)
                updateData.start_time = updates.startTime.toISOString();
            if (updates.endTime)
                updateData.end_time = updates.endTime.toISOString();
            if (updates.location)
                updateData.location = updates.location;
            if (updates.notes !== undefined)
                updateData.notes = updates.notes;
            const { data: updated, error: updateError } = await this.table('appointments')
                .update(updateData)
                .eq('id', appointmentId)
                .select()
                .single();
            if (updateError || !updated) {
                throw new Error('Failed to update appointment');
            }
            return updated;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * カレンダーイベントを作成
     */
    async createCalendarEvent(request, sellerName, sellerPhone, propertyAddress) {
        try {
            const event = {
                summary: `訪問査定: ${sellerName}様`,
                location: request.location,
                description: `
売主: ${sellerName}
電話: ${sellerPhone}
物件住所: ${propertyAddress}
${request.notes ? `\n備考: ${request.notes}` : ''}
      `.trim(),
                start: {
                    dateTime: request.startTime.toISOString(),
                    timeZone: 'Asia/Tokyo',
                },
                end: {
                    dateTime: request.endTime.toISOString(),
                    timeZone: 'Asia/Tokyo',
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 }, // 1日前
                        { method: 'popup', minutes: 30 }, // 30分前
                    ],
                },
            };
            console.log('📅 Creating calendar event:', {
                summary: event.summary,
                start: event.start.dateTime,
                end: event.end.dateTime,
            });
            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });
            console.log('✅ Calendar event created successfully:', response.data.id);
            return response.data;
        }
        catch (error) {
            console.error('❌ Failed to create calendar event:', error);
            console.error('   Error details:', {
                message: error.message,
                code: error.code,
                errors: error.errors,
            });
            throw new Error(`Failed to create calendar event: ${error.message}`);
        }
    }
    /**
     * カレンダーイベントを削除
     */
    async deleteCalendarEvent(eventId) {
        await this.calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId,
        });
    }
    /**
     * カレンダーイベントを更新
     */
    async updateCalendarEvent(eventId, updates) {
        // 既存のイベントを取得
        const event = await this.calendar.events.get({
            calendarId: 'primary',
            eventId: eventId,
        });
        // 更新内容を適用
        const updatedEvent = { ...event.data };
        if (updates.startTime) {
            updatedEvent.start = {
                dateTime: updates.startTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            };
        }
        if (updates.endTime) {
            updatedEvent.end = {
                dateTime: updates.endTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            };
        }
        if (updates.location) {
            updatedEvent.location = updates.location;
        }
        // イベントを更新
        await this.calendar.events.update({
            calendarId: 'primary',
            eventId: eventId,
            requestBody: updatedEvent,
        });
    }
    /**
     * calendar_event_idで予約を検索
     * @param eventId カレンダーイベントID
     * @returns 予約情報（存在しない場合はnull）
     */
    async findAppointmentByCalendarEventId(eventId) {
        try {
            const { data, error } = await this.table('appointments')
                .select('*')
                .eq('calendar_event_id', eventId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // レコードが見つからない場合
                    return null;
                }
                throw new Error(`Failed to find appointment: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            console.error('Error finding appointment by calendar event ID:', error);
            throw error;
        }
    }
    /**
     * calendar_event_idで予約を削除（Google Calendar同期用）
     * @param eventId カレンダーイベントID
     * @param source 削除のソース（'user' | 'calendar_sync'）
     */
    async deleteAppointmentByCalendarEventId(eventId, source = 'calendar_sync') {
        try {
            console.log(`🗑️ Deleting appointment for calendar event: ${eventId}`);
            // 予約を検索
            const appointment = await this.findAppointmentByCalendarEventId(eventId);
            if (!appointment) {
                console.log(`   ℹ️ No appointment found for event ${eventId} - skipping`);
                return;
            }
            console.log(`   Found appointment: ${appointment.id}`);
            // 予約を削除
            const { error: deleteError } = await this.table('appointments')
                .delete()
                .eq('id', appointment.id);
            if (deleteError) {
                throw new Error(`Failed to delete appointment: ${deleteError.message}`);
            }
            // アクティビティログを作成
            const { error: logError } = await this.table('activity_logs').insert({
                seller_id: appointment.sellerId,
                employee_id: appointment.employeeId,
                action: 'appointment_deleted',
                details: {
                    appointment_id: appointment.id,
                    calendar_event_id: eventId,
                    source: source === 'calendar_sync' ? 'Google Calendar Sync' : 'User',
                    deleted_at: new Date().toISOString(),
                },
            });
            if (logError) {
                console.error(`   ⚠️ Failed to create activity log: ${logError.message}`);
                // ログ作成失敗は致命的エラーとしない
            }
            console.log(`✅ Appointment deleted successfully`);
            console.log(`   Source: ${source === 'calendar_sync' ? 'Google Calendar Sync' : 'User'}`);
        }
        catch (error) {
            console.error('Error deleting appointment by calendar event ID:', error);
            throw error;
        }
    }
}
exports.CalendarService = CalendarService;
