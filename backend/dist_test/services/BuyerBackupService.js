"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerBackupService = void 0;
// 買主データのバックアップ・リストアサービス
const supabase_js_1 = require("@supabase/supabase-js");
const uuid_1 = require("uuid");
/**
 * 買主データのバックアップとリストアを管理するサービス
 */
class BuyerBackupService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    /**
     * 現在の買主データをバックアップ
     */
    async createBackup(description) {
        const startTime = Date.now();
        const backupId = (0, uuid_1.v4)();
        const timestamp = new Date().toISOString();
        console.log(`[Backup ${backupId}] バックアップ開始...`);
        try {
            // 現在のデータを取得
            const { data: buyers, error: fetchError } = await this.supabase
                .from('buyers')
                .select('*');
            if (fetchError) {
                throw new Error(`データ取得エラー: ${fetchError.message}`);
            }
            const recordCount = buyers?.length || 0;
            console.log(`[Backup ${backupId}] ${recordCount}件のレコードを取得`);
            if (recordCount === 0) {
                console.log(`[Backup ${backupId}] バックアップするデータがありません`);
                return {
                    success: true,
                    backupId,
                    recordCount: 0,
                    timestamp,
                    duration: Date.now() - startTime
                };
            }
            // バックアップテーブルにデータを保存
            // 各レコードにbackup_idを追加
            const backupData = buyers.map(buyer => ({
                ...buyer,
                backup_id: backupId,
                original_id: buyer.id,
                backed_up_at: timestamp
            }));
            // バッチで挿入（1000件ずつ）
            const batchSize = 1000;
            for (let i = 0; i < backupData.length; i += batchSize) {
                const batch = backupData.slice(i, i + batchSize);
                const { error: insertError } = await this.supabase
                    .from('buyers_backup')
                    .insert(batch);
                if (insertError) {
                    throw new Error(`バックアップ挿入エラー: ${insertError.message}`);
                }
                console.log(`[Backup ${backupId}] ${Math.min(i + batchSize, backupData.length)}/${backupData.length}件をバックアップ`);
            }
            // バックアップメタデータを保存
            const { error: metaError } = await this.supabase
                .from('backup_metadata')
                .insert({
                id: backupId,
                created_at: timestamp,
                record_count: recordCount,
                description: description || 'データ復旧前のバックアップ'
            });
            if (metaError) {
                console.warn(`メタデータ保存エラー: ${metaError.message}`);
                // メタデータの保存失敗は致命的ではない
            }
            const duration = Date.now() - startTime;
            console.log(`[Backup ${backupId}] バックアップ完了: ${recordCount}件 (${duration}ms)`);
            return {
                success: true,
                backupId,
                recordCount,
                timestamp,
                duration
            };
        }
        catch (error) {
            console.error(`[Backup ${backupId}] バックアップ失敗:`, error.message);
            return {
                success: false,
                backupId,
                recordCount: 0,
                timestamp,
                duration: Date.now() - startTime
            };
        }
    }
    /**
     * バックアップからデータをリストア
     */
    async restoreFromBackup(backupId) {
        const startTime = Date.now();
        console.log(`[Restore ${backupId}] リストア開始...`);
        try {
            // バックアップデータを取得
            const { data: backupData, error: fetchError } = await this.supabase
                .from('buyers_backup')
                .select('*')
                .eq('backup_id', backupId);
            if (fetchError) {
                throw new Error(`バックアップデータ取得エラー: ${fetchError.message}`);
            }
            if (!backupData || backupData.length === 0) {
                throw new Error(`バックアップ ${backupId} が見つかりません`);
            }
            console.log(`[Restore ${backupId}] ${backupData.length}件のレコードを取得`);
            // 現在のデータを削除
            console.log(`[Restore ${backupId}] 現在のデータを削除中...`);
            const { error: deleteError } = await this.supabase
                .from('buyers')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // すべて削除
            if (deleteError) {
                throw new Error(`データ削除エラー: ${deleteError.message}`);
            }
            // バックアップデータをリストア
            // backup_id, original_id, backed_up_atフィールドを除外
            const restoreData = backupData.map(({ backup_id, original_id, backed_up_at, ...buyer }) => buyer);
            // バッチで挿入（1000件ずつ）
            const batchSize = 1000;
            for (let i = 0; i < restoreData.length; i += batchSize) {
                const batch = restoreData.slice(i, i + batchSize);
                const { error: insertError } = await this.supabase
                    .from('buyers')
                    .insert(batch);
                if (insertError) {
                    throw new Error(`リストア挿入エラー: ${insertError.message}`);
                }
                console.log(`[Restore ${backupId}] ${Math.min(i + batchSize, restoreData.length)}/${restoreData.length}件をリストア`);
            }
            const duration = Date.now() - startTime;
            console.log(`[Restore ${backupId}] リストア完了: ${restoreData.length}件 (${duration}ms)`);
            return {
                success: true,
                restoredCount: restoreData.length,
                duration
            };
        }
        catch (error) {
            console.error(`[Restore ${backupId}] リストア失敗:`, error.message);
            return {
                success: false,
                restoredCount: 0,
                duration: Date.now() - startTime
            };
        }
    }
    /**
     * バックアップ一覧を取得
     */
    async listBackups(limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('backup_metadata')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) {
                console.error('バックアップ一覧取得エラー:', error.message);
                return [];
            }
            return data || [];
        }
        catch (error) {
            console.error('バックアップ一覧取得エラー:', error.message);
            return [];
        }
    }
    /**
     * バックアップを削除
     */
    async deleteBackup(backupId) {
        console.log(`[Delete ${backupId}] バックアップ削除中...`);
        try {
            // バックアップデータを削除
            const { error: deleteDataError } = await this.supabase
                .from('buyers_backup')
                .delete()
                .eq('backup_id', backupId);
            if (deleteDataError) {
                throw new Error(`バックアップデータ削除エラー: ${deleteDataError.message}`);
            }
            // メタデータを削除
            const { error: deleteMetaError } = await this.supabase
                .from('backup_metadata')
                .delete()
                .eq('id', backupId);
            if (deleteMetaError) {
                console.warn(`メタデータ削除エラー: ${deleteMetaError.message}`);
            }
            console.log(`[Delete ${backupId}] バックアップ削除完了`);
            return true;
        }
        catch (error) {
            console.error(`[Delete ${backupId}] バックアップ削除失敗:`, error.message);
            return false;
        }
    }
    /**
     * バックアップテーブルが存在するか確認
     */
    async checkBackupTableExists() {
        try {
            const { error } = await this.supabase
                .from('buyers_backup')
                .select('id')
                .limit(1);
            return !error;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * バックアップテーブルを作成（必要な場合）
     */
    async ensureBackupTableExists() {
        const exists = await this.checkBackupTableExists();
        if (!exists) {
            console.log('バックアップテーブルが存在しません');
            console.log('以下のSQLを実行してテーブルを作成してください:');
            console.log('');
            console.log('CREATE TABLE IF NOT EXISTS buyers_backup (');
            console.log('  LIKE buyers INCLUDING ALL');
            console.log(');');
            console.log('ALTER TABLE buyers_backup ADD COLUMN backup_id UUID;');
            console.log('ALTER TABLE buyers_backup ADD COLUMN original_id UUID;');
            console.log('ALTER TABLE buyers_backup ADD COLUMN backed_up_at TIMESTAMPTZ;');
            console.log('');
            console.log('CREATE TABLE IF NOT EXISTS backup_metadata (');
            console.log('  id UUID PRIMARY KEY,');
            console.log('  created_at TIMESTAMPTZ NOT NULL,');
            console.log('  record_count INTEGER NOT NULL,');
            console.log('  description TEXT');
            console.log(');');
            throw new Error('バックアップテーブルが存在しません。上記のSQLを実行してください。');
        }
    }
}
exports.BuyerBackupService = BuyerBackupService;
