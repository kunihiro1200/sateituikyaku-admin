"use strict";
/**
 * テストヘルパー関数
 *
 * 統合テストで使用する共通のヘルパー関数を提供します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTestData = cleanupTestData;
exports.getTestPropertyNumbers = getTestPropertyNumbers;
exports.verifySyncState = verifySyncState;
exports.verifySyncHistory = verifySyncHistory;
exports.getTestConfig = getTestConfig;
exports.measureExecutionTime = measureExecutionTime;
exports.retryTest = retryTest;
exports.withTimeout = withTimeout;
exports.logTestResult = logTestResult;
exports.getTestDataStats = getTestDataStats;
/**
 * テストデータをクリーンアップする
 */
async function cleanupTestData(supabase, syncId) {
    if (syncId) {
        // 同期履歴を削除
        await supabase
            .from('property_listing_sync_history')
            .delete()
            .eq('sync_id', syncId);
        // 同期状態を削除
        await supabase
            .from('property_listing_sync_states')
            .delete()
            .eq('id', syncId);
    }
}
/**
 * テスト用の物件番号を取得する
 */
async function getTestPropertyNumbers(supabase, limit = 10) {
    const { data, error } = await supabase
        .from('property_listings')
        .select('property_number')
        .limit(limit);
    if (error || !data) {
        return [];
    }
    return data.map(item => item.property_number);
}
/**
 * 同期状態を検証する
 */
async function verifySyncState(supabase, syncId, expectedStatus) {
    const { data, error } = await supabase
        .from('property_listing_sync_states')
        .select('*')
        .eq('id', syncId)
        .single();
    if (error || !data) {
        return false;
    }
    return data.status === expectedStatus;
}
/**
 * 同期履歴を検証する
 */
async function verifySyncHistory(supabase, syncId, expectedCount) {
    const { data, error } = await supabase
        .from('property_listing_sync_history')
        .select('*')
        .eq('sync_id', syncId);
    if (error || !data) {
        return false;
    }
    return data.length === expectedCount;
}
/**
 * テスト環境の設定を取得する
 */
function getTestConfig() {
    return {
        supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL,
        supabaseServiceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        spreadsheetId: process.env.TEST_SPREADSHEET_ID || process.env.SPREADSHEET_ID,
        sheetName: process.env.TEST_SHEET_NAME || '物件リスト',
        batchSize: 10,
        rateLimit: 5,
        concurrency: 2,
    };
}
/**
 * テストの実行時間を測定する
 */
async function measureExecutionTime(fn) {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    return { result, duration };
}
/**
 * リトライ付きでテストを実行する
 */
async function retryTest(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
}
/**
 * テスト用のタイムアウトを設定する
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
    ]);
}
/**
 * テスト結果をログに出力する
 */
function logTestResult(testName, success, details) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${testName}`);
    if (details) {
        console.log('  詳細:', JSON.stringify(details, null, 2));
    }
}
/**
 * テストデータの統計情報を取得する
 */
async function getTestDataStats(supabase) {
    const [properties, syncStates, syncHistory] = await Promise.all([
        supabase.from('property_listings').select('id', { count: 'exact', head: true }),
        supabase.from('property_listing_sync_states').select('id', { count: 'exact', head: true }),
        supabase.from('property_listing_sync_history').select('id', { count: 'exact', head: true }),
    ]);
    return {
        totalProperties: properties.count || 0,
        totalSyncStates: syncStates.count || 0,
        totalSyncHistory: syncHistory.count || 0,
    };
}
