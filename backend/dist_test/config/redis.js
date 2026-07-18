"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = exports.connectRedis = void 0;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// メモリ内セッションストア（Redisが利用できない場合のフォールバック）
class MemoryStore {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }
    async setEx(key, seconds, value) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + seconds * 1000,
        });
        return null;
    }
    async del(key) {
        const existed = this.store.has(key);
        this.store.delete(key);
        return existed ? 1 : 0;
    }
    async keys(pattern) {
        // 簡易的なパターンマッチング（*のみサポート）
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter(key => regex.test(key));
    }
}
// RedisClientTypeをRedisLikeに適合させるラッパー
class RedisClientWrapper {
    constructor(client) {
        this.client = client;
    } // 型チェックをスキップ
    async get(key) {
        const result = await this.client.get(key);
        return result;
    }
    async setEx(key, seconds, value) {
        await this.client.setEx(key, seconds, value);
        return null;
    }
    async del(key) {
        const result = await this.client.del(key);
        return result;
    }
    async keys(pattern) {
        const result = await this.client.keys(pattern);
        return result;
    }
}
let redisClient;
let isRedisConnected = false;
const initRedis = async () => {
    try {
        const client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: false, // 再接続を無効化
            },
        });
        // エラーハンドラーを先に設定（接続前）
        client.on('error', () => {
            // エラーは無視（フォールバックを使用）
        });
        await Promise.race([
            client.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000)),
        ]);
        console.log('✅ Redis connected');
        isRedisConnected = true;
        redisClient = new RedisClientWrapper(client);
    }
    catch (error) {
        console.warn('⚠️ Redis not available, using in-memory session store');
        redisClient = new MemoryStore();
        isRedisConnected = false;
    }
};
const connectRedis = async () => {
    await initRedis();
};
exports.connectRedis = connectRedis;
const getRedisClient = () => {
    if (!redisClient) {
        // 遅延初期化：初回アクセス時にメモリストアを作成
        console.warn('⚠️ Redis client not initialized, using in-memory store');
        redisClient = new MemoryStore();
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
exports.default = {
    get: async (key) => (0, exports.getRedisClient)().get(key),
    setEx: async (key, seconds, value) => (0, exports.getRedisClient)().setEx(key, seconds, value),
    del: async (key) => (0, exports.getRedisClient)().del(key),
    keys: async (pattern) => (0, exports.getRedisClient)().keys(pattern),
};
