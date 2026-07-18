"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cache_1 = require("../utils/cache");
const redis_1 = __importDefault(require("../config/redis"));
const router = (0, express_1.Router)();
/**
 * DELETE /cache/seller/:id
 * 指定された売主のキャッシュをクリア
 */
router.delete('/seller/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Seller ID is required',
                },
            });
        }
        // 売主詳細のキャッシュをクリア
        const cacheKey = cache_1.CacheHelper.generateKey('seller', id);
        await cache_1.CacheHelper.del(cacheKey);
        console.log(`✅ Cache cleared for seller: ${id}`);
        res.json({
            success: true,
            message: 'Cache cleared successfully',
        });
    }
    catch (error) {
        console.error('❌ Failed to clear cache:', error);
        // キャッシュクリアの失敗は致命的ではないので、成功として返す
        res.json({
            success: true,
            message: 'Cache clear attempted (error ignored)',
            warning: error.message,
        });
    }
});
/**
 * DELETE /cache/sellers/list
 * 売主リストのキャッシュをクリア
 */
router.delete('/sellers/list', async (req, res) => {
    try {
        // 売主リストのキャッシュパターンをクリア
        await cache_1.CacheHelper.delPattern('sellers:list:*');
        console.log('✅ Cache cleared for sellers list');
        res.json({
            success: true,
            message: 'Sellers list cache cleared successfully',
        });
    }
    catch (error) {
        console.error('❌ Failed to clear sellers list cache:', error);
        res.json({
            success: true,
            message: 'Cache clear attempted (error ignored)',
            warning: error.message,
        });
    }
});
/**
 * DELETE /cache/all
 * Redis全キャッシュをクリア（緊急用）
 */
router.delete('/all', async (req, res) => {
    try {
        const keys = await redis_1.default.keys('*');
        let deleted = 0;
        for (const key of keys) {
            await redis_1.default.del(key);
            deleted++;
        }
        console.log(`✅ All Redis cache cleared: ${deleted} keys deleted`);
        res.json({
            success: true,
            message: `All Redis cache cleared: ${deleted} keys deleted`,
        });
    }
    catch (error) {
        console.error('❌ Failed to clear all cache:', error);
        res.json({
            success: false,
            message: 'Failed to clear all cache',
            warning: error.message,
        });
    }
});
exports.default = router;
