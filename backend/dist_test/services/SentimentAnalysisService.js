"use strict";
/**
 * SentimentAnalysisService
 * 通話文字起こしの感情分析とキーワード検出を管理するサービス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentimentAnalysisService = void 0;
exports.getSentimentAnalysisService = getSentimentAnalysisService;
const ComprehendClient_1 = require("./aws/ComprehendClient");
const supabase_1 = require("../config/supabase");
const phone_1 = require("../types/phone");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * SentimentAnalysisService クラス
 */
class SentimentAnalysisService {
    constructor() {
        this.comprehendClient = (0, ComprehendClient_1.getComprehendClient)();
    }
    /**
     * 感情分析を実行
     */
    async analyzeSentiment(options) {
        const { transcriptionId, text, languageCode = 'ja', detectKeywords = true, executeAutoActions = true, } = options;
        try {
            logger_1.default.info('Starting sentiment analysis', {
                transcriptionId,
                textLength: text.length,
                languageCode,
            });
            // Amazon Comprehendで感情分析
            const sentimentResult = await this.comprehendClient.analyzeSentiment(text, languageCode);
            // 感情スコアを正規化
            const sentimentScores = {
                positive: sentimentResult.sentimentScore.positive,
                neutral: sentimentResult.sentimentScore.neutral,
                negative: sentimentResult.sentimentScore.negative,
                mixed: sentimentResult.sentimentScore.mixed,
            };
            // 感情を小文字に変換
            const sentiment = sentimentResult.sentiment.toLowerCase();
            // キーワード検出
            let detectedKeywords = [];
            let keywordResults = [];
            if (detectKeywords) {
                const keywordDetection = await this.detectKeywords(text);
                detectedKeywords = keywordDetection.keywords;
                keywordResults = keywordDetection.results;
            }
            // データベースを更新
            await this.updateTranscriptionSentiment(transcriptionId, sentiment, sentimentScores, detectedKeywords);
            // 自動アクションを実行
            let autoActionsExecuted = 0;
            if (executeAutoActions && keywordResults.length > 0) {
                autoActionsExecuted = await this.executeAutoActions(transcriptionId, keywordResults);
            }
            logger_1.default.info('Sentiment analysis completed', {
                transcriptionId,
                sentiment,
                keywordCount: detectedKeywords.length,
                autoActionsExecuted,
            });
            return {
                sentiment,
                sentimentScores,
                detectedKeywords,
                keywordResults,
                autoActionsExecuted,
            };
        }
        catch (error) {
            logger_1.default.error('Sentiment analysis failed', { error, transcriptionId });
            throw new phone_1.PhoneServiceError('Failed to analyze sentiment', 'SENTIMENT_ANALYSIS_FAILED', 'transcription', true, error);
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
                .select('*')
                .eq('is_active', true)
                .order('priority', { ascending: false });
            if (error) {
                throw error;
            }
            if (!keywordRules || keywordRules.length === 0) {
                return { keywords: [], results: [] };
            }
            // テキスト内でキーワードを検索
            const detectedKeywords = [];
            const keywordResults = [];
            const lowerText = text.toLowerCase();
            for (const rule of keywordRules) {
                const keyword = rule.keyword.toLowerCase();
                if (lowerText.includes(keyword)) {
                    detectedKeywords.push(rule.keyword);
                    keywordResults.push({
                        keyword: rule.keyword,
                        category: rule.category,
                        priority: rule.priority,
                        autoAction: rule.auto_action,
                        actionConfig: rule.action_config,
                    });
                }
            }
            logger_1.default.info('Keywords detected', {
                totalRules: keywordRules.length,
                detectedCount: detectedKeywords.length,
                keywords: detectedKeywords,
            });
            return { keywords: detectedKeywords, results: keywordResults };
        }
        catch (error) {
            logger_1.default.error('Keyword detection failed', { error });
            // キーワード検出失敗は致命的ではないので、空の結果を返す
            return { keywords: [], results: [] };
        }
    }
    /**
     * 自動アクションを実行
     */
    async executeAutoActions(transcriptionId, keywordResults) {
        let executedCount = 0;
        // アクションが設定されているキーワードのみをフィルタ
        const actionableKeywords = keywordResults.filter((result) => result.autoAction !== null);
        if (actionableKeywords.length === 0) {
            return 0;
        }
        logger_1.default.info('Executing auto actions', {
            transcriptionId,
            actionCount: actionableKeywords.length,
        });
        // 優先度順にソート（高い順）
        actionableKeywords.sort((a, b) => b.priority - a.priority);
        for (const keywordResult of actionableKeywords) {
            try {
                await this.executeAutoAction(transcriptionId, keywordResult);
                executedCount++;
            }
            catch (error) {
                logger_1.default.error('Auto action execution failed', {
                    error,
                    transcriptionId,
                    keyword: keywordResult.keyword,
                    action: keywordResult.autoAction,
                });
                // 1つのアクション失敗は他のアクションに影響させない
            }
        }
        return executedCount;
    }
    /**
     * 個別の自動アクションを実行
     */
    async executeAutoAction(transcriptionId, keywordResult) {
        const { keyword, autoAction, actionConfig } = keywordResult;
        logger_1.default.info('Executing auto action', {
            transcriptionId,
            keyword,
            action: autoAction,
        });
        // 通話ログIDを取得
        const { data: transcription } = await supabase_1.supabase
            .from('call_transcriptions')
            .select('call_log_id')
            .eq('id', transcriptionId)
            .single();
        if (!transcription) {
            throw new Error('Transcription not found');
        }
        const callLogId = transcription.call_log_id;
        // 通話ログから売主IDとユーザーIDを取得
        const { data: callLog } = await supabase_1.supabase
            .from('call_logs')
            .select('seller_id, user_id')
            .eq('id', callLogId)
            .single();
        if (!callLog) {
            throw new Error('Call log not found');
        }
        switch (autoAction) {
            case 'create_followup':
                await this.createFollowUpTask(callLog.seller_id, callLog.user_id, keyword, actionConfig);
                break;
            case 'notify_manager':
                await this.notifyManager(callLog.seller_id, callLog.user_id, keyword, actionConfig);
                break;
            case 'flag_urgent':
                await this.flagAsUrgent(callLog.seller_id, keyword, actionConfig);
                break;
            default:
                logger_1.default.warn('Unknown auto action', { action: autoAction });
        }
    }
    /**
     * フォローアップタスクを作成
     */
    async createFollowUpTask(sellerId, userId, keyword, config) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (config?.daysUntilDue || 3));
        const { error } = await supabase_1.supabase.from('follow_ups').insert({
            seller_id: sellerId,
            assigned_to: userId,
            due_date: dueDate.toISOString(),
            status: 'pending',
            notes: `自動生成: キーワード「${keyword}」が検出されました`,
            created_at: new Date().toISOString(),
        });
        if (error) {
            throw error;
        }
        logger_1.default.info('Follow-up task created', { sellerId, keyword });
    }
    /**
     * マネージャーに通知
     */
    async notifyManager(sellerId, userId, keyword, config) {
        // TODO: 実際の通知実装
        // - メール送信
        // - Slack通知
        // - システム内通知
        logger_1.default.info('Manager notification sent', {
            sellerId,
            userId,
            keyword,
            notificationType: config?.notificationType || 'email',
        });
    }
    /**
     * 緊急フラグを設定
     */
    async flagAsUrgent(sellerId, keyword, _config) {
        // Activity Logに緊急フラグを記録
        const { error } = await supabase_1.supabase.from('activity_logs').insert({
            seller_id: sellerId,
            activity_type: 'note',
            description: `🚨 緊急: キーワード「${keyword}」が通話で検出されました`,
            metadata: {
                urgent: true,
                keyword,
                auto_flagged: true,
            },
            created_at: new Date().toISOString(),
        });
        if (error) {
            throw error;
        }
        logger_1.default.info('Urgent flag set', { sellerId, keyword });
    }
    /**
     * 文字起こしの感情情報を更新
     */
    async updateTranscriptionSentiment(transcriptionId, sentiment, sentimentScores, detectedKeywords) {
        const { error } = await supabase_1.supabase
            .from('call_transcriptions')
            .update({
            sentiment,
            sentiment_scores: sentimentScores,
            detected_keywords: detectedKeywords,
            updated_at: new Date().toISOString(),
        })
            .eq('id', transcriptionId);
        if (error) {
            throw error;
        }
    }
    /**
     * キーワードルールを作成
     */
    async createKeywordRule(keyword, category, priority, autoAction, actionConfig, createdBy) {
        const { error } = await supabase_1.supabase.from('call_keywords').insert({
            keyword,
            category,
            priority,
            auto_action: autoAction,
            action_config: actionConfig,
            is_active: true,
            created_by: createdBy,
            created_at: new Date().toISOString(),
        });
        if (error) {
            throw error;
        }
        logger_1.default.info('Keyword rule created', { keyword, category, autoAction });
    }
    /**
     * キーワードルールを更新
     */
    async updateKeywordRule(keywordId, updates) {
        const updateData = {
            updated_at: new Date().toISOString(),
        };
        if (updates.keyword !== undefined)
            updateData.keyword = updates.keyword;
        if (updates.category !== undefined)
            updateData.category = updates.category;
        if (updates.priority !== undefined)
            updateData.priority = updates.priority;
        if (updates.autoAction !== undefined)
            updateData.auto_action = updates.autoAction;
        if (updates.actionConfig !== undefined)
            updateData.action_config = updates.actionConfig;
        if (updates.isActive !== undefined)
            updateData.is_active = updates.isActive;
        const { error } = await supabase_1.supabase
            .from('call_keywords')
            .update(updateData)
            .eq('id', keywordId);
        if (error) {
            throw error;
        }
        logger_1.default.info('Keyword rule updated', { keywordId, updates });
    }
    /**
     * キーワードルールを削除
     */
    async deleteKeywordRule(keywordId) {
        const { error } = await supabase_1.supabase.from('call_keywords').delete().eq('id', keywordId);
        if (error) {
            throw error;
        }
        logger_1.default.info('Keyword rule deleted', { keywordId });
    }
    /**
     * すべてのキーワードルールを取得
     */
    async getAllKeywordRules(activeOnly = false) {
        let query = supabase_1.supabase.from('call_keywords').select('*').order('priority', { ascending: false });
        if (activeOnly) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error) {
            throw error;
        }
        return data || [];
    }
    /**
     * 感情分析統計を取得
     */
    async getSentimentStatistics(startDate, endDate, sellerId) {
        try {
            // 期間内の文字起こしを取得
            let query = supabase_1.supabase
                .from('call_transcriptions')
                .select('sentiment, sentiment_scores, detected_keywords, call_log_id')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .not('sentiment', 'is', null);
            // 売主IDでフィルタ
            if (sellerId) {
                const { data: callLogs } = await supabase_1.supabase
                    .from('call_logs')
                    .select('id')
                    .eq('seller_id', sellerId);
                if (callLogs && callLogs.length > 0) {
                    const callLogIds = callLogs.map((log) => log.id);
                    query = query.in('call_log_id', callLogIds);
                }
            }
            const { data: transcriptions, error } = await query;
            if (error) {
                throw error;
            }
            if (!transcriptions || transcriptions.length === 0) {
                return {
                    totalAnalyzed: 0,
                    sentimentDistribution: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
                    averageScores: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
                    topKeywords: [],
                };
            }
            // 感情分布を計算
            const sentimentDistribution = {
                positive: 0,
                neutral: 0,
                negative: 0,
                mixed: 0,
            };
            transcriptions.forEach((t) => {
                if (t.sentiment) {
                    sentimentDistribution[t.sentiment]++;
                }
            });
            // 平均スコアを計算
            const totalScores = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
            transcriptions.forEach((t) => {
                if (t.sentiment_scores) {
                    totalScores.positive += t.sentiment_scores.positive || 0;
                    totalScores.neutral += t.sentiment_scores.neutral || 0;
                    totalScores.negative += t.sentiment_scores.negative || 0;
                    totalScores.mixed += t.sentiment_scores.mixed || 0;
                }
            });
            const count = transcriptions.length;
            const averageScores = {
                positive: totalScores.positive / count,
                neutral: totalScores.neutral / count,
                negative: totalScores.negative / count,
                mixed: totalScores.mixed / count,
            };
            // トップキーワードを集計
            const keywordCounts = {};
            transcriptions.forEach((t) => {
                if (t.detected_keywords && Array.isArray(t.detected_keywords)) {
                    t.detected_keywords.forEach((keyword) => {
                        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                    });
                }
            });
            const topKeywords = Object.entries(keywordCounts)
                .map(([keyword, count]) => ({ keyword, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            return {
                totalAnalyzed: count,
                sentimentDistribution,
                averageScores,
                topKeywords,
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get sentiment statistics', { error });
            throw new phone_1.PhoneServiceError('Failed to get sentiment statistics', 'STATISTICS_FAILED', 'transcription', false, error);
        }
    }
}
exports.SentimentAnalysisService = SentimentAnalysisService;
// シングルトンインスタンス
let sentimentAnalysisServiceInstance = null;
/**
 * SentimentAnalysisServiceのシングルトンインスタンスを取得
 */
function getSentimentAnalysisService() {
    if (!sentimentAnalysisServiceInstance) {
        sentimentAnalysisServiceInstance = new SentimentAnalysisService();
    }
    return sentimentAnalysisServiceInstance;
}
exports.default = SentimentAnalysisService;
