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
exports.BuyerDataRecoveryService = void 0;
// 買主データ復旧サービス
const googleapis_1 = require("googleapis");
const supabase_js_1 = require("@supabase/supabase-js");
const path = __importStar(require("path"));
const BuyerColumnMapper_1 = require("./BuyerColumnMapper");
const BuyerDataValidator_1 = require("./BuyerDataValidator");
const RecoveryLogger_1 = require("./RecoveryLogger");
const BuyerBackupService_1 = require("./BuyerBackupService");
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID || '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';
const BATCH_SIZE = 100;
/**
 * 買主データの復旧を管理するメインサービス
 */
class BuyerDataRecoveryService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        this.columnMapper = new BuyerColumnMapper_1.BuyerColumnMapper();
        this.validator = new BuyerDataValidator_1.BuyerDataValidator();
        this.logger = new RecoveryLogger_1.RecoveryLogger();
        this.backupService = new BuyerBackupService_1.BuyerBackupService();
    }
    /**
     * すべてのデータを復元
     */
    async recoverAll(options = {}) {
        const startTime = Date.now();
        const batchSize = options.batchSize || BATCH_SIZE;
        const dryRun = options.dryRun || false;
        console.log('=== 買主データ復旧開始 ===');
        console.log(`モード: ${dryRun ? 'ドライラン（検証のみ）' : '本番復元'}`);
        console.log(`バッチサイズ: ${batchSize}`);
        console.log('');
        const result = {
            success: false,
            totalRows: 0,
            validRows: 0,
            inserted: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            duration: 0
        };
        let logId = null;
        let backupResult = null;
        try {
            // 1. バックアップ作成（オプション）
            if (options.createBackup && !dryRun) {
                console.log('既存データのバックアップを作成中...');
                backupResult = await this.backupService.createBackup('復旧前の自動バックアップ');
                if (!backupResult.success) {
                    throw new Error('バックアップの作成に失敗しました');
                }
                console.log(`バックアップ完了: ${backupResult.recordCount}件 (ID: ${backupResult.backupId})`);
                console.log('');
            }
            // 2. スプレッドシートからデータを読み取り
            console.log('スプレッドシートからデータを読み取り中...');
            const { headers, rows } = await this.readSpreadsheetData();
            result.totalRows = rows.length;
            console.log(`${rows.length}行のデータを取得しました`);
            console.log('');
            // ログ開始
            logId = await this.logger.logRecoveryStart(rows.length);
            // 3. データ検証（スキップしない場合）
            if (!options.skipValidation) {
                console.log('データ検証中...');
                const validationResult = await this.validateSpreadsheetData(headers, rows);
                console.log(this.validator.generateValidationSummary(validationResult));
                console.log('');
                result.validRows = validationResult.validRows;
                if (!validationResult.isValid && !dryRun) {
                    console.warn('⚠️ 検証エラーがありますが、復元を続行します（エラー行はスキップされます）');
                    console.log('');
                }
            }
            else {
                result.validRows = rows.length;
            }
            // 4. ドライランの場合はここで終了
            if (dryRun) {
                console.log('✅ ドライラン完了（実際のデータ挿入は行われませんでした）');
                result.success = true;
                result.duration = Date.now() - startTime;
                if (logId) {
                    await this.logger.logRecoveryComplete(logId, result);
                }
                return result;
            }
            // 5. データ復元（バッチ処理）
            console.log('データ復元を開始します...');
            console.log('');
            const totalBatches = Math.ceil(rows.length / batchSize);
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const start = batchIndex * batchSize;
                const end = Math.min(start + batchSize, rows.length);
                const batch = rows.slice(start, end);
                console.log(`バッチ ${batchIndex + 1}/${totalBatches} を処理中 (行 ${start + 2} ~ ${end + 1})...`);
                const batchResult = await this.processBatch(headers, batch, start + 2);
                result.inserted += batchResult.inserted;
                result.failed += batchResult.failed;
                result.skipped += batchResult.skipped;
                result.errors.push(...batchResult.errors);
                // 進捗レポート
                if (logId) {
                    await this.logger.logRecoveryProgress(logId, end);
                }
                if (options.onProgress) {
                    this.reportProgress(end, rows.length, startTime, options.onProgress);
                }
            }
            result.success = true;
            result.duration = Date.now() - startTime;
            console.log('');
            console.log('=== 復旧完了 ===');
            console.log(`処理時間: ${(result.duration / 1000).toFixed(2)}秒`);
            console.log(`挿入成功: ${result.inserted}件`);
            console.log(`失敗: ${result.failed}件`);
            console.log(`スキップ: ${result.skipped}件`);
            if (backupResult) {
                console.log(`バックアップID: ${backupResult.backupId}`);
            }
            // ログ完了
            if (logId) {
                await this.logger.logRecoveryComplete(logId, result);
                console.log('');
                console.log(this.logger.generateSummaryReport(logId));
            }
            return result;
        }
        catch (error) {
            console.error('復旧中にエラーが発生しました:', error.message);
            result.success = false;
            result.duration = Date.now() - startTime;
            result.errors.push({
                row: 0,
                buyerNumber: null,
                message: error.message,
                errorType: RecoveryLogger_1.RecoveryErrorType.UNKNOWN_ERROR,
                timestamp: new Date().toISOString()
            });
            if (logId) {
                await this.logger.logRecoveryComplete(logId, result);
            }
            // バックアップからのリストアを提案
            if (backupResult && backupResult.success) {
                console.log('');
                console.log(`⚠️ エラーが発生しました。バックアップからリストアできます:`);
                console.log(`   npx ts-node recover-buyer-data.ts --restore ${backupResult.backupId}`);
            }
            throw error;
        }
    }
    /**
     * スプレッドシートからデータを読み取り
     */
    async readSpreadsheetData() {
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../../google-service-account.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        // ヘッダー取得
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!1:1`,
        });
        const headers = headerResponse.data.values?.[0] || [];
        // データ取得（181カラム対応: A2:GZ）
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A2:GZ`,
        });
        const rows = dataResponse.data.values || [];
        return { headers, rows };
    }
    /**
     * スプレッドシートデータを検証
     */
    async validateSpreadsheetData(headers, rows) {
        let data;
        if (headers && rows) {
            data = { headers, rows };
        }
        else {
            data = await this.readSpreadsheetData();
        }
        const validationData = data.rows.map((row, index) => {
            const buyerData = this.columnMapper.mapSpreadsheetToDatabase(data.headers, row);
            return {
                data: buyerData,
                rowNumber: index + 2 // +2 for header row and 1-indexed
            };
        });
        return this.validator.validateRows(validationData);
    }
    /**
     * バッチを処理
     */
    async processBatch(headers, rows, startRowNumber) {
        const result = {
            inserted: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = startRowNumber + i;
            try {
                const data = this.columnMapper.mapSpreadsheetToDatabase(headers, row);
                // 買主番号がない場合はスキップ
                if (!data.buyer_number || String(data.buyer_number).trim() === '') {
                    result.skipped++;
                    continue;
                }
                // データ検証
                const validationErrors = this.validator.validateRow(data, rowNumber);
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors.map(e => e.message).join(', ');
                    result.failed++;
                    result.errors.push({
                        row: rowNumber,
                        buyerNumber: data.buyer_number,
                        message: errorMessages,
                        errorType: RecoveryLogger_1.RecoveryErrorType.VALIDATION_ERROR,
                        timestamp: new Date().toISOString()
                    });
                    continue;
                }
                // buyer_idを生成（buyer_numberベース）
                const buyerId = `buyer_${data.buyer_number}`;
                // Upsert（重複がある場合は更新）
                const { error } = await this.supabase
                    .from('buyers')
                    .upsert({
                    ...data,
                    buyer_id: buyerId,
                    last_synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'buyer_id' });
                if (error) {
                    result.failed++;
                    let errorType = RecoveryLogger_1.RecoveryErrorType.DATABASE_ERROR;
                    if (error.message.includes('duplicate')) {
                        errorType = RecoveryLogger_1.RecoveryErrorType.DUPLICATE_ERROR;
                    }
                    result.errors.push({
                        row: rowNumber,
                        buyerNumber: data.buyer_number,
                        message: error.message,
                        errorType,
                        timestamp: new Date().toISOString()
                    });
                }
                else {
                    result.inserted++;
                }
            }
            catch (err) {
                result.failed++;
                result.errors.push({
                    row: rowNumber,
                    buyerNumber: null,
                    message: err.message,
                    errorType: RecoveryLogger_1.RecoveryErrorType.UNKNOWN_ERROR,
                    timestamp: new Date().toISOString()
                });
            }
        }
        return result;
    }
    /**
     * 進捗をレポート
     */
    reportProgress(current, total, startTime, callback) {
        const percentage = Math.round((current / total) * 100);
        const elapsed = Date.now() - startTime;
        const rate = current / elapsed; // rows per ms
        const remaining = total - current;
        const estimatedTimeRemaining = Math.round(remaining / rate);
        callback({
            current,
            total,
            percentage,
            estimatedTimeRemaining
        });
    }
    /**
     * バックアップからリストア
     */
    async restoreFromBackup(backupId) {
        const startTime = Date.now();
        console.log('=== バックアップからリストア ===');
        console.log(`バックアップID: ${backupId}`);
        console.log('');
        const result = {
            success: false,
            totalRows: 0,
            validRows: 0,
            inserted: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            duration: 0
        };
        try {
            const restoreResult = await this.backupService.restoreFromBackup(backupId);
            result.success = restoreResult.success;
            result.inserted = restoreResult.restoredCount;
            result.totalRows = restoreResult.restoredCount;
            result.validRows = restoreResult.restoredCount;
            result.duration = restoreResult.duration;
            console.log('');
            console.log('=== リストア完了 ===');
            console.log(`復元件数: ${result.inserted}件`);
            console.log(`処理時間: ${(result.duration / 1000).toFixed(2)}秒`);
            return result;
        }
        catch (error) {
            console.error('リストア中にエラーが発生しました:', error.message);
            result.success = false;
            result.duration = Date.now() - startTime;
            result.errors.push({
                row: 0,
                buyerNumber: null,
                message: error.message,
                errorType: RecoveryLogger_1.RecoveryErrorType.UNKNOWN_ERROR,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
}
exports.BuyerDataRecoveryService = BuyerDataRecoveryService;
