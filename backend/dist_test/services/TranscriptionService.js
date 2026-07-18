"use strict";
/**
 * TranscriptionService
 * 通話録音の文字起こし処理を管理するサービス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionService = void 0;
exports.getTranscriptionService = getTranscriptionService;
const TranscribeClient_1 = require("./aws/TranscribeClient");
const ComprehendClient_1 = require("./aws/ComprehendClient");
const supabase_1 = require("../config/supabase");
const phone_1 = require("../types/phone");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * TranscriptionService クラス
 */
class TranscriptionService {
    constructor() {
        this.transcribeClient = (0, TranscribeClient_1.getTranscribeClient)();
        this.comprehendClient = (0, ComprehendClient_1.getComprehendClient)();
    }
    /**
     * 文字起こしジョブを開始
     */
    async startTranscription(options) {
        const { callLogId, s3Bucket, s3Key, languageCode = 'ja-JP', enableSpeakerLabels = true, } = options;
        try {
            // 文字起こしレコードを作成（pending状態）
            const transcription = await this.createTranscriptionRecord(callLogId, languageCode);
            // ジョブ名を生成
            const jobName = `call-${callLogId}-${Date.now()}`;
            const mediaFileUri = `s3://${s3Bucket}/${s3Key}`;
            logger_1.default.info('Starting transcription job', {
                callLogId,
                jobName,
                mediaFileUri,
                languageCode,
            });
            // Amazon Transcribeジョブを開始
            const job = await this.transcribeClient.startTranscriptionJob({
                jobName,
                mediaFileUri,
                mediaFormat: this.getMediaFormat(s3Key),
                languageCode: languageCode,
                outputBucketName: s3Bucket,
                showSpeakerLabels: enableSpeakerLabels,
                maxSpeakerLabels: 2,
            });
            // ジョブIDを保存して状態を更新
            const updatedTranscription = await this.updateTranscriptionStatus(transcription.id, 'processing', job.jobName);
            logger_1.default.info('Transcription job started successfully', {
                callLogId,
                transcriptionId: transcription.id,
                jobName: job.jobName,
            });
            return updatedTranscription;
        }
        catch (error) {
            logger_1.default.error('Failed to start transcription', { error, callLogId });
            throw new phone_1.TranscriptionError('Failed to start transcription job', 'START_FAILED', false, error);
        }
    }
    /**
     * 文字起こしジョブのステータスを確認
     */
    async checkTranscriptionStatus(transcriptionId) {
        try {
            // データベースから文字起こしレコードを取得
            const { data: transcription, error } = await supabase_1.supabase
                .from('call_transcriptions')
                .select('*')
                .eq('id', transcriptionId)
                .single();
            if (error || !transcription) {
                throw new Error('Transcription not found');
            }
            // すでに完了または失敗している場合はそのまま返す
            if (transcription.transcription_status === 'completed' ||
                transcription.transcription_status === 'failed') {
                return transcription;
            }
            // ジョブIDがない場合はエラー
            if (!transcription.transcription_job_id) {
                throw new Error('Transcription job ID not found');
            }
            logger_1.default.info('Checking transcription job status', {
                transcriptionId,
                jobId: transcription.transcription_job_id,
            });
            // Amazon Transcribeからジョブステータスを取得
            const job = await this.transcribeClient.getTranscriptionJob(transcription.transcription_job_id);
            // ステータスに応じて処理
            if (job.status === 'COMPLETED') {
                return await this.processCompletedTranscription(transcription, job.transcriptFileUri);
            }
            else if (job.status === 'FAILED') {
                return await this.handleTranscriptionFailure(transcription.id, job.failureReason || 'Unknown error');
            }
            // まだ処理中の場合はそのまま返す
            return transcription;
        }
        catch (error) {
            logger_1.default.error('Failed to check transcription status', { error, transcriptionId });
            throw new phone_1.TranscriptionError('Failed to check transcription status', 'STATUS_CHECK_FAILED', true, error);
        }
    }
    /**
     * 完了した文字起こしを処理
     */
    async processCompletedTranscription(transcription, transcriptFileUri) {
        try {
            logger_1.default.info('Processing completed transcription', {
                transcriptionId: transcription.id,
                transcriptFileUri,
            });
            // 文字起こし結果を取得
            const result = await this.transcribeClient.getTranscriptionResult(transcriptFileUri);
            // 話者ラベルを処理してセグメントに変換
            const segments = this.processTranscriptionSegments(result);
            // 平均信頼度スコアを計算
            const confidenceScore = this.calculateAverageConfidence(segments);
            // データベースを更新
            const { data: updated, error } = await supabase_1.supabase
                .from('call_transcriptions')
                .update({
                transcription_text: result.transcript,
                transcription_json: segments,
                confidence_score: confidenceScore,
                transcription_status: 'completed',
                updated_at: new Date().toISOString(),
            })
                .eq('id', transcription.id)
                .select()
                .single();
            if (error) {
                throw error;
            }
            logger_1.default.info('Transcription completed successfully', {
                transcriptionId: transcription.id,
                textLength: result.transcript.length,
                segmentCount: segments.length,
            });
            // 感情分析を非同期で実行（エラーが発生しても文字起こしは完了とする）
            this.performSentimentAnalysis(transcription.id, result.transcript).catch((error) => {
                logger_1.default.error('Sentiment analysis failed', { error, transcriptionId: transcription.id });
            });
            return updated;
        }
        catch (error) {
            logger_1.default.error('Failed to process completed transcription', {
                error,
                transcriptionId: transcription.id,
            });
            return await this.handleTranscriptionFailure(transcription.id, 'Failed to process transcription result');
        }
    }
    /**
     * 感情分析を実行
     */
    async performSentimentAnalysis(transcriptionId, text) {
        try {
            logger_1.default.info('Performing sentiment analysis', { transcriptionId });
            // Amazon Comprehendで感情分析
            const sentimentResult = await this.comprehendClient.analyzeSentiment(text, 'ja');
            // キーワード検出
            const keywords = await this.detectKeywords(text);
            // データベースを更新
            const { error } = await supabase_1.supabase
                .from('call_transcriptions')
                .update({
                sentiment: sentimentResult.sentiment.toLowerCase(),
                sentiment_scores: sentimentResult.sentimentScore,
                detected_keywords: keywords,
                updated_at: new Date().toISOString(),
            })
                .eq('id', transcriptionId);
            if (error) {
                throw error;
            }
            logger_1.default.info('Sentiment analysis completed', {
                transcriptionId,
                sentiment: sentimentResult.sentiment,
                keywordCount: keywords.length,
            });
            // キーワードに基づく自動アクションを実行
            await this.executeAutoActions(transcriptionId, keywords);
        }
        catch (error) {
            logger_1.default.error('Sentiment analysis failed', { error, transcriptionId });
            throw error;
        }
    }
    /**
     * キーワードを検出
     */
    async detectKeywords(text) {
        try {
            // データベースからアクティブなキーワードルールを取得
            const { data: keywordRules, error } = await supabase_1.supabase
                .from('call_keywords')
                .select('keyword')
                .eq('is_active', true);
            if (error) {
                throw error;
            }
            // テキスト内でキーワードを検索
            const detectedKeywords = [];
            const lowerText = text.toLowerCase();
            for (const rule of keywordRules || []) {
                if (lowerText.includes(rule.keyword.toLowerCase())) {
                    detectedKeywords.push(rule.keyword);
                }
            }
            return detectedKeywords;
        }
        catch (error) {
            logger_1.default.error('Keyword detection failed', { error });
            return [];
        }
    }
    /**
     * キーワードに基づく自動アクションを実行
     */
    async executeAutoActions(transcriptionId, keywords) {
        if (keywords.length === 0) {
            return;
        }
        try {
            // キーワードルールを取得
            const { data: keywordRules, error } = await supabase_1.supabase
                .from('call_keywords')
                .select('*')
                .in('keyword', keywords)
                .eq('is_active', true)
                .not('auto_action', 'is', null);
            if (error || !keywordRules || keywordRules.length === 0) {
                return;
            }
            logger_1.default.info('Executing auto actions', {
                transcriptionId,
                actionCount: keywordRules.length,
            });
            // 各アクションを実行
            for (const rule of keywordRules) {
                try {
                    await this.executeAutoAction(transcriptionId, rule);
                }
                catch (error) {
                    logger_1.default.error('Auto action execution failed', {
                        error,
                        transcriptionId,
                        keyword: rule.keyword,
                        action: rule.auto_action,
                    });
                }
            }
        }
        catch (error) {
            logger_1.default.error('Failed to execute auto actions', { error, transcriptionId });
        }
    }
    /**
     * 個別の自動アクションを実行
     */
    async executeAutoAction(transcriptionId, rule) {
        // TODO: 実際のアクション実装
        // - create_followup: フォローアップタスクを作成
        // - notify_manager: マネージャーに通知
        // - flag_urgent: 緊急フラグを設定
        logger_1.default.info('Auto action executed', {
            transcriptionId,
            keyword: rule.keyword,
            action: rule.auto_action,
        });
    }
    /**
     * 文字起こし失敗を処理
     */
    async handleTranscriptionFailure(transcriptionId, errorMessage) {
        logger_1.default.error('Transcription failed', { transcriptionId, errorMessage });
        const { data: updated, error } = await supabase_1.supabase
            .from('call_transcriptions')
            .update({
            transcription_status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
        })
            .eq('id', transcriptionId)
            .select()
            .single();
        if (error) {
            throw error;
        }
        return updated;
    }
    /**
     * 文字起こしレコードを作成
     */
    async createTranscriptionRecord(callLogId, languageCode) {
        const { data, error } = await supabase_1.supabase
            .from('call_transcriptions')
            .insert({
            call_log_id: callLogId,
            transcription_text: '',
            language_code: languageCode,
            transcription_status: 'pending',
        })
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    /**
     * 文字起こしステータスを更新
     */
    async updateTranscriptionStatus(transcriptionId, status, jobId) {
        const updateData = {
            transcription_status: status,
            updated_at: new Date().toISOString(),
        };
        if (jobId) {
            updateData.transcription_job_id = jobId;
        }
        const { data, error } = await supabase_1.supabase
            .from('call_transcriptions')
            .update(updateData)
            .eq('id', transcriptionId)
            .select()
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
    /**
     * 文字起こしセグメントを処理
     */
    processTranscriptionSegments(result) {
        const segments = [];
        if (result.speakerLabels && result.speakerLabels.length > 0) {
            // 話者ラベルがある場合
            for (const label of result.speakerLabels) {
                segments.push({
                    speaker: this.mapSpeaker(label.speaker),
                    text: label.text,
                    start_time: label.startTime,
                    end_time: label.endTime,
                    confidence: 0.95, // デフォルト値
                });
            }
        }
        else if (result.segments && result.segments.length > 0) {
            // セグメントのみの場合
            for (const segment of result.segments) {
                segments.push({
                    speaker: 'unknown',
                    text: segment.text,
                    start_time: segment.startTime,
                    end_time: segment.endTime,
                    confidence: segment.confidence,
                });
            }
        }
        else {
            // セグメント情報がない場合、全体を1つのセグメントとして扱う
            segments.push({
                speaker: 'unknown',
                text: result.transcript,
                start_time: 0,
                end_time: 0,
                confidence: 0.9,
            });
        }
        return segments;
    }
    /**
     * 話者ラベルをマッピング
     */
    mapSpeaker(speaker) {
        // spk_0 を agent、spk_1 を customer として扱う
        if (speaker === 'spk_0')
            return 'agent';
        if (speaker === 'spk_1')
            return 'customer';
        return 'unknown';
    }
    /**
     * 平均信頼度スコアを計算
     */
    calculateAverageConfidence(segments) {
        if (segments.length === 0)
            return 0;
        const sum = segments.reduce((acc, segment) => acc + segment.confidence, 0);
        return sum / segments.length;
    }
    /**
     * メディアフォーマットを取得
     */
    getMediaFormat(s3Key) {
        const extension = s3Key.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'mp3':
                return 'mp3';
            case 'mp4':
                return 'mp4';
            case 'wav':
                return 'wav';
            case 'flac':
                return 'flac';
            default:
                return 'wav'; // デフォルト
        }
    }
    /**
     * 文字起こしを取得
     */
    async getTranscription(callLogId) {
        const { data, error } = await supabase_1.supabase
            .from('call_transcriptions')
            .select('*')
            .eq('call_log_id', callLogId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return null;
            }
            throw error;
        }
        return data;
    }
    /**
     * 文字起こしを削除
     */
    async deleteTranscription(transcriptionId) {
        // ジョブIDを取得
        const { data: transcription } = await supabase_1.supabase
            .from('call_transcriptions')
            .select('transcription_job_id')
            .eq('id', transcriptionId)
            .single();
        // Amazon Transcribeジョブを削除
        if (transcription?.transcription_job_id) {
            try {
                await this.transcribeClient.deleteTranscriptionJob(transcription.transcription_job_id);
            }
            catch (error) {
                logger_1.default.error('Failed to delete transcription job', {
                    error,
                    jobId: transcription.transcription_job_id,
                });
            }
        }
        // データベースから削除
        const { error } = await supabase_1.supabase
            .from('call_transcriptions')
            .delete()
            .eq('id', transcriptionId);
        if (error) {
            throw error;
        }
    }
}
exports.TranscriptionService = TranscriptionService;
// シングルトンインスタンス
let transcriptionServiceInstance = null;
/**
 * TranscriptionServiceのシングルトンインスタンスを取得
 */
function getTranscriptionService() {
    if (!transcriptionServiceInstance) {
        transcriptionServiceInstance = new TranscriptionService();
    }
    return transcriptionServiceInstance;
}
exports.default = TranscriptionService;
