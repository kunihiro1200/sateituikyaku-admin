"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicSyncManager = exports.AutoSyncService = void 0;
exports.getAutoSyncService = getAutoSyncService;
exports.getPeriodicSyncManager = getPeriodicSyncManager;
/**
 * 自動同期サービス
 *
 * スプレッドシートからDBへの自動同期を管理します。
 * サーバー起動時や定期的に新規データを同期します。
 */
const supabase_js_1 = require("@supabase/supabase-js");
const GoogleSheetsClient_1 = require("./GoogleSheetsClient");
const ColumnMapper_1 = require("./ColumnMapper");
const PropertySyncHandler_1 = require("./PropertySyncHandler");
const PropertyListingSyncService_1 = require("./PropertyListingSyncService");
const encryption_1 = require("../utils/encryption");
class AutoSyncService {
    constructor(supabaseUrl, supabaseKey) {
        this.sheetsClient = null;
        this.propertyListingSyncService = null;
        this.isInitialized = false;
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        this.columnMapper = new ColumnMapper_1.ColumnMapper();
        this.propertySyncHandler = new PropertySyncHandler_1.PropertySyncHandler(this.supabase);
    }
    /**
     * Google Sheets クライアントを初期化
     */
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            const sheetsConfig = {
                spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
                sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
                serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
            };
            this.sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient(sheetsConfig);
            await this.sheetsClient.authenticate();
            // 物件リスト同期サービスを初期化（業務リストシート用）
            const propertyListingConfig = {
                spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
                sheetName: '業務リスト',
                serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
            };
            const propertyListingSheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient(propertyListingConfig);
            await propertyListingSheetsClient.authenticate();
            this.propertyListingSyncService = new PropertyListingSyncService_1.PropertyListingSyncService(propertyListingSheetsClient);
            this.isInitialized = true;
            console.log('✅ AutoSyncService initialized (including PropertyListingSyncService)');
        }
        catch (error) {
            console.error('❌ AutoSyncService initialization failed:', error.message);
            throw error;
        }
    }
    /**
     * 数値をパース
     */
    parseNumeric(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        if (typeof value === 'number') {
            return value;
        }
        const str = String(value).replace(/,/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }
    /**
     * 新規売主を自動同期
     * DBに存在しない売主番号のデータをスプレッドシートから同期します
     */
    async syncNewSellers() {
        const startTime = Date.now();
        const errors = [];
        let newSellersCount = 0;
        let updatedSellersCount = 0;
        try {
            if (!this.isInitialized || !this.sheetsClient) {
                await this.initialize();
            }
            console.log('🔄 Auto-sync: Checking for new sellers...');
            // DBから最新の売主番号を取得
            const { data: latestSeller } = await this.supabase
                .from('sellers')
                .select('seller_number')
                .order('seller_number', { ascending: false })
                .limit(1)
                .single();
            const latestSellerNumber = latestSeller?.seller_number || 'AA0';
            console.log(`📊 Latest seller in DB: ${latestSellerNumber}`);
            // スプレッドシートから全データを取得
            const allRows = await this.sheetsClient.readAll();
            console.log(`📊 Total rows in spreadsheet: ${allRows.length}`);
            // DBに存在しない売主を特定（売主番号が最新より大きいもの）
            const newRows = allRows.filter((row) => {
                const sellerNumber = row['売主番号'];
                if (!sellerNumber)
                    return false;
                // 売主番号を数値で比較（AA13244 -> 13244）
                const currentNum = parseInt(sellerNumber.replace('AA', ''), 10);
                const latestNum = parseInt(latestSellerNumber.replace('AA', ''), 10);
                return currentNum > latestNum;
            });
            console.log(`🆕 New sellers to sync: ${newRows.length}`);
            if (newRows.length === 0) {
                console.log('✅ No new sellers to sync');
                return {
                    success: true,
                    newSellersCount: 0,
                    updatedSellersCount: 0,
                    propertyListingsUpdated: 0,
                    errors: [],
                    duration: Date.now() - startTime,
                };
            }
            // 新規売主を同期
            for (const row of newRows) {
                const sellerNumber = row['売主番号'];
                try {
                    const mappedData = this.columnMapper.mapToDatabase(row);
                    // 査定額を取得（手入力優先、なければ自動計算）
                    const valuation1 = row['査定額1'] || row['査定額1（自動計算）v'];
                    const valuation2 = row['査定額2'] || row['査定額2（自動計算）v'];
                    const valuation3 = row['査定額3'] || row['査定額3（自動計算）v'];
                    const encryptedData = {
                        seller_number: sellerNumber,
                        name: mappedData.name ? (0, encryption_1.encrypt)(mappedData.name) : null,
                        address: mappedData.address ? (0, encryption_1.encrypt)(mappedData.address) : null,
                        phone_number: mappedData.phone_number ? (0, encryption_1.encrypt)(mappedData.phone_number) : null,
                        email: mappedData.email ? (0, encryption_1.encrypt)(mappedData.email) : null,
                        status: mappedData.status || '追客中',
                        next_call_date: mappedData.next_call_date || null,
                    };
                    // 査定額を追加
                    const val1 = this.parseNumeric(valuation1);
                    const val2 = this.parseNumeric(valuation2);
                    const val3 = this.parseNumeric(valuation3);
                    if (val1 !== null)
                        encryptedData.valuation_amount_1 = val1 * 10000;
                    if (val2 !== null)
                        encryptedData.valuation_amount_2 = val2 * 10000;
                    if (val3 !== null)
                        encryptedData.valuation_amount_3 = val3 * 10000;
                    const { data: newSeller, error: insertError } = await this.supabase
                        .from('sellers')
                        .insert(encryptedData)
                        .select()
                        .single();
                    if (insertError) {
                        throw new Error(insertError.message);
                    }
                    // 物件情報を同期（直接スプレッドシートから取得）
                    if (newSeller) {
                        const propertyAddress = row['物件所在地'] || '未入力';
                        let propertyType = row['種別'];
                        if (propertyType) {
                            const typeStr = String(propertyType).trim();
                            const typeMapping = {
                                '土': '土地', '戸': '戸建', 'マ': 'マンション', '事': '事業用',
                            };
                            propertyType = typeMapping[typeStr] || typeStr;
                        }
                        await this.propertySyncHandler.syncProperty(newSeller.id, {
                            address: String(propertyAddress),
                            property_type: propertyType ? String(propertyType) : undefined,
                            land_area: this.parseNumeric(row['土（㎡）']) ?? undefined,
                            building_area: this.parseNumeric(row['建（㎡）']) ?? undefined,
                            build_year: this.parseNumeric(row['築年']) ?? undefined,
                            structure: row['構造'] ? String(row['構造']) : undefined,
                            seller_situation: row['状況（売主）'] ? String(row['状況（売主）']) : undefined,
                            floor_plan: row['間取り'] ? String(row['間取り']) : undefined,
                        });
                    }
                    newSellersCount++;
                    console.log(`✅ ${sellerNumber}: Created`);
                }
                catch (error) {
                    errors.push(`${sellerNumber}: ${error.message}`);
                    console.error(`❌ ${sellerNumber}: ${error.message}`);
                }
            }
            const duration = Date.now() - startTime;
            console.log(`🎉 Auto-sync completed: ${newSellersCount} new, ${errors.length} errors, ${duration}ms`);
            // 物件リスト更新同期を実行（要件1: 自動同期サービスの起動確認と修正）
            let propertyListingsUpdated = 0;
            if (this.propertyListingSyncService) {
                try {
                    console.log('🔄 Starting property listing update sync...');
                    const propertyListingResult = await this.propertyListingSyncService.syncUpdatedPropertyListings();
                    propertyListingsUpdated = propertyListingResult.updated;
                    console.log(`✅ Property listing sync: ${propertyListingsUpdated} updated`);
                    if (propertyListingResult.failed > 0) {
                        propertyListingResult.errors?.forEach(err => {
                            errors.push(`${err.property_number}: ${err.error}`);
                        });
                    }
                }
                catch (error) {
                    console.error('❌ Property listing sync failed:', error.message);
                    errors.push(`Property listing sync: ${error.message}`);
                }
            }
            return {
                success: errors.length === 0,
                newSellersCount,
                updatedSellersCount,
                propertyListingsUpdated: propertyListingsUpdated,
                errors,
                duration,
            };
        }
        catch (error) {
            console.error('❌ Auto-sync failed:', error.message);
            return {
                success: false,
                newSellersCount,
                updatedSellersCount,
                propertyListingsUpdated: 0,
                errors: [error.message],
                duration: Date.now() - startTime,
            };
        }
    }
}
exports.AutoSyncService = AutoSyncService;
// シングルトンインスタンス
let autoSyncServiceInstance = null;
function getAutoSyncService() {
    if (!autoSyncServiceInstance) {
        autoSyncServiceInstance = new AutoSyncService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    }
    return autoSyncServiceInstance;
}
/**
 * 定期同期マネージャー
 * 指定間隔でスプレッドシートからDBへの同期を実行します
 */
class PeriodicSyncManager {
    constructor(intervalMinutes = 5) {
        this.intervalId = null;
        this.isRunning = false;
        this.autoSyncService = getAutoSyncService();
        this.intervalMinutes = intervalMinutes;
    }
    /**
     * 定期同期を開始
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Periodic sync is already running');
            return;
        }
        try {
            await this.autoSyncService.initialize();
            this.isRunning = true;
            // 初回実行
            console.log(`🔄 Starting periodic sync (interval: ${this.intervalMinutes} minutes)`);
            await this.runSync();
            // 定期実行を設定
            this.intervalId = setInterval(async () => {
                await this.runSync();
            }, this.intervalMinutes * 60 * 1000);
            console.log(`✅ Periodic sync started (every ${this.intervalMinutes} minutes)`);
        }
        catch (error) {
            console.error('❌ Failed to start periodic sync:', error.message);
            this.isRunning = false;
        }
    }
    /**
     * 定期同期を停止
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Periodic sync stopped');
    }
    /**
     * 同期を実行
     */
    async runSync() {
        try {
            const result = await this.autoSyncService.syncNewSellers();
            if (result.newSellersCount > 0) {
                console.log(`📊 Periodic sync: ${result.newSellersCount} new sellers synced`);
            }
        }
        catch (error) {
            console.error('⚠️ Periodic sync error:', error.message);
        }
    }
    /**
     * 実行中かどうか
     */
    isActive() {
        return this.isRunning;
    }
    /**
     * 同期間隔を取得
     */
    getIntervalMinutes() {
        return this.intervalMinutes;
    }
}
exports.PeriodicSyncManager = PeriodicSyncManager;
// 定期同期マネージャーのシングルトン
let periodicSyncManagerInstance = null;
function getPeriodicSyncManager(intervalMinutes) {
    if (!periodicSyncManagerInstance) {
        periodicSyncManagerInstance = new PeriodicSyncManager(intervalMinutes || parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES || '5', 10));
    }
    return periodicSyncManagerInstance;
}
