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
exports.followUpLogHistoryService = exports.FollowUpLogHistoryService = void 0;
const GoogleSheetsClient_1 = require("./GoogleSheetsClient");
const CacheManager_1 = require("./CacheManager");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 売主追客ログ履歴サービス
 * スプレッドシートから履歴データを取得し、キャッシュ管理を行う
 */
class FollowUpLogHistoryService {
    constructor() {
        this.CACHE_KEY_PREFIX = 'follow-up-log-history';
        this.CACHE_TTL = parseInt(process.env.FOLLOW_UP_LOG_CACHE_TTL || '300'); // 5分
        // 設定ファイルを読み込み
        const configPath = path.join(__dirname, '../config/follow-up-log-history-column-mapping.json');
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // GoogleSheetsClientを初期化
        this.sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
            spreadsheetId: this.config.spreadsheetId,
            sheetName: this.config.sheetName,
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        });
    }
    /**
     * 特定の売主の履歴ログを取得
     * @param sellerNumber 売主番号
     * @param forceRefresh キャッシュをバイパスして強制的に再取得
     * @returns 履歴ログエントリーの配列
     */
    async getHistoricalLogs(sellerNumber, forceRefresh = false) {
        try {
            // キャッシュキーを生成
            const cacheKey = CacheManager_1.cacheManager.generateKey(this.CACHE_KEY_PREFIX, 'all');
            let allEntries;
            if (!forceRefresh) {
                // キャッシュの鮮度をチェック
                const freshness = await CacheManager_1.cacheManager.checkFreshness(cacheKey, this.CACHE_TTL / 60);
                if (!freshness.isStale) {
                    // キャッシュが新鮮な場合、キャッシュから取得
                    const cachedData = await CacheManager_1.cacheManager.get(cacheKey);
                    if (cachedData) {
                        allEntries = cachedData.data;
                        console.log(`[FollowUpLogHistoryService] Cache hit for all entries (age: ${freshness.ageInMinutes.toFixed(2)} minutes)`);
                    }
                    else {
                        // キャッシュが存在しない場合、スプレッドシートから取得
                        allEntries = await this.fetchFromSpreadsheet();
                        await CacheManager_1.cacheManager.set(cacheKey, allEntries, this.CACHE_TTL);
                    }
                }
                else {
                    // キャッシュが古い場合、スプレッドシートから再取得
                    console.log(`[FollowUpLogHistoryService] Cache stale (age: ${freshness.ageInMinutes.toFixed(2)} minutes), fetching from spreadsheet`);
                    allEntries = await this.fetchFromSpreadsheet();
                    await CacheManager_1.cacheManager.set(cacheKey, allEntries, this.CACHE_TTL);
                }
            }
            else {
                // 強制リフレッシュの場合、スプレッドシートから取得
                console.log('[FollowUpLogHistoryService] Force refresh requested');
                allEntries = await this.fetchFromSpreadsheet();
                await CacheManager_1.cacheManager.set(cacheKey, allEntries, this.CACHE_TTL);
            }
            // 売主番号でフィルタリング
            const filteredEntries = this.filterBySellerNumber(allEntries, sellerNumber);
            return filteredEntries;
        }
        catch (error) {
            console.error('[FollowUpLogHistoryService] Error getting historical logs:', error);
            // エラー時はキャッシュから取得を試みる
            try {
                const cacheKey = CacheManager_1.cacheManager.generateKey(this.CACHE_KEY_PREFIX, 'all');
                const cachedData = await CacheManager_1.cacheManager.get(cacheKey);
                if (cachedData) {
                    console.log('[FollowUpLogHistoryService] Returning cached data due to error');
                    const filteredEntries = this.filterBySellerNumber(cachedData.data, sellerNumber);
                    return filteredEntries;
                }
            }
            catch (cacheError) {
                console.error('[FollowUpLogHistoryService] Cache retrieval also failed:', cacheError);
            }
            throw new Error(`Failed to get historical logs: ${error.message}`);
        }
    }
    /**
     * スプレッドシートからすべてのデータを取得
     * @returns 履歴ログエントリーの配列
     */
    async fetchFromSpreadsheet() {
        try {
            console.log('[FollowUpLogHistoryService] Fetching data from spreadsheet');
            // 認証
            await this.sheetsClient.authenticate();
            // すべてのデータを取得
            const rows = await this.sheetsClient.readAll();
            // 各行をエントリーにマッピング
            const entries = [];
            for (const row of rows) {
                try {
                    const entry = this.mapRowToEntry(row);
                    entries.push(entry);
                }
                catch (error) {
                    console.warn('[FollowUpLogHistoryService] Failed to map row:', error.message, row);
                    // 無効な行はスキップして続行
                }
            }
            console.log(`[FollowUpLogHistoryService] Fetched ${entries.length} entries from spreadsheet`);
            // 日付順（降順）にソート
            entries.sort((a, b) => b.date.getTime() - a.date.getTime());
            return entries;
        }
        catch (error) {
            console.error('[FollowUpLogHistoryService] Error fetching from spreadsheet:', error);
            throw new Error(`Failed to fetch from spreadsheet: ${error.message}`);
        }
    }
    /**
     * スプレッドシートの行をエントリーにマッピング
     * @param row スプレッドシートの行データ
     * @returns 履歴ログエントリー
     */
    mapRowToEntry(row) {
        const mapping = this.config.columnMapping;
        // 日付のパース
        const dateValue = row[mapping.date];
        let date;
        if (typeof dateValue === 'string') {
            // "2026/03/16 12:14" のような形式をJSTとして解釈
            const normalized = dateValue.replace(/\//g, '-');
            date = new Date(normalized);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date format: ${dateValue}`);
            }
        }
        else if (typeof dateValue === 'number') {
            // Excelのシリアル日付（小数部分に時刻情報あり）
            date = this.excelDateToJSDate(dateValue);
        }
        else {
            throw new Error(`Invalid date value: ${dateValue}`);
        }
        // ブール値の変換
        const parseBool = (value) => {
            if (typeof value === 'boolean')
                return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase().trim();
                return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'はい' || lower === '○';
            }
            if (typeof value === 'number')
                return value !== 0;
            return false;
        };
        return {
            date,
            followUpLogId: String(row[mapping.followUpLogId] || ''),
            sellerNumber: String(row[mapping.sellerNumber] || ''),
            comment: String(row[mapping.comment] || ''),
            assigneeFirstHalf: String(row[mapping.assigneeFirstHalf] || ''),
            assigneeSecondHalf: String(row[mapping.assigneeSecondHalf] || ''),
            assigneeAll: String(row[mapping.assigneeAll] || ''),
            assigneeHalf: String(row[mapping.assigneeHalf] || ''),
            firstHalfCompleted: parseBool(row[mapping.firstHalfCompleted]),
            secondHalfCompleted: parseBool(row[mapping.secondHalfCompleted]),
            secondCallDueToNoAnswer: String(row[mapping.secondCallDueToNoAnswer] || ''),
        };
    }
    /**
     * Excelのシリアル日付をJavaScript Dateに変換
     * シリアル値の小数部分に時刻情報が含まれるため、時刻も正確に変換する
     * @param serial Excelのシリアル日付（小数部分 = 時刻）
     * @returns JavaScript Date（JST）
     */
    excelDateToJSDate(serial) {
        // Excelのシリアル値はJST（ローカル時刻）で格納されている
        // 25569 = 1970/1/1のExcelシリアル値
        // シリアル値をミリ秒に変換（UTC基準）
        const ms = (serial - 25569) * 86400 * 1000;
        // JSTはUTC+9なので、9時間分を引いてUTCに変換
        const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
        return new Date(ms - JST_OFFSET_MS);
    }
    /**
     * 売主番号でエントリーをフィルタリング
     * @param entries すべてのエントリー
     * @param sellerNumber 売主番号
     * @returns フィルタリングされたエントリー
     */
    filterBySellerNumber(entries, sellerNumber) {
        return entries.filter(entry => entry.sellerNumber === sellerNumber);
    }
    /**
     * キャッシュを無効化
     */
    async invalidateCache() {
        const cacheKey = CacheManager_1.cacheManager.generateKey(this.CACHE_KEY_PREFIX, 'all');
        await CacheManager_1.cacheManager.invalidate(cacheKey);
        console.log('[FollowUpLogHistoryService] Cache invalidated');
    }
    /**
     * キャッシュの最終更新時刻を取得
     */
    async getLastUpdateTime() {
        const cacheKey = CacheManager_1.cacheManager.generateKey(this.CACHE_KEY_PREFIX, 'all');
        return await CacheManager_1.cacheManager.getLastUpdateTime(cacheKey);
    }
}
exports.FollowUpLogHistoryService = FollowUpLogHistoryService;
// シングルトンインスタンス
exports.followUpLogHistoryService = new FollowUpLogHistoryService();
