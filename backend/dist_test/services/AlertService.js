"use strict";
/**
 * アラートサービス
 * メトリクスを監視し、閾値を超えた場合にアラートを発行
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const supabase_1 = require("../config/supabase");
// SlackNotifier/EmailNotifier は未実装のためスタブを使用
class SlackNotifier {
    async sendAlert(_message, _severity) {
        console.log('[SlackNotifier] sendAlert called (stub)');
    }
}
class EmailNotifier {
    async sendAlert(_message, _severity) {
        console.log('[EmailNotifier] sendAlert called (stub)');
    }
}
class AlertService {
    constructor() {
        this.slackNotifier = new SlackNotifier();
        this.emailNotifier = new EmailNotifier();
    }
    /**
     * すべてのアラートルールをチェック
     */
    async checkAllAlerts() {
        try {
            // 有効なアラートルールを取得
            const { data: rules, error } = await supabase_1.supabase
                .from('alert_rules')
                .select('*')
                .eq('enabled', true);
            if (error) {
                console.error('アラートルール取得エラー:', error);
                return;
            }
            if (!rules || rules.length === 0) {
                console.log('有効なアラートルールがありません');
                return;
            }
            // 各ルールをチェック
            for (const rule of rules) {
                await this.checkRule(rule);
            }
        }
        catch (error) {
            console.error('アラートチェックエラー:', error);
        }
    }
    /**
     * 個別のアラートルールをチェック
     */
    async checkRule(rule) {
        try {
            // 最新のメトリクス値を取得
            const metricValue = await this.getLatestMetricValue(rule.metric_type);
            if (!metricValue) {
                console.log(`メトリクスが見つかりません: ${rule.metric_type}`);
                return;
            }
            // 条件をチェック
            const isTriggered = this.evaluateCondition(metricValue.value, rule.condition, rule.threshold);
            if (isTriggered) {
                await this.triggerAlert(rule, metricValue);
            }
        }
        catch (error) {
            console.error(`アラートルールチェックエラー (${rule.name}):`, error);
        }
    }
    /**
     * 最新のメトリクス値を取得
     */
    async getLatestMetricValue(metricType) {
        try {
            // 集計済みメトリクスから最新の時間単位データを取得
            const { data, error } = await supabase_1.supabase
                .from('sync_metrics_aggregated')
                .select('metric_type, avg_value, period_start')
                .eq('metric_type', metricType)
                .eq('aggregation_period', 'hourly')
                .order('period_start', { ascending: false })
                .limit(1)
                .single();
            if (error || !data) {
                return null;
            }
            return {
                metric_type: data.metric_type,
                value: data.avg_value,
                timestamp: new Date(data.period_start)
            };
        }
        catch (error) {
            console.error('メトリクス値取得エラー:', error);
            return null;
        }
    }
    /**
     * 条件を評価
     */
    evaluateCondition(value, condition, threshold) {
        switch (condition) {
            case 'greater_than':
                return value > threshold;
            case 'less_than':
                return value < threshold;
            case 'equals':
                return value === threshold;
            default:
                return false;
        }
    }
    /**
     * アラートをトリガー
     */
    async triggerAlert(rule, metric) {
        try {
            // アラート履歴を記録
            const { data: alert, error } = await supabase_1.supabase
                .from('alert_history')
                .insert({
                rule_id: rule.id,
                triggered_at: new Date().toISOString(),
                metric_value: metric.value,
                severity: rule.severity,
                message: this.buildAlertMessage(rule, metric),
                resolved: false
            })
                .select()
                .single();
            if (error) {
                console.error('アラート履歴記録エラー:', error);
                return;
            }
            // 通知を送信
            await this.sendNotifications(rule, metric, alert.id);
        }
        catch (error) {
            console.error('アラートトリガーエラー:', error);
        }
    }
    /**
     * アラートメッセージを構築
     */
    buildAlertMessage(rule, metric) {
        const conditionText = this.getConditionText(rule.condition);
        return `アラート: ${rule.name}\n` +
            `メトリクス: ${rule.metric_type}\n` +
            `現在値: ${metric.value.toFixed(2)}\n` +
            `条件: ${conditionText} ${rule.threshold}\n` +
            `重要度: ${rule.severity}\n` +
            `時刻: ${metric.timestamp.toISOString()}`;
    }
    /**
     * 条件テキストを取得
     */
    getConditionText(condition) {
        switch (condition) {
            case 'greater_than':
                return '>';
            case 'less_than':
                return '<';
            case 'equals':
                return '=';
            default:
                return '?';
        }
    }
    /**
     * 通知を送信
     */
    async sendNotifications(rule, metric, alertId) {
        const message = this.buildAlertMessage(rule, metric);
        for (const channel of rule.notification_channels) {
            try {
                if (channel === 'slack') {
                    await this.slackNotifier.sendAlert(message, rule.severity);
                }
                else if (channel === 'email') {
                    await this.emailNotifier.sendAlert(message, rule.severity);
                }
            }
            catch (error) {
                console.error(`通知送信エラー (${channel}):`, error);
            }
        }
    }
    /**
     * アラートを解決済みにマーク
     */
    async resolveAlert(alertId) {
        try {
            const { error } = await supabase_1.supabase
                .from('alert_history')
                .update({
                resolved: true,
                resolved_at: new Date().toISOString()
            })
                .eq('id', alertId);
            if (error) {
                console.error('アラート解決エラー:', error);
            }
        }
        catch (error) {
            console.error('アラート解決エラー:', error);
        }
    }
}
exports.AlertService = AlertService;
