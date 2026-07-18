"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheManager = exports.CacheManager = void 0;
const redis_1 = __importDefault(require("../config/redis"));
/**
 * キャッシュ管理サービス
 * Redisキャッシュの読み書きと鮮度管理を担当
 */
class CacheManager {
    constructor() {
        this.VERSION = '1.0.0';
        this.DEFAULT_TTL = 300; // 5分
    }
    /**
     * キャッシュからデータを取得
     */
    async get(key) {
        try {
            const rawData = await redis_1.default.get(key);
            if (!rawData)
                return null;
            const cachedData = JSON.parse(rawData);
            // タイムスタンプをDateオブジェクトに変換
            cachedData.metadata.timestamp = new Date(cachedData.metadata.timestamp);
            return cachedData;
        }
        catch (error) {
            console.error('CacheManager get error:', error);
            return null;
        }
    }
    /**
     * キャッシュにデータを保存
     */
    async set(key, data, ttl = this.DEFAULT_TTL) {
        try {
            const cachedData = {
                data,
                metadata: {
                    timestamp: new Date(),
                    version: this.VERSION,
                    ttl,
                },
            };
            await redis_1.default.setEx(key, ttl, JSON.stringify(cachedData));
        }
        catch (error) {
            console.error('CacheManager set error:', error);
            throw error;
        }
    }
    /**
     * 最終更新時刻を取得
     */
    async getLastUpdateTime(key) {
        try {
            const cachedData = await this.get(key);
            return cachedData?.metadata.timestamp || null;
        }
        catch (error) {
            console.error('CacheManager getLastUpdateTime error:', error);
            return null;
        }
    }
    /**
     * キャッシュを無効化（削除）
     */
    async invalidate(key) {
        try {
            await redis_1.default.del(key);
        }
        catch (error) {
            console.error('CacheManager invalidate error:', error);
            throw error;
        }
    }
    /**
     * パターンに一致するキャッシュを無効化
     */
    async invalidatePattern(pattern) {
        try {
            const keys = await redis_1.default.keys(pattern);
            if (keys.length > 0) {
                await Promise.all(keys.map(key => redis_1.default.del(key)));
            }
        }
        catch (error) {
            console.error('CacheManager invalidatePattern error:', error);
            throw error;
        }
    }
    /**
     * キャッシュの鮮度をチェック
     * @param key キャッシュキー
     * @param thresholdMinutes 鮮度の閾値（分）
     */
    async checkFreshness(key, thresholdMinutes = 5) {
        try {
            const cachedData = await this.get(key);
            if (!cachedData) {
                return {
                    lastUpdateTime: null,
                    isStale: true,
                    ageInMinutes: Infinity,
                };
            }
            const now = new Date();
            const lastUpdateTime = cachedData.metadata.timestamp;
            const ageInMs = now.getTime() - lastUpdateTime.getTime();
            const ageInMinutes = ageInMs / (1000 * 60);
            const isStale = ageInMinutes >= thresholdMinutes;
            return {
                lastUpdateTime,
                isStale,
                ageInMinutes,
            };
        }
        catch (error) {
            console.error('CacheManager checkFreshness error:', error);
            return {
                lastUpdateTime: null,
                isStale: true,
                ageInMinutes: Infinity,
            };
        }
    }
    /**
     * キャッシュキーを生成
     */
    generateKey(prefix, ...parts) {
        return `${prefix}:${parts.join(':')}`;
    }
    /**
     * キャッシュが存在するかチェック
     */
    async exists(key) {
        try {
            const data = await redis_1.default.get(key);
            return data !== null;
        }
        catch (error) {
            console.error('CacheManager exists error:', error);
            return false;
        }
    }
}
exports.CacheManager = CacheManager;
// シングルトンインスタンス
exports.cacheManager = new CacheManager();
