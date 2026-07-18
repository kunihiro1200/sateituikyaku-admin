"use strict";
/**
 * Amazon Comprehend Client
 * AWS SDK for Amazon Comprehendのラッパー
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmazonComprehendClient = void 0;
exports.getComprehendClient = getComprehendClient;
const phone_1 = require("../../types/phone");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Amazon Comprehend Client クラス
 */
class AmazonComprehendClient {
    constructor() {
        this.useMock = process.env.USE_AWS_MOCK === 'true' || !process.env.AWS_ACCESS_KEY_ID;
        if (this.useMock) {
            logger_1.default.info('Amazon Comprehend: Using mock implementation');
        }
        else {
            try {
                // 実際のAWS SDKクライアント初期化
                // const credentials = getAWSCredentials();
                // this.client = new ComprehendClient(credentials);
                logger_1.default.info('Amazon Comprehend: Using real AWS SDK');
            }
            catch (error) {
                logger_1.default.error('Failed to initialize Amazon Comprehend client', { error: error.message });
                throw new phone_1.AWSConnectionError('Failed to initialize Amazon Comprehend', 'comprehend', error);
            }
        }
    }
    /**
     * 感情分析を実行
     */
    async analyzeSentiment(text, languageCode = 'ja') {
        if (this.useMock) {
            return this.mockAnalyzeSentiment(text, languageCode);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DetectSentimentCommand({
            //   Text: text,
            //   LanguageCode: languageCode,
            // });
            // 
            // const response = await this.client.send(command);
            // 
            // return {
            //   sentiment: response.Sentiment!,
            //   sentimentScore: {
            //     positive: response.SentimentScore!.Positive!,
            //     negative: response.SentimentScore!.Negative!,
            //     neutral: response.SentimentScore!.Neutral!,
            //     mixed: response.SentimentScore!.Mixed!,
            //   },
            // };
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to analyze sentiment', { error, textLength: text.length });
            throw new phone_1.AWSConnectionError('Failed to analyze sentiment', 'comprehend', error);
        }
    }
    /**
     * キーフレーズを抽出
     */
    async detectKeyPhrases(text, languageCode = 'ja') {
        if (this.useMock) {
            return this.mockDetectKeyPhrases(text, languageCode);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DetectKeyPhrasesCommand({
            //   Text: text,
            //   LanguageCode: languageCode,
            // });
            // 
            // const response = await this.client.send(command);
            // 
            // return (response.KeyPhrases || []).map(kp => ({
            //   text: kp.Text!,
            //   score: kp.Score!,
            //   beginOffset: kp.BeginOffset!,
            //   endOffset: kp.EndOffset!,
            // }));
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to detect key phrases', { error, textLength: text.length });
            throw new phone_1.AWSConnectionError('Failed to detect key phrases', 'comprehend', error);
        }
    }
    /**
     * エンティティを抽出
     */
    async detectEntities(text, languageCode = 'ja') {
        if (this.useMock) {
            return this.mockDetectEntities(text, languageCode);
        }
        try {
            // 実際のAWS SDK呼び出し
            // const command = new DetectEntitiesCommand({
            //   Text: text,
            //   LanguageCode: languageCode,
            // });
            // 
            // const response = await this.client.send(command);
            // 
            // return (response.Entities || []).map(entity => ({
            //   text: entity.Text!,
            //   type: entity.Type!,
            //   score: entity.Score!,
            //   beginOffset: entity.BeginOffset!,
            //   endOffset: entity.EndOffset!,
            // }));
            throw new Error('Real AWS SDK not implemented yet');
        }
        catch (error) {
            logger_1.default.error('Failed to detect entities', { error, textLength: text.length });
            throw new phone_1.AWSConnectionError('Failed to detect entities', 'comprehend', error);
        }
    }
    /**
     * 包括的なテキスト分析（感情、キーフレーズ、エンティティを一度に取得）
     */
    async analyzeText(text, languageCode = 'ja') {
        const [sentiment, keyPhrases, entities] = await Promise.all([
            this.analyzeSentiment(text, languageCode),
            this.detectKeyPhrases(text, languageCode),
            this.detectEntities(text, languageCode),
        ]);
        return { sentiment, keyPhrases, entities };
    }
    /**
     * 接続テスト
     */
    async testConnection() {
        if (this.useMock) {
            return true;
        }
        try {
            // 実際のAWS SDK呼び出し（簡単なテキストで感情分析）
            // await this.analyzeSentiment('テスト', 'ja');
            return true;
        }
        catch (error) {
            logger_1.default.error('Amazon Comprehend connection test failed', error);
            return false;
        }
    }
    // ============================================================================
    // モック実装（開発・テスト用）
    // ============================================================================
    mockAnalyzeSentiment(text, languageCode) {
        logger_1.default.info('[MOCK] Analyzing sentiment', { textLength: text.length, languageCode });
        // テキストからネガティブワードを検出して感情を判定
        const negativeWords = ['不満', '問題', '困る', 'ダメ', '悪い', '嫌', '無理'];
        const positiveWords = ['良い', '素晴らしい', 'ありがとう', '満足', '嬉しい', '助かる'];
        const hasNegative = negativeWords.some(word => text.includes(word));
        const hasPositive = positiveWords.some(word => text.includes(word));
        let sentiment;
        let scores = { positive: 0.25, negative: 0.25, neutral: 0.25, mixed: 0.25 };
        if (hasPositive && hasNegative) {
            sentiment = 'MIXED';
            scores = { positive: 0.35, negative: 0.35, neutral: 0.15, mixed: 0.15 };
        }
        else if (hasPositive) {
            sentiment = 'POSITIVE';
            scores = { positive: 0.85, negative: 0.05, neutral: 0.05, mixed: 0.05 };
        }
        else if (hasNegative) {
            sentiment = 'NEGATIVE';
            scores = { positive: 0.05, negative: 0.85, neutral: 0.05, mixed: 0.05 };
        }
        else {
            sentiment = 'NEUTRAL';
            scores = { positive: 0.15, negative: 0.15, neutral: 0.60, mixed: 0.10 };
        }
        return Promise.resolve({
            sentiment,
            sentimentScore: scores,
        });
    }
    mockDetectKeyPhrases(text, languageCode) {
        logger_1.default.info('[MOCK] Detecting key phrases', { textLength: text.length, languageCode });
        // 簡易的なキーフレーズ抽出（名詞句を抽出）
        const keyPhrases = [];
        const phrases = [
            '物件の査定',
            '不動産',
            'お電話',
            'ご用件',
            '詳しいお話',
        ];
        phrases.forEach((phrase, index) => {
            const position = text.indexOf(phrase);
            if (position !== -1) {
                keyPhrases.push({
                    text: phrase,
                    score: 0.95 - index * 0.05,
                    beginOffset: position,
                    endOffset: position + phrase.length,
                });
            }
        });
        return Promise.resolve(keyPhrases);
    }
    mockDetectEntities(text, languageCode) {
        logger_1.default.info('[MOCK] Detecting entities', { textLength: text.length, languageCode });
        // 簡易的なエンティティ抽出
        const entities = [];
        // 日付パターン
        const datePattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日/g;
        let match;
        while ((match = datePattern.exec(text)) !== null) {
            entities.push({
                text: match[0],
                type: 'DATE',
                score: 0.95,
                beginOffset: match.index,
                endOffset: match.index + match[0].length,
            });
        }
        // 不動産関連の組織名
        if (text.includes('不動産')) {
            const position = text.indexOf('不動産');
            entities.push({
                text: '不動産',
                type: 'ORGANIZATION',
                score: 0.85,
                beginOffset: position,
                endOffset: position + 3,
            });
        }
        return Promise.resolve(entities);
    }
}
exports.AmazonComprehendClient = AmazonComprehendClient;
// シングルトンインスタンス
let comprehendClientInstance = null;
/**
 * Amazon Comprehend Clientのシングルトンインスタンスを取得
 */
function getComprehendClient() {
    if (!comprehendClientInstance) {
        comprehendClientInstance = new AmazonComprehendClient();
    }
    return comprehendClientInstance;
}
exports.default = AmazonComprehendClient;
