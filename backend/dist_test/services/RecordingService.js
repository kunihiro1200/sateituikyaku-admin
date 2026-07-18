"use strict";
/**
 * RecordingService
 * S3録音ファイル管理、Presigned URL生成、アクセスログ記録を管理するサービス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingService = void 0;
exports.getRecordingService = getRecordingService;
const supabase_1 = require("../config/supabase");
const S3Client_1 = require("./aws/S3Client");
const phone_1 = require("../types/phone");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * RecordingService クラス
 */
class RecordingService {
    constructor() {
        this.s3Client = (0, S3Client_1.getS3Client)();
        this.defaultBucket = process.env.S3_RECORDINGS_BUCKET || 'seller-system-call-recordings';
        this.defaultRegion = process.env.AWS_REGION || 'ap-northeast-1';
    }
    /**
     * 録音ファイル情報を作成
     */
    async createRecording(data) {
        try {
            const { data: recording, error } = await supabase_1.supabase
                .from('call_recordings')
                .insert({
                call_log_id: data.callLogId,
                s3_bucket: data.s3Bucket,
                s3_key: data.s3Key,
                s3_region: data.s3Region || this.defaultRegion,
                file_size_bytes: data.fileSizeBytes || null,
                duration_seconds: data.durationSeconds || null,
                format: data.format || 'wav',
                access_count: 0,
                created_at: new Date().toISOString(),
            })
                .select()
                .single();
            if (error) {
                throw error;
            }
            logger_1.default.info('Recording created', {
                recordingId: recording.id,
                callLogId: data.callLogId,
                s3Key: data.s3Key,
            });
            return recording;
        }
        catch (error) {
            logger_1.default.error('Failed to create recording', { error, data });
            throw new phone_1.PhoneServiceError('Failed to create recording', 'CREATE_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイル情報を取得
     */
    async getRecordingById(recordingId) {
        try {
            const { data: recording, error } = await supabase_1.supabase
                .from('call_recordings')
                .select('*')
                .eq('id', recordingId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            return recording;
        }
        catch (error) {
            logger_1.default.error('Failed to get recording', { error, recordingId });
            throw new phone_1.PhoneServiceError('Failed to get recording', 'GET_FAILED', 'call', false, error);
        }
    }
    /**
     * 通話ログIDから録音ファイル情報を取得
     */
    async getRecordingByCallLogId(callLogId) {
        try {
            const { data: recording, error } = await supabase_1.supabase
                .from('call_recordings')
                .select('*')
                .eq('call_log_id', callLogId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            return recording;
        }
        catch (error) {
            logger_1.default.error('Failed to get recording by call log', { error, callLogId });
            throw new phone_1.PhoneServiceError('Failed to get recording by call log', 'GET_FAILED', 'call', false, error);
        }
    }
    /**
     * Presigned URLを生成（録音再生用）
     */
    async getPresignedUrl(recordingId, expiresIn = 3600) {
        try {
            // 録音情報を取得
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                throw new phone_1.PhoneServiceError('Recording not found', 'NOT_FOUND', 'call', false);
            }
            // 既存のPresigned URLが有効かチェック
            if (recording.presigned_url && recording.presigned_url_expires_at) {
                const expiresAt = new Date(recording.presigned_url_expires_at);
                const now = new Date();
                const bufferMinutes = 5; // 5分のバッファ
                if (expiresAt.getTime() > now.getTime() + bufferMinutes * 60 * 1000) {
                    logger_1.default.info('Using cached presigned URL', {
                        recordingId,
                        expiresAt: expiresAt.toISOString(),
                    });
                    return {
                        url: recording.presigned_url,
                        expiresAt,
                    };
                }
            }
            // 新しいPresigned URLを生成
            const url = await this.s3Client.getPresignedUrl({
                bucket: recording.s3_bucket,
                key: recording.s3_key,
                expiresIn,
            });
            const expiresAt = new Date(Date.now() + expiresIn * 1000);
            // データベースに保存
            await supabase_1.supabase
                .from('call_recordings')
                .update({
                presigned_url: url,
                presigned_url_expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', recordingId);
            logger_1.default.info('Generated new presigned URL', {
                recordingId,
                expiresAt: expiresAt.toISOString(),
            });
            return { url, expiresAt };
        }
        catch (error) {
            logger_1.default.error('Failed to generate presigned URL', { error, recordingId });
            throw new phone_1.PhoneServiceError('Failed to generate presigned URL', 'PRESIGNED_URL_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイルへのアクセスを記録
     */
    async recordAccess(recordingId, userId) {
        try {
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                throw new phone_1.PhoneServiceError('Recording not found', 'NOT_FOUND', 'call', false);
            }
            // アクセスカウントと最終アクセス日時を更新
            await supabase_1.supabase
                .from('call_recordings')
                .update({
                access_count: (recording.access_count || 0) + 1,
                last_accessed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', recordingId);
            logger_1.default.info('Recording access logged', {
                recordingId,
                userId,
                accessCount: (recording.access_count || 0) + 1,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to record access', { error, recordingId, userId });
            // アクセスログ記録失敗は致命的ではないので、エラーをログに記録するのみ
        }
    }
    /**
     * 録音ファイルをアップロード
     */
    async uploadRecording(callLogId, audioBuffer, options = {}) {
        try {
            const format = options.format || 'wav';
            const timestamp = Date.now();
            const s3Key = `recordings/${callLogId}/${timestamp}.${format}`;
            // S3にアップロード
            await this.s3Client.uploadFile({
                bucket: this.defaultBucket,
                key: s3Key,
                body: audioBuffer,
                contentType: this.getContentType(format),
                metadata: options.metadata,
            });
            logger_1.default.info('Recording uploaded to S3', {
                callLogId,
                s3Key,
                size: audioBuffer.length,
            });
            // データベースに記録
            const recording = await this.createRecording({
                callLogId,
                s3Bucket: this.defaultBucket,
                s3Key,
                s3Region: this.defaultRegion,
                fileSizeBytes: audioBuffer.length,
                durationSeconds: options.durationSeconds,
                format,
            });
            return recording;
        }
        catch (error) {
            logger_1.default.error('Failed to upload recording', { error, callLogId });
            throw new phone_1.PhoneServiceError('Failed to upload recording', 'UPLOAD_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイルをダウンロード
     */
    async downloadRecording(recordingId) {
        try {
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                throw new phone_1.PhoneServiceError('Recording not found', 'NOT_FOUND', 'call', false);
            }
            // S3からダウンロード
            const buffer = await this.s3Client.downloadFile(recording.s3_bucket, recording.s3_key);
            logger_1.default.info('Recording downloaded from S3', {
                recordingId,
                size: buffer.length,
            });
            return buffer;
        }
        catch (error) {
            logger_1.default.error('Failed to download recording', { error, recordingId });
            throw new phone_1.PhoneServiceError('Failed to download recording', 'DOWNLOAD_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイルを削除
     */
    async deleteRecording(recordingId) {
        try {
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                throw new phone_1.PhoneServiceError('Recording not found', 'NOT_FOUND', 'call', false);
            }
            // S3から削除
            await this.s3Client.deleteFile(recording.s3_bucket, recording.s3_key);
            // データベースから削除
            await supabase_1.supabase.from('call_recordings').delete().eq('id', recordingId);
            logger_1.default.info('Recording deleted', {
                recordingId,
                s3Key: recording.s3_key,
            });
        }
        catch (error) {
            logger_1.default.error('Failed to delete recording', { error, recordingId });
            throw new phone_1.PhoneServiceError('Failed to delete recording', 'DELETE_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイルをアーカイブ（別のS3バケットに移動）
     */
    async archiveRecording(recordingId, archiveBucket) {
        try {
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                throw new phone_1.PhoneServiceError('Recording not found', 'NOT_FOUND', 'call', false);
            }
            // アーカイブ用のキーを生成
            const archiveKey = `archive/${recording.s3_key}`;
            // S3でファイルをコピー
            await this.s3Client.copyFile({
                sourceBucket: recording.s3_bucket,
                sourceKey: recording.s3_key,
                destinationBucket: archiveBucket,
                destinationKey: archiveKey,
            });
            // 元のファイルを削除
            await this.s3Client.deleteFile(recording.s3_bucket, recording.s3_key);
            // データベースを更新
            const { data: updatedRecording, error } = await supabase_1.supabase
                .from('call_recordings')
                .update({
                s3_bucket: archiveBucket,
                s3_key: archiveKey,
                presigned_url: null,
                presigned_url_expires_at: null,
                updated_at: new Date().toISOString(),
            })
                .eq('id', recordingId)
                .select()
                .single();
            if (error) {
                throw error;
            }
            logger_1.default.info('Recording archived', {
                recordingId,
                originalKey: recording.s3_key,
                archiveKey,
            });
            return updatedRecording;
        }
        catch (error) {
            logger_1.default.error('Failed to archive recording', { error, recordingId });
            throw new phone_1.PhoneServiceError('Failed to archive recording', 'ARCHIVE_FAILED', 'call', false, error);
        }
    }
    /**
     * 古い録音ファイルを削除
     */
    async deleteOldRecordings(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            // 古い録音を取得
            const { data: oldRecordings, error: selectError } = await supabase_1.supabase
                .from('call_recordings')
                .select('id, s3_bucket, s3_key')
                .lt('created_at', cutoffDate.toISOString());
            if (selectError) {
                throw selectError;
            }
            if (!oldRecordings || oldRecordings.length === 0) {
                return 0;
            }
            // S3から削除
            for (const recording of oldRecordings) {
                try {
                    await this.s3Client.deleteFile(recording.s3_bucket, recording.s3_key);
                }
                catch (error) {
                    logger_1.default.error('Failed to delete recording from S3', {
                        error,
                        recordingId: recording.id,
                        s3Key: recording.s3_key,
                    });
                    // 個別のエラーは記録するが、処理は続行
                }
            }
            // データベースから削除
            const { error: deleteError } = await supabase_1.supabase
                .from('call_recordings')
                .delete()
                .lt('created_at', cutoffDate.toISOString());
            if (deleteError) {
                throw deleteError;
            }
            logger_1.default.info('Old recordings deleted', {
                count: oldRecordings.length,
                cutoffDate: cutoffDate.toISOString(),
            });
            return oldRecordings.length;
        }
        catch (error) {
            logger_1.default.error('Failed to delete old recordings', { error, daysToKeep });
            throw new phone_1.PhoneServiceError('Failed to delete old recordings', 'DELETE_OLD_FAILED', 'call', false, error);
        }
    }
    /**
     * 録音ファイルの存在確認
     */
    async recordingExists(recordingId) {
        try {
            const recording = await this.getRecordingById(recordingId);
            if (!recording) {
                return false;
            }
            // S3での存在確認
            const exists = await this.s3Client.fileExists(recording.s3_bucket, recording.s3_key);
            return exists;
        }
        catch (error) {
            logger_1.default.error('Failed to check recording existence', { error, recordingId });
            return false;
        }
    }
    /**
     * 録音ファイルのメタデータを更新
     */
    async updateRecordingMetadata(recordingId, updates) {
        try {
            const updateData = {
                updated_at: new Date().toISOString(),
            };
            if (updates.fileSizeBytes !== undefined) {
                updateData.file_size_bytes = updates.fileSizeBytes;
            }
            if (updates.durationSeconds !== undefined) {
                updateData.duration_seconds = updates.durationSeconds;
            }
            if (updates.format) {
                updateData.format = updates.format;
            }
            const { data: recording, error } = await supabase_1.supabase
                .from('call_recordings')
                .update(updateData)
                .eq('id', recordingId)
                .select()
                .single();
            if (error) {
                throw error;
            }
            logger_1.default.info('Recording metadata updated', { recordingId, updates });
            return recording;
        }
        catch (error) {
            logger_1.default.error('Failed to update recording metadata', { error, recordingId, updates });
            throw new phone_1.PhoneServiceError('Failed to update recording metadata', 'UPDATE_FAILED', 'call', false, error);
        }
    }
    /**
     * Content-Typeを取得
     */
    getContentType(format) {
        const contentTypes = {
            wav: 'audio/wav',
            mp3: 'audio/mpeg',
            mp4: 'audio/mp4',
            flac: 'audio/flac',
            ogg: 'audio/ogg',
        };
        return contentTypes[format] || 'audio/wav';
    }
    /**
     * 録音統計を取得
     */
    async getRecordingStatistics() {
        try {
            const { data: recordings, error } = await supabase_1.supabase
                .from('call_recordings')
                .select('file_size_bytes, duration_seconds, format');
            if (error) {
                throw error;
            }
            if (!recordings || recordings.length === 0) {
                return {
                    totalRecordings: 0,
                    totalSizeBytes: 0,
                    averageSizeBytes: 0,
                    totalDurationSeconds: 0,
                    averageDurationSeconds: 0,
                    formatDistribution: {},
                };
            }
            const totalRecordings = recordings.length;
            const totalSizeBytes = recordings.reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);
            const totalDurationSeconds = recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
            const formatDistribution = {};
            recordings.forEach((r) => {
                const format = r.format || 'wav';
                formatDistribution[format] = (formatDistribution[format] || 0) + 1;
            });
            return {
                totalRecordings,
                totalSizeBytes,
                averageSizeBytes: Math.round(totalSizeBytes / totalRecordings),
                totalDurationSeconds,
                averageDurationSeconds: Math.round(totalDurationSeconds / totalRecordings),
                formatDistribution: formatDistribution,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get recording statistics', { error });
            throw new phone_1.PhoneServiceError('Failed to get recording statistics', 'STATISTICS_FAILED', 'call', false, error);
        }
    }
}
exports.RecordingService = RecordingService;
// シングルトンインスタンス
let recordingServiceInstance = null;
/**
 * RecordingServiceのシングルトンインスタンスを取得
 */
function getRecordingService() {
    if (!recordingServiceInstance) {
        recordingServiceInstance = new RecordingService();
    }
    return recordingServiceInstance;
}
exports.default = RecordingService;
