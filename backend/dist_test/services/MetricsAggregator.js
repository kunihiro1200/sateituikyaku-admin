"use strict";
/**
 * メトリクス集計サービス
 * 詳細メトリクスを時間単位・日単位で集計してパフォーマンスを最適化
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsAggregator = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class MetricsAggregator {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase credentials not configured');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
    }
    /**
     * 時間単位でメトリクスを集計
     */
    async aggregateHourly() {
        console.log('⏰ 時間単位のメトリクス集計を開始...');
        // 最後に集計した時刻を取得
        const { data: lastAgg } = await this.supabase
            .from('sync_metrics_aggregated')
            .select('period_end')
            .eq('aggregation_period', 'hourly')
            .order('period_end', { ascending: false })
            .limit(1)
            .single();
        const startTime = lastAgg?.period_end
            ? new Date(lastAgg.period_end)
            : new Date(Date.now() - 24 * 60 * 60 * 1000); // デフォルトは24時間前
        const endTime = new Date();
        endTime.setMinutes(0, 0, 0); // 現在の時刻の0分に設定
        // 1時間ごとに集計
        let currentHour = new Date(startTime);
        currentHour.setMinutes(0, 0, 0);
        while (currentHour < endTime) {
            const nextHour = new Date(currentHour);
            nextHour.setHours(nextHour.getHours() + 1);
            await this.aggregatePeriod(currentHour, nextHour, 'hourly');
            currentHour = nextHour;
        }
        console.log('✅ 時間単位の集計が完了しました');
    }
    /**
     * 日単位でメトリクスを集計
     */
    async aggregateDaily() {
        console.log('📅 日単位のメトリクス集計を開始...');
        // 最後に集計した日付を取得
        const { data: lastAgg } = await this.supabase
            .from('sync_metrics_aggregated')
            .select('period_end')
            .eq('aggregation_period', 'daily')
            .order('period_end', { ascending: false })
            .limit(1)
            .single();
        const startTime = lastAgg?.period_end
            ? new Date(lastAgg.period_end)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // デフォルトは30日前
        const endTime = new Date();
        endTime.setHours(0, 0, 0, 0); // 今日の0時
        // 1日ごとに集計
        let currentDay = new Date(startTime);
        currentDay.setHours(0, 0, 0, 0);
        while (currentDay < endTime) {
            const nextDay = new Date(currentDay);
            nextDay.setDate(nextDay.getDate() + 1);
            await this.aggregatePeriod(currentDay, nextDay, 'daily');
            currentDay = nextDay;
        }
        console.log('✅ 日単位の集計が完了しました');
    }
    /**
     * 指定期間のメトリクスを集計
     */
    async aggregatePeriod(periodStart, periodEnd, aggregationPeriod) {
        // 期間内のメトリクスを取得
        const { data: metrics, error } = await this.supabase
            .from('sync_metrics')
            .select('metric_type, metric_value')
            .gte('recorded_at', periodStart.toISOString())
            .lt('recorded_at', periodEnd.toISOString());
        if (error) {
            console.error('メトリクス取得エラー:', error);
            return;
        }
        if (!metrics || metrics.length === 0) {
            return; // データがない場合はスキップ
        }
        // メトリクスタイプごとに集計
        const aggregatedByType = {};
        for (const metric of metrics) {
            const type = metric.metric_type;
            if (!aggregatedByType[type]) {
                aggregatedByType[type] = {
                    metric_type: type,
                    aggregation_period: aggregationPeriod,
                    period_start: periodStart,
                    period_end: periodEnd,
                    avg_value: 0,
                    min_value: metric.metric_value,
                    max_value: metric.metric_value,
                    sum_value: 0,
                    count: 0
                };
            }
            const agg = aggregatedByType[type];
            agg.sum_value += metric.metric_value;
            agg.count += 1;
            agg.min_value = Math.min(agg.min_value, metric.metric_value);
            agg.max_value = Math.max(agg.max_value, metric.metric_value);
        }
        // 平均値を計算
        for (const agg of Object.values(aggregatedByType)) {
            agg.avg_value = agg.sum_value / agg.count;
        }
        // データベースに保存
        const records = Object.values(aggregatedByType).map(agg => ({
            metric_type: agg.metric_type,
            aggregation_period: agg.aggregation_period,
            period_start: agg.period_start.toISOString(),
            period_end: agg.period_end.toISOString(),
            avg_value: agg.avg_value,
            min_value: agg.min_value,
            max_value: agg.max_value,
            sum_value: agg.sum_value,
            count: agg.count
        }));
        const { error: insertError } = await this.supabase
            .from('sync_metrics_aggregated')
            .insert(records);
        if (insertError) {
            console.error('集計メトリクス保存エラー:', insertError);
        }
    }
    /**
     * 古い集計メトリクスをクリーンアップ
     */
    async cleanupOldAggregatedMetrics() {
        // 30日より古い時間単位の集計を削除
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        await this.supabase
            .from('sync_metrics_aggregated')
            .delete()
            .eq('aggregation_period', 'hourly')
            .lt('period_end', thirtyDaysAgo);
        // 1年より古い日単位の集計を削除
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        await this.supabase
            .from('sync_metrics_aggregated')
            .delete()
            .eq('aggregation_period', 'daily')
            .lt('period_end', oneYearAgo);
        console.log('✅ 古い集計メトリクスをクリーンアップしました');
    }
    /**
     * 集計メトリクスを取得
     */
    async getAggregatedMetrics(metricType, aggregationPeriod, startDate, endDate) {
        const { data, error } = await this.supabase
            .from('sync_metrics_aggregated')
            .select('*')
            .eq('metric_type', metricType)
            .eq('aggregation_period', aggregationPeriod)
            .gte('period_start', startDate.toISOString())
            .lte('period_end', endDate.toISOString())
            .order('period_start', { ascending: true });
        if (error) {
            console.error('集計メトリクス取得エラー:', error);
            throw error;
        }
        return (data || []).map(d => ({
            metric_type: d.metric_type,
            aggregation_period: d.aggregation_period,
            period_start: new Date(d.period_start),
            period_end: new Date(d.period_end),
            avg_value: d.avg_value,
            min_value: d.min_value,
            max_value: d.max_value,
            sum_value: d.sum_value,
            count: d.count
        }));
    }
}
exports.MetricsAggregator = MetricsAggregator;
