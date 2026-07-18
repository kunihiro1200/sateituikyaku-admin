"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
/**
 * 短縮URLのリダイレクト先を取得するAPI
 * フロントエンドからのCORS問題を回避するため
 */
router.get('/resolve', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL parameter is required' });
        }
        console.log('🔗 Resolving shortened URL:', url);
        // HEADリクエストでリダイレクト先を取得
        const response = await axios_1.default.head(url, {
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        const redirectedUrl = response.request.res.responseUrl || url;
        console.log('✅ Redirected URL:', redirectedUrl);
        res.json({
            originalUrl: url,
            redirectedUrl: redirectedUrl,
        });
    }
    catch (error) {
        console.error('❌ Error resolving URL:', error.message);
        res.status(500).json({
            error: 'Failed to resolve URL',
            message: error.message,
        });
    }
});
exports.default = router;
