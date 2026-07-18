"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffManagementService = void 0;
const googleapis_1 = require("googleapis");
/**
 * スタッフ管理サービス
 * スタッフチャットスプレッドシートのF列からGoogle Chat Webhook URLを取得します。
 * シート: スタッフチャット
 * F列: チャットアドレス（Google Chat Webhook URL）
 */
class StaffManagementService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 0;
        this.CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24時間（Google Sheets APIのクォータ制限対策）
        this.SPREADSHEET_ID = '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs';
        this.SHEET_NAME = 'スタッフ'; // 通常スタッフ情報（イニシャル等）
        this.CHAT_SHEET_NAME = 'スタッフ'; // チャットアドレスも同じシートのF列
    }
    /**
     * Google Sheets APIクライアントを作成（GOOGLE_SERVICE_ACCOUNT_JSONを使用）
     */
    async createSheetsClient() {
        const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!jsonStr) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
        }
        let keyFile;
        try {
            keyFile = JSON.parse(jsonStr);
        }
        catch {
            // Base64の場合はデコード
            keyFile = JSON.parse(Buffer.from(jsonStr, 'base64').toString('utf8'));
        }
        if (!keyFile.private_key.includes('\n')) {
            keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
        }
        const auth = new googleapis_1.google.auth.JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        await auth.authorize();
        return googleapis_1.google.sheets({ version: 'v4', auth });
    }
    /**
     * 担当者名からWebhook URLを取得
     */
    async getWebhookUrl(assigneeName) {
        try {
            const staffData = await this.fetchStaffData();
            console.log('[StaffManagementService] getWebhookUrl:', {
                assigneeName,
                staffCount: staffData.length,
                staffNames: staffData.map(s => ({ initials: s.initials, name: s.name, hasWebhook: !!s.chatWebhook })),
            });
            // 完全一致（イニシャルまたは姓名）→ 部分一致の順で検索
            const staff = staffData.find(s => s.initials === assigneeName || s.name === assigneeName) || staffData.find(s => s.name && s.name.includes(assigneeName)) || staffData.find(s => assigneeName && s.name && assigneeName.includes(s.name));
            if (!staff) {
                return { success: false, error: `担当者「${assigneeName}」が見つかりませんでした` };
            }
            if (!staff.chatWebhook) {
                return { success: false, error: `担当者「${assigneeName}」のChat webhook URLが設定されていません` };
            }
            return { success: true, webhookUrl: staff.chatWebhook };
        }
        catch (error) {
            console.error('[StaffManagementService] Error getting webhook URL:', error.message);
            return { success: false, error: `スタッフ情報の取得に失敗しました: ${error.message}` };
        }
    }
    async fetchStaffData() {
        const now = Date.now();
        if (this.cache.size > 0 && now < this.cacheExpiry) {
            return Array.from(this.cache.values());
        }
        console.log('[StaffManagementService] Fetching staff data from spreadsheet');
        const sheets = await this.createSheetsClient();
        // ヘッダー行を含む全データを取得（A列〜U列）
        // G列: 電話番号, E列: メアド, U列: 固定休 を含めるため範囲を拡張
        // シート名を試す順序: スタッフ → スタッフチャット → Sheet1
        const sheetNamesToTry = [this.SHEET_NAME, 'スタッフチャット', 'Sheet1', 'シート1'];
        let rows = [];
        let usedSheetName = '';
        for (const sheetName of sheetNamesToTry) {
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: this.SPREADSHEET_ID,
                    range: `${sheetName}!A:U`,
                });
                rows = (response.data.values || []);
                usedSheetName = sheetName;
                console.log(`[StaffManagementService] Successfully read sheet: ${sheetName}, rows: ${rows.length}`);
                break;
            }
            catch (e) {
                console.log(`[StaffManagementService] Sheet "${sheetName}" not found, trying next...`);
            }
        }
        if (rows.length === 0) {
            console.log('[StaffManagementService] No data found in any sheet');
            return [];
        }
        // 1行目をヘッダーとして取得
        const headers = rows[0];
        console.log('[StaffManagementService] Headers:', headers);
        // ヘッダーからF列（Chat webhook）のインデックスを特定
        const fColIndex = headers.findIndex((h) => h === 'Chat webhook') !== -1
            ? headers.findIndex((h) => h === 'Chat webhook')
            : 5;
        // ヘッダーから姓名列のインデックスを特定
        const nameColIndex = headers.findIndex((h) => h === '姓名' || h === '名前' || h === '氏名');
        // ヘッダーから電話番号・メアド・固定休のインデックスを特定
        // G列: 電話番号, E列: メアド, U列: 固定休
        const phoneColIndex = headers.findIndex((h) => h === '電話番号');
        const emailColIndex = headers.findIndex((h) => h === 'メアド' || h === 'メールアドレス' || h === 'email');
        const holidayColIndex = headers.findIndex((h) => h === '固定休');
        console.log('[StaffManagementService] Column indices:', { fColIndex, nameColIndex, phoneColIndex, emailColIndex, holidayColIndex, headers });
        const staffData = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0)
                continue;
            // A列: イニシャル
            const initials = row[0]?.trim() || '';
            // 姓名列（D列相当）: フルネーム
            const fullName = nameColIndex >= 0 ? (row[nameColIndex]?.trim() || '') : '';
            // F列: チャットアドレス
            const chatWebhook = row[fColIndex]?.trim() || null;
            // G列: 電話番号
            const phone = phoneColIndex >= 0 ? (row[phoneColIndex]?.trim() || null) : null;
            // E列: メアド
            const email = emailColIndex >= 0 ? (row[emailColIndex]?.trim() || null) : null;
            // U列: 固定休
            const regularHoliday = holidayColIndex >= 0 ? (row[holidayColIndex]?.trim() || null) : null;
            if (!initials && !fullName)
                continue;
            const staff = {
                initials,
                name: fullName || initials,
                chatWebhook: chatWebhook || null,
                isActive: true,
                isNormal: true,
                hasJimu: false,
                phone,
                email,
                regularHoliday,
            };
            staffData.push(staff);
            // イニシャル・フルネーム・姓（最初の2文字）でキャッシュ登録
            if (initials)
                this.cache.set(initials, staff);
            if (fullName) {
                this.cache.set(fullName, staff);
                // 姓のみ（最初の2文字）でも登録（「国広」→「国広智子」にマッチ）
                if (fullName.length >= 2) {
                    const lastName = fullName.substring(0, 2);
                    if (!this.cache.has(lastName)) {
                        this.cache.set(lastName, staff);
                    }
                }
            }
        }
        this.cacheExpiry = now + this.CACHE_DURATION_MS;
        console.log('[StaffManagementService] Fetched staff data:', {
            count: staffData.length,
            headers,
            sample: staffData.slice(0, 5).map(s => ({
                col0: s.initials,
                name: s.name,
                hasWebhook: !!s.chatWebhook,
                webhookPreview: s.chatWebhook?.substring(0, 50),
            })),
        });
        return staffData;
    }
    /**
     * メールアドレスからスタッフIDを取得（fetchStaffData のキャッシュを活用）
     */
    async getInitialsByEmail(email) {
        try {
            const normalizedEmail = email.toLowerCase().trim();
            // fetchStaffData のキャッシュを活用してメールで検索
            const staffList = await this.fetchStaffData();
            const matched = staffList.find(staff => {
                const staffEmail = (staff.email || '').toLowerCase().trim();
                return staffEmail === normalizedEmail;
            });
            if (matched) {
                console.log(`[StaffManagementService] Found initials "${matched.initials}" for email: ${email} (name: ${matched.name})`);
                // 全マッチを確認（デバッグ用）
                const allMatched = staffList.filter(staff => (staff.email || '').toLowerCase().trim() === normalizedEmail);
                if (allMatched.length > 1) {
                    console.warn(`[StaffManagementService] Multiple staff found for email ${email}:`, allMatched.map(s => ({ initials: s.initials, name: s.name, email: s.email })));
                }
                return matched.initials || null;
            }
            console.log(`[StaffManagementService] No staff found for email: ${email}`);
            return null;
        }
        catch (error) {
            console.error('[StaffManagementService] Error getting initials by email:', error.message);
            return null;
        }
    }
    /**
     * 通常スタッフのイニシャル一覧を取得（「スタッフ」シートのI列「通常」=TRUEのもの）
     * normal-initialsエンドポイント用 - チャットシートとは別のシートを使用
     */
    async getActiveInitials() {
        try {
            const { GoogleSheetsClient } = require('./GoogleSheetsClient');
            const client = new GoogleSheetsClient({
                spreadsheetId: this.SPREADSHEET_ID,
                sheetName: this.SHEET_NAME, // 「スタッフ」シート
                serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
            });
            await client.authenticate();
            const rows = await client.readAll();
            const normalInitials = [...new Set(rows
                    .filter((row) => {
                    const hazusuIriRaw = row['外す入'];
                    const hazusuIri = String(hazusuIriRaw).toUpperCase() === 'TRUE';
                    return hazusuIri;
                })
                    .map((row) => (row['スタッフID'] || row['イニシャル']))
                    .filter((i) => i && i.trim() !== ''))];
            console.log('[StaffManagementService] Normal initials (外す入=TRUE):', normalInitials);
            return normalInitials;
        }
        catch (error) {
            console.error('[StaffManagementService] Error getting normal initials:', error.message);
            throw error;
        }
    }
    /**
     * 通常スタッフのイニシャル一覧を取得（「スタッフ」シートの「通常」=TRUEのもの）
     * normal-initialsエンドポイント用
     */
    async getNormalInitials() {
        try {
            const { GoogleSheetsClient } = require('./GoogleSheetsClient');
            const client = new GoogleSheetsClient({
                spreadsheetId: this.SPREADSHEET_ID,
                sheetName: this.SHEET_NAME,
                serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
            });
            await client.authenticate();
            const rows = await client.readAll();
            const normalInitials = [...new Set(rows
                    .filter((row) => {
                    const normalRaw = row['通常'];
                    return String(normalRaw).toUpperCase() === 'TRUE';
                })
                    .map((row) => (row['スタッフID'] || row['イニシャル']))
                    .filter((i) => i && i.trim() !== ''))];
            console.log('[StaffManagementService] Normal initials (通常=TRUE):', normalInitials);
            return normalInitials;
        }
        catch (error) {
            console.error('[StaffManagementService] Error getting normal initials:', error.message);
            throw error;
        }
    }
    /**
     * 事務ありスタッフのイニシャル一覧を取得（「スタッフ」シートの「事務あり」=TRUEのもの）
     */
    async getJimuInitials() {
        try {
            const { GoogleSheetsClient } = require('./GoogleSheetsClient');
            const client = new GoogleSheetsClient({
                spreadsheetId: this.SPREADSHEET_ID,
                sheetName: this.SHEET_NAME, // 「スタッフ」シート
                serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
            });
            await client.authenticate();
            const rows = await client.readAll();
            const jimuInitials = [...new Set(rows
                    .filter((row) => {
                    const hasJimuRaw = row['事務あり'];
                    return String(hasJimuRaw).toUpperCase() === 'TRUE';
                })
                    .map((row) => row['イニシャル'])
                    .filter((i) => i && i.trim() !== ''))];
            return jimuInitials;
        }
        catch (error) {
            console.error('[StaffManagementService] Error getting jimu initials:', error.message);
            throw error;
        }
    }
    async getStaffByInitials(initials) {
        try {
            const staffData = await this.fetchStaffData();
            return staffData.find(s => s.initials === initials) || null;
        }
        catch (error) {
            return null;
        }
    }
    async getStaffByNameContains(namePart) {
        try {
            const staffData = await this.fetchStaffData();
            return staffData.find(s => s.name && s.name.includes(namePart)) || null;
        }
        catch (error) {
            return null;
        }
    }
    clearCache() {
        this.cache.clear();
        this.cacheExpiry = 0;
    }
}
exports.StaffManagementService = StaffManagementService;
