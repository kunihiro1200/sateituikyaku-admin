"use strict";
/**
 * Prometheusメトリクスエンドポイント
 * 同期メトリクスをPrometheus形式で公開
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SyncMetricsCollector_1 = require("../services/SyncMetricsCollector");
const router = express_1.default.Router();
const metricsCollector = new SyncMetricsCollector_1.SyncMetricsCollector();
/**
 * GET /metrics
 * Prometheusフォーマットのメトリクスを取得
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await metricsCollector.getPrometheusMetrics();
        // Prometheusフォーマットのコンテンツタイプを設定
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    }
    catch (error) {
        console.error('[Metrics] メトリクス取得エラー:', error);
        res.status(500).send('# Error generating metrics\n');
    }
});
exports.default = router;
