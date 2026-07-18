"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendedCommentService = void 0;
const GoogleSheetsClient_1 = require("./GoogleSheetsClient");
const GyomuListService_1 = require("./GyomuListService");
const redis_1 = require("../config/redis");
/**
 * おすすめコメント取得サービス
 *
 * 業務リスト（業務依頼シート）の「スプシURL」から個別物件スプレッドシートを取得し、
 * その「athome」シート（または「athome 」シート）から物件タイプに応じたおすすめコメントを取得します。
 *
 * 物件種別に応じて以下のセル範囲から複数のコメントを取得:
 * - 土地: B63:L79
 * - 戸建て: B152:L166
 * - マンション: B149:L163
 */
class RecommendedCommentService {
    constructor() {
        this.cachePrefix = 'recommended-comment:';
        this.cacheTTL = 300; // 5分間（秒）
        this.gyomuListService = new GyomuListService_1.GyomuListService();
    }
    /**
     * 物件番号からおすすめコメントを取得
     *
     * @param propertyNumber 物件番号（例: AA12345）
     * @param propertyType 物件タイプ（土地/戸建て/マンション）
     * @param propertyId 物件ID（UUID、キャッシュ用）
     * @returns おすすめコメント配列と物件タイプ
     */
    async getRecommendedComment(propertyNumber, propertyType, propertyId) {
        try {
            // キャッシュチェック（propertyIdがある場合）
            if (propertyId) {
                const cached = await this.getCachedComment(propertyId);
                if (cached !== null) {
                    console.log(`[RecommendedCommentService] Cache hit for property ${propertyId}`);
                    return cached;
                }
            }
            // 物件タイプに応じたセル範囲を決定
            const cellRange = this.getCellRange(propertyType);
            if (!cellRange) {
                console.log(`[RecommendedCommentService] Unknown property type: ${propertyType} for ${propertyNumber}`);
                const result = { comments: [], propertyType };
                if (propertyId)
                    await this.cacheComment(propertyId, result);
                return result;
            }
            // スプレッドシートからコメントを取得
            const comments = await this.fetchCommentsFromSheet(propertyNumber, cellRange);
            const result = { comments, propertyType };
            // 結果をキャッシュ（propertyIdがある場合）
            if (propertyId) {
                await this.cacheComment(propertyId, result);
            }
            return result;
        }
        catch (error) {
            console.error(`[RecommendedCommentService] Error getting comments for ${propertyNumber}:`, error.message);
            return { comments: [], propertyType };
        }
    }
    /**
     * 物件タイプからセル範囲を取得
     *
     * @param propertyType 物件タイプ
     * @returns セル範囲（例: B63:L79）またはnull
     */
    getCellRange(propertyType) {
        // 物件タイプとセル範囲のマッピング（日本語と英語の両方に対応）
        // B列からL列まで（複数列）のデータを取得
        const cellRangeMap = {
            // 日本語
            '土地': 'B63:L79',
            '戸建て': 'B152:L166',
            '戸建': 'B152:L166',
            'マンション': 'B149:L163',
            // 英語（データベースに保存されている形式）
            'land': 'B63:L79',
            'detached_house': 'B152:L166',
            'apartment': 'B149:L163',
        };
        return cellRangeMap[propertyType] || null;
    }
    /**
     * スプレッドシートからコメント配列を取得（行構造を保持）
     *
     * @param propertyNumber 物件番号
     * @param cellRange セル範囲（例: B63:L79）
     * @returns 行ごとのコメント配列（各行は横並びで表示される）
     */
    async fetchCommentsFromSheet(propertyNumber, cellRange) {
        try {
            // 業務リストから個別物件スプレッドシートURLを取得
            const gyomuData = await this.gyomuListService.getByPropertyNumber(propertyNumber);
            if (!gyomuData || !gyomuData.spreadsheetUrl) {
                console.log(`[RecommendedCommentService] No spreadsheet URL for property ${propertyNumber} in 業務リスト`);
                return [];
            }
            const spreadsheetUrl = gyomuData.spreadsheetUrl;
            // スプレッドシートURLからIDを抽出
            const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
            if (!spreadsheetId) {
                console.warn(`[RecommendedCommentService] Invalid spreadsheet URL: ${spreadsheetUrl}`);
                return [];
            }
            // GoogleSheetsClientを初期化
            const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
            const googleSheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
                spreadsheetId,
                sheetName: 'athome',
                serviceAccountKeyPath,
            });
            // 認証
            await googleSheetsClient.authenticate();
            const sheets = googleSheetsClient.sheets;
            // 指定セル範囲の値を取得
            // シート名は'athome'または'athome 'の可能性があるため、両方試す
            let values = null;
            let lastError = null;
            // 試行する範囲フォーマットのリスト
            const rangeFormats = [
                `athome!${cellRange}`, // スペースなし（引用符なし）
                `'athome '!${cellRange}`, // 末尾にスペース（引用符あり）
            ];
            for (const range of rangeFormats) {
                try {
                    const response = await sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range,
                    });
                    values = response.data.values || [];
                    // 成功したらループを抜ける
                    break;
                }
                catch (error) {
                    lastError = error;
                    // 次の形式を試す
                    continue;
                }
            }
            // すべての形式で失敗した場合
            if (!values && lastError) {
                console.error(`[RecommendedCommentService] Failed to fetch comments for ${propertyNumber} from ${cellRange}:`, lastError.message);
                return [];
            }
            // 行構造を保持しながら、空でないセルのみを含む行配列を作成
            const commentRows = [];
            for (const row of values) {
                if (row && row.length > 0) {
                    // 各行の空でないセルを収集
                    const nonEmptyCells = [];
                    for (let i = 0; i < row.length; i++) {
                        if (row[i]) {
                            const comment = String(row[i]).trim();
                            if (comment) {
                                nonEmptyCells.push(comment);
                            }
                        }
                    }
                    // 空でないセルがある行のみ追加
                    if (nonEmptyCells.length > 0) {
                        commentRows.push(nonEmptyCells);
                    }
                }
            }
            console.log(`[RecommendedCommentService] Fetched ${commentRows.length} rows with comments for ${propertyNumber} from ${cellRange}`);
            return commentRows;
        }
        catch (error) {
            console.error(`[RecommendedCommentService] Failed to fetch comments for ${propertyNumber} from ${cellRange}:`, error.message);
            // エラーが発生しても空配列を返す（グレースフルデグラデーション）
            return [];
        }
    }
    /**
     * スプレッドシートURLからIDを抽出
     *
     * @param url スプレッドシートURL
     * @returns スプレッドシートIDまたはnull
     */
    extractSpreadsheetId(url) {
        try {
            // Google SheetsのURL形式: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
            const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            return match ? match[1] : null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * キャッシュからコメントを取得
     *
     * @param propertyId 物件ID
     * @returns キャッシュされた結果またはnull
     */
    async getCachedComment(propertyId) {
        try {
            const redisClient = (0, redis_1.getRedisClient)();
            const cacheKey = `${this.cachePrefix}${propertyId}`;
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            console.error(`[RecommendedCommentService] Cache read error for ${propertyId}:`, error.message);
            // キャッシュエラーは無視
            return null;
        }
    }
    /**
     * コメントをキャッシュに保存
     *
     * @param propertyId 物件ID
     * @param result コメント結果
     */
    async cacheComment(propertyId, result) {
        try {
            const redisClient = (0, redis_1.getRedisClient)();
            const cacheKey = `${this.cachePrefix}${propertyId}`;
            await redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(result));
        }
        catch (error) {
            console.error(`[RecommendedCommentService] Cache write error for ${propertyId}:`, error.message);
            // キャッシュエラーは無視
        }
    }
}
exports.RecommendedCommentService = RecommendedCommentService;
