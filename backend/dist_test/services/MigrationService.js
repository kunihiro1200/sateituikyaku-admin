"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * データ移行サービス
 *
 * スプレッドシートからSupabaseへの初回データ移行を管理します。
 */
class MigrationService {
    constructor(sheetsClient, columnMapper, supabaseUrl, supabaseKey) {
        this.sheetsClient = sheetsClient;
        this.columnMapper = columnMapper;
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    /**
     * スプレッドシートからSupabaseへデータを移行
     */
    async migrateFromSpreadsheet(options) {
        const startTime = Date.now();
        const errors = [];
        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;
        console.log('🚀 データ移行を開始します...');
        console.log(`   バッチサイズ: ${options.batchSize}`);
        console.log(`   重複スキップ: ${options.skipDuplicates ? 'はい' : 'いいえ'}`);
        console.log(`   ドライラン: ${options.dryRun ? 'はい' : 'いいえ'}\n`);
        try {
            // スプレッドシートから全データを読み取り
            console.log('📖 スプレッドシートからデータを読み取り中...');
            const rows = await this.sheetsClient.readAll();
            console.log(`✅ ${rows.length}行のデータを読み取りました\n`);
            // バッチ処理
            const batches = this.createBatches(rows, options.batchSize);
            console.log(`📦 ${batches.length}個のバッチに分割しました\n`);
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`処理中: バッチ ${i + 1}/${batches.length} (${batch.length}行)`);
                const batchResult = await this.processBatch(batch, i * options.batchSize + 2, options);
                successCount += batchResult.successCount;
                failureCount += batchResult.failureCount;
                skippedCount += batchResult.skippedCount;
                errors.push(...batchResult.errors);
                console.log(`  成功: ${batchResult.successCount}, 失敗: ${batchResult.failureCount}, スキップ: ${batchResult.skippedCount}\n`);
            }
            const duration = Date.now() - startTime;
            console.log('✅ データ移行が完了しました！');
            console.log(`   総行数: ${rows.length}`);
            console.log(`   成功: ${successCount}`);
            console.log(`   失敗: ${failureCount}`);
            console.log(`   スキップ: ${skippedCount}`);
            console.log(`   処理時間: ${(duration / 1000).toFixed(2)}秒\n`);
            if (errors.length > 0) {
                console.log('⚠️  エラーが発生した行:');
                errors.slice(0, 10).forEach(err => {
                    console.log(`   行${err.row}: ${err.error}`);
                });
                if (errors.length > 10) {
                    console.log(`   ... 他${errors.length - 10}件のエラー\n`);
                }
            }
            return {
                totalRows: rows.length,
                successCount,
                failureCount,
                skippedCount,
                errors,
                duration,
            };
        }
        catch (error) {
            console.error('❌ 移行中に致命的なエラーが発生しました:', error.message);
            throw error;
        }
    }
    /**
     * バッチを作成
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * バッチを処理
     */
    async processBatch(batch, startRowIndex, options) {
        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;
        const errors = [];
        for (let i = 0; i < batch.length; i++) {
            const row = batch[i];
            const rowIndex = startRowIndex + i;
            try {
                // バリデーション
                const validation = this.columnMapper.validate(row);
                if (!validation.isValid) {
                    errors.push({
                        row: rowIndex,
                        data: row,
                        error: `バリデーションエラー: ${validation.errors.join(', ')}`,
                    });
                    failureCount++;
                    continue;
                }
                // データ変換
                const sellerData = this.columnMapper.mapToDatabase(row);
                // 重複チェック
                if (options.skipDuplicates && sellerData.seller_number) {
                    const exists = await this.checkDuplicate(sellerData.seller_number);
                    if (exists) {
                        skippedCount++;
                        continue;
                    }
                }
                // ドライランの場合はスキップ
                if (options.dryRun) {
                    successCount++;
                    continue;
                }
                // 売主情報をSupabaseに挿入
                const { data: seller, error: sellerError } = await this.supabase
                    .from('sellers')
                    .insert(sellerData)
                    .select()
                    .single();
                if (sellerError || !seller) {
                    errors.push({
                        row: rowIndex,
                        data: row,
                        error: `売主データベースエラー: ${sellerError?.message || '不明なエラー'}`,
                    });
                    failureCount++;
                    continue;
                }
                // 物件情報を抽出
                const propertyData = this.columnMapper.extractPropertyData(row, seller.id);
                // 物件情報を保存
                if (propertyData) {
                    const { error: propertyError } = await this.supabase
                        .from('properties')
                        .insert(propertyData);
                    if (propertyError) {
                        // 売主をロールバック
                        await this.supabase
                            .from('sellers')
                            .delete()
                            .eq('id', seller.id);
                        errors.push({
                            row: rowIndex,
                            data: row,
                            error: `物件データベースエラー: ${propertyError.message}`,
                        });
                        failureCount++;
                        continue;
                    }
                }
                successCount++;
            }
            catch (error) {
                errors.push({
                    row: rowIndex,
                    data: row,
                    error: `予期しないエラー: ${error.message}`,
                });
                failureCount++;
            }
        }
        return { successCount, failureCount, skippedCount, errors };
    }
    /**
     * 重複チェック
     */
    async checkDuplicate(sellerNumber) {
        const { data, error } = await this.supabase
            .from('sellers')
            .select('id')
            .eq('seller_number', sellerNumber)
            .single();
        return !error && data !== null;
    }
    /**
     * 移行レポートを生成
     */
    generateReport(result) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('データ移行レポート');
        lines.push('='.repeat(60));
        lines.push('');
        lines.push(`実行日時: ${new Date().toLocaleString('ja-JP')}`);
        lines.push(`処理時間: ${(result.duration / 1000).toFixed(2)}秒`);
        lines.push('');
        lines.push('結果サマリー:');
        lines.push(`  総行数: ${result.totalRows}`);
        lines.push(`  成功: ${result.successCount}`);
        lines.push(`  失敗: ${result.failureCount}`);
        lines.push(`  スキップ: ${result.skippedCount}`);
        lines.push(`  成功率: ${((result.successCount / result.totalRows) * 100).toFixed(2)}%`);
        lines.push('');
        if (result.errors.length > 0) {
            lines.push('エラー詳細:');
            result.errors.forEach(err => {
                lines.push(`  行${err.row}: ${err.error}`);
            });
            lines.push('');
        }
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
}
exports.MigrationService = MigrationService;
