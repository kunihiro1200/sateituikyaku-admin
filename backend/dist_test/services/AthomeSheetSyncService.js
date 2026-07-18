"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AthomeSheetSyncService = void 0;
// Athomeシートからコメントデータを同期するサービス
const googleapis_1 = require("googleapis");
const supabase_js_1 = require("@supabase/supabase-js");
const PropertyDetailsService_1 = require("./PropertyDetailsService");
/**
 * 物件種別に応じたセル位置マッピング
 *
 * 参照: ATHOME_SHEET_CELL_MAPPING.md
 */
const CELL_MAPPING = {
    land: {
        favoriteComment: 'B53',
        recommendedComments: 'B63:L79',
    },
    detached_house: {
        favoriteComment: 'B142',
        recommendedComments: 'B152:L166',
    },
    apartment: {
        favoriteComment: 'B150',
        recommendedComments: 'B149:L163',
    },
};
class AthomeSheetSyncService {
    constructor() {
        // Vercel環境では環境変数から、ローカル環境ではファイルから認証情報を取得
        let credentials;
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            // Vercel環境：環境変数から取得
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        }
        else {
            // ローカル環境：ファイルから取得
            const fs = require('fs');
            const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
            credentials = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf-8'));
        }
        const auth = new googleapis_1.google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        this.propertyDetailsService = new PropertyDetailsService_1.PropertyDetailsService();
    }
    /**
     * 業務リストから個別物件スプレッドシートのIDを取得
     */
    async getIndividualSpreadsheetId(propertyNumber) {
        try {
            const gyomuListSpreadsheetId = process.env.GYOMU_LIST_SPREADSHEET_ID;
            if (!gyomuListSpreadsheetId) {
                console.error('[AthomeSheetSyncService] GYOMU_LIST_SPREADSHEET_ID not found in environment');
                return null;
            }
            // 業務リストの「業務依頼」シートから物件番号で検索
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: gyomuListSpreadsheetId,
                range: '業務依頼!A:D', // A列（物件番号）からD列（スプシURL）まで
            });
            const rows = response.data.values || [];
            // 物件番号で検索（A列）
            for (const row of rows) {
                if (row[0] === propertyNumber) {
                    const spreadsheetUrl = row[3]; // D列（スプシURL）
                    if (spreadsheetUrl) {
                        // URLからスプレッドシートIDを抽出
                        const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                        if (match) {
                            console.log(`[AthomeSheetSyncService] Found spreadsheet ID for ${propertyNumber}: ${match[1]}`);
                            return match[1];
                        }
                    }
                }
            }
            console.log(`[AthomeSheetSyncService] Spreadsheet URL not found for ${propertyNumber}`);
            return null;
        }
        catch (error) {
            console.error(`[AthomeSheetSyncService] Error getting spreadsheet ID for ${propertyNumber}:`, error.message);
            return null;
        }
    }
    /**
     * Athomeシートからコメントデータを取得
     */
    async fetchCommentsFromAthomeSheet(spreadsheetId, propertyType) {
        const sheetName = 'athome';
        const cellPositions = CELL_MAPPING[propertyType];
        if (!cellPositions) {
            console.error(`[AthomeSheetSyncService] Invalid property type: ${propertyType}`);
            return {
                favoriteComment: null,
                recommendedComments: [],
                panoramaUrl: null,
            };
        }
        try {
            // お気に入り文言を取得
            const favoriteResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!${cellPositions.favoriteComment}`,
            });
            const favoriteComment = favoriteResponse.data.values?.[0]?.[0] || null;
            // アピールポイントを取得
            const recommendedResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!${cellPositions.recommendedComments}`,
            });
            const recommendedRows = recommendedResponse.data.values || [];
            const recommendedComments = [];
            recommendedRows.forEach(row => {
                const text = row.join(' ').trim();
                if (text) {
                    recommendedComments.push(text);
                }
            });
            // パノラマURLを取得（athomeシートのN1セル）
            const panoramaResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!N1`,
            });
            const panoramaUrl = panoramaResponse.data.values?.[0]?.[0] || null;
            console.log(`[AthomeSheetSyncService] Fetched comments from ${spreadsheetId}:`, {
                has_favorite_comment: !!favoriteComment,
                recommended_comments_count: recommendedComments.length,
                has_panorama_url: !!panoramaUrl,
            });
            return {
                favoriteComment,
                recommendedComments,
                panoramaUrl,
            };
        }
        catch (error) {
            console.error(`[AthomeSheetSyncService] Error fetching comments from ${spreadsheetId}:`, error.message);
            return {
                favoriteComment: null,
                recommendedComments: [],
                panoramaUrl: null,
            };
        }
    }
    /**
     * 物件のコメントデータを同期（リトライ機能付き）
     *
     * @param propertyNumber - 物件番号
     * @param propertyType - 物件種別
     * @param maxRetries - 最大リトライ回数（デフォルト: 3）
     * @param retryDelay - リトライ間隔（ミリ秒、デフォルト: 1000）
     * @returns 同期成功の場合true
     */
    async syncPropertyComments(propertyNumber, propertyType, maxRetries = 3, retryDelay = 1000) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[AthomeSheetSyncService] Syncing comments for ${propertyNumber} (${propertyType}) - Attempt ${attempt}/${maxRetries}`);
                // 個別物件スプレッドシートのIDを取得
                const spreadsheetId = await this.getIndividualSpreadsheetId(propertyNumber);
                if (!spreadsheetId) {
                    console.error(`[AthomeSheetSyncService] Spreadsheet ID not found for ${propertyNumber}`);
                    // スプレッドシートIDが見つからない場合はリトライしない
                    return false;
                }
                // Athomeシートからコメントデータを取得
                const comments = await this.fetchCommentsFromAthomeSheet(spreadsheetId, propertyType);
                // athome_dataを構築（パノラマURLを含む）
                const athomeData = comments.panoramaUrl ? [comments.panoramaUrl] : [];
                // データベースに保存（property_aboutは含めない - 物件シートから取得するため）
                const success = await this.propertyDetailsService.upsertPropertyDetails(propertyNumber, {
                    favorite_comment: comments.favoriteComment,
                    recommended_comments: comments.recommendedComments,
                    athome_data: athomeData,
                });
                if (success) {
                    console.log(`[AthomeSheetSyncService] ✅ Successfully synced comments for ${propertyNumber} (attempt ${attempt})`);
                    return true;
                }
                else {
                    throw new Error('Failed to save to database');
                }
            }
            catch (error) {
                lastError = error;
                console.error(`[AthomeSheetSyncService] ❌ Attempt ${attempt}/${maxRetries} failed for ${propertyNumber}:`, error.message);
                // 最後の試行でない場合は待機してリトライ
                if (attempt < maxRetries) {
                    console.log(`[AthomeSheetSyncService] Retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        // 全てのリトライが失敗
        console.error(`[AthomeSheetSyncService] ❌ All ${maxRetries} attempts failed for ${propertyNumber}`);
        console.error(`[AthomeSheetSyncService] Last error:`, lastError?.message);
        return false;
    }
    /**
     * 戸建て物件のハウスメーカーをathomeシートF10セルから取得してDBに保存する
     *
     * 取得元: 業務依頼シートのタイトルに物件番号を含むスプシの athome シート F10 セル
     * 保存先: property_listings.house_maker
     *
     * @param propertyNumber - 物件番号
     * @returns 取得したハウスメーカー名（null の場合は未設定）
     */
    async syncHouseMaker(propertyNumber) {
        try {
            console.log(`[AthomeSheetSyncService] Syncing house_maker for ${propertyNumber}`);
            // 個別物件スプレッドシートのIDを取得
            const spreadsheetId = await this.getIndividualSpreadsheetId(propertyNumber);
            if (!spreadsheetId) {
                console.warn(`[AthomeSheetSyncService] Spreadsheet not found for ${propertyNumber}`);
                return null;
            }
            // athomeシートのF10セルを取得（空白シート名は無視）
            const sheetName = 'athome';
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!F10`,
            });
            const houseMaker = response.data.values?.[0]?.[0]?.trim() || null;
            console.log(`[AthomeSheetSyncService] house_maker for ${propertyNumber}: ${houseMaker}`);
            if (houseMaker === null) {
                console.log(`[AthomeSheetSyncService] F10 is empty for ${propertyNumber}, skipping DB update`);
                return null;
            }
            // property_listingsテーブルに保存
            const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
            const { error } = await supabase
                .from('property_listings')
                .update({ house_maker: houseMaker })
                .eq('property_number', propertyNumber);
            if (error) {
                console.error(`[AthomeSheetSyncService] Failed to save house_maker for ${propertyNumber}:`, error.message);
                return null;
            }
            console.log(`[AthomeSheetSyncService] ✅ house_maker saved for ${propertyNumber}: ${houseMaker}`);
            return houseMaker;
        }
        catch (error) {
            console.error(`[AthomeSheetSyncService] Error syncing house_maker for ${propertyNumber}:`, error.message);
            return null;
        }
    }
}
exports.AthomeSheetSyncService = AthomeSheetSyncService;
