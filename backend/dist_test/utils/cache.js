"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = exports.CacheHelper = void 0;
const redis_1 = __importDefault(require("../config/redis"));
/**
 * キャッシュヘルパー
 */
class CacheHelper {
    /**
     * キャッシュからデータを取得
     */
    static async get(key) {
        try {
            const data = await redis_1.default.get(key);
            if (!data)
                return null;
            return JSON.parse(data);
        }
        catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }
    /**
     * キャッシュにデータを保存
     */
    static async set(key, value, ttlSeconds = 300) {
        try {
            await redis_1.default.setEx(key, ttlSeconds, JSON.stringify(value));
        }
        catch (error) {
            console.error('Cache set error:', error);
        }
    }
    /**
     * キャッシュを削除
     */
    static async del(key) {
        try {
            await redis_1.default.del(key);
        }
        catch (error) {
            console.error('Cache del error:', error);
        }
    }
    /**
     * パターンに一致するキャッシュを削除
     */
    static async delPattern(pattern) {
        try {
            const keys = await redis_1.default.keys(pattern);
            if (keys.length > 0) {
                await Promise.all(keys.map(key => redis_1.default.del(key)));
            }
        }
        catch (error) {
            console.error('Cache delPattern error:', error);
        }
    }
    /**
     * キャッシュキーを生成
     */
    static generateKey(prefix, ...parts) {
        return `${prefix}:${parts.join(':')}`;
    }
}
exports.CacheHelper = CacheHelper;
/**
 * キャッシュTTL定数（秒）
 */
exports.CACHE_TTL = {
    SELLER_LIST: 300, // 5分（Vercelコールドスタート対策）
    SELLER_DETAIL: 300, // 5分
    VALUATION: 600, // 10分
    STATISTICS: 300, // 5分
    SESSION: 86400, // 24時間
    SIDEBAR_COUNTS: 600, // 10分（サイドバーカウント用）
};
