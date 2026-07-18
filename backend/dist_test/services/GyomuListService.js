"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GyomuListService = void 0;
const GoogleSheetsClient_1 = require("./GoogleSheetsClient");
/**
 * 業務リストサービス
 *
 * 業務リスト（業務依頼シート）から物件情報を取得します。
 * - スプシURL: 個別物件スプレッドシートURL（おすすめコメント取得用）
 * - 格納先URL: Google DriveフォルダURL（画像URL取得用）
 */
class GyomuListService {
    constructor() {
        this.CACHE_TTL = 5 * 60 * 1000; // 5分
        this.cacheTimestamp = 0;
        const spreadsheetId = process.env.GYOMU_LIST_SPREADSHEET_ID;
        const sheetName = process.env.GYOMU_LIST_SHEET_NAME || '業務依頼';
        if (!spreadsheetId) {
            throw new Error('GYOMU_LIST_SPREADSHEET_ID is not set in environment variables');
        }
        this.sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
            spreadsheetId,
            sheetName,
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        });
        this.cache = new Map();
    }
    /**
     * 物件番号から業務リストデータを取得
     *
     * @param propertyNumber 物件番号
     * @returns 業務リストデータ（スプシURL、格納先URL）
     */
    async getByPropertyNumber(propertyNumber) {
        try {
            // キャッシュチェック
            const cached = this.getCachedData(propertyNumber);
            if (cached) {
                console.log(`[GyomuListService] Cache hit for ${propertyNumber}`);
                return cached;
            }
            // キャッシュが古い場合は全データを再取得
            if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
                await this.refreshCache();
            }
            // キャッシュから取得
            const data = this.cache.get(propertyNumber);
            if (data) {
                console.log(`[GyomuListService] Found data for ${propertyNumber}`);
                return data;
            }
            console.log(`[GyomuListService] No data found for ${propertyNumber}`);
            return null;
        }
        catch (error) {
            console.error(`[GyomuListService] Error getting data for ${propertyNumber}:`, error.message);
            return null;
        }
    }
    /**
     * キャッシュをリフレッシュ
     */
    async refreshCache() {
        try {
            console.log('[GyomuListService] Refreshing cache...');
            await this.sheetsClient.authenticate();
            const allData = await this.sheetsClient.readAll();
            // キャッシュをクリア
            this.cache.clear();
            // 全データをキャッシュに格納
            for (const row of allData) {
                const propertyNumber = row['物件番号'];
                const spreadsheetUrl = row['スプシURL'] || null;
                const storageUrl = row['格納先URL'] || null;
                if (propertyNumber) {
                    this.cache.set(propertyNumber, {
                        propertyNumber,
                        spreadsheetUrl,
                        storageUrl,
                    });
                }
            }
            this.cacheTimestamp = Date.now();
            console.log(`[GyomuListService] Cache refreshed with ${this.cache.size} entries`);
        }
        catch (error) {
            console.error('[GyomuListService] Error refreshing cache:', error.message);
            throw error;
        }
    }
    /**
     * キャッシュからデータを取得
     */
    getCachedData(propertyNumber) {
        // キャッシュが古い場合はnullを返す
        if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
            return null;
        }
        return this.cache.get(propertyNumber) || null;
    }
}
exports.GyomuListService = GyomuListService;
