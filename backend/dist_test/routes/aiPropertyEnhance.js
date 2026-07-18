"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = (0, express_1.Router)();
/**
 * スクレイピングデータをAI（Claude/OpenAI）で解析・整形するエンドポイント
 * POST /api/ai/enhance-property-data
 */
router.post('/enhance-property-data', async (req, res) => {
    try {
        const { propertyData } = req.body;
        if (!propertyData) {
            return res.status(400).json({ error: 'propertyDataが必要です' });
        }
        // Claude APIを使用（OpenAIより日本語の理解が優れている）
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
        }
        const client = new sdk_1.default({ apiKey });
        // プロンプト作成
        const prompt = `
あなたは不動産物件情報を整理・整形する専門家です。
以下のスクレイピングデータを解析し、印刷用に最適化された形式で返してください。

# 入力データ
${JSON.stringify(propertyData, null, 2)}

# 出力形式
以下のJSON形式で返してください：

{
  "address": "物件の所在地（市区町村レベルまで）",
  "price": "価格（万円表記）",
  "access": "最寄り駅からのアクセス",
  "layout": "間取り（例：4LDK）",
  "area": "専有面積（例：94.34m²）",
  "floor": "階数（例：8階/15階建）",
  "built_year": "築年月（例：2000年2月）",
  "parking": "駐車場情報",
  "features": "主要な設備・サービス（箇条書き、最大5つ）",
  "highlights": "物件の魅力ポイント（3つ）",
  "images": {
    "floorPlan": "間取り図のURL",
    "exterior": "外観写真のURL",
    "interior": ["内観写真のURL配列（最大12枚）"]
  },
  "details": {
    "所在地": "詳細な所在地",
    "交通": "交通アクセス",
    "価格": "価格",
    "物件種目": "物件種別",
    "間取り": "間取り",
    "専有面積": "面積",
    "階建/階": "階数",
    "築年月": "築年月",
    "駐車場": "駐車場",
    "土地権利": "土地権利",
    "引渡可能時期": "引渡時期",
    "設備・サービス": "設備・サービスの詳細"
  },
  "lat": 緯度（数値）,
  "lng": 経度（数値）
}

# 注意事項
- 情報が不足している場合は、元のデータから推測せず null を返してください
- 画像URLは元のデータから適切なものを選択してください
- 間取り図は「区画・間取り」カテゴリから選択してください
- 内観写真は「外観・室内」カテゴリから選択してください
- 設備・サービスは読みやすく整形してください（カンマ区切りを改行区切りに）
- 緯度経度は元のデータから取得してください

JSONのみを返してください。説明文は不要です。
`;
        const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        // レスポンスからJSONを抽出
        const responseText = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');
        console.log('[AI Property Enhance] Claude response:', responseText.substring(0, 500));
        // JSONをパース
        let enhanced;
        try {
            // ```json ... ``` で囲まれている場合は除去
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[1] : responseText;
            enhanced = JSON.parse(jsonText);
        }
        catch (parseError) {
            console.error('[AI Property Enhance] JSON parse error:', parseError);
            // パースエラーの場合は元のデータを返す
            enhanced = propertyData;
        }
        return res.json({ enhanced });
    }
    catch (error) {
        console.error('[AI Property Enhance] Error:', error);
        // Claude APIのレート制限エラー
        if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
            return res.status(429).json({
                error: 'AI解析のリクエスト制限に達しました。しばらく待ってから再度お試しください。',
            });
        }
        // その他のエラー
        return res.status(500).json({
            error: 'AI解析に失敗しました',
            details: error?.message || String(error),
        });
    }
});
/**
 * OpenAI GPT-4を使用した代替エンドポイント（フォールバック用）
 * POST /api/ai/enhance-property-data-gpt
 */
router.post('/enhance-property-data-gpt', async (req, res) => {
    try {
        const { propertyData } = req.body;
        if (!propertyData) {
            return res.status(400).json({ error: 'propertyDataが必要です' });
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OPENAI_API_KEYが設定されていません' });
        }
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const prompt = `
あなたは不動産物件情報を整理・整形する専門家です。
以下のスクレイピングデータを解析し、印刷用に最適化された形式で返してください。

# 入力データ
${JSON.stringify(propertyData, null, 2)}

# 出力形式
以下のJSON形式で返してください：

{
  "address": "物件の所在地（市区町村レベルまで）",
  "price": "価格（万円表記）",
  "access": "最寄り駅からのアクセス",
  "layout": "間取り（例：4LDK）",
  "area": "専有面積（例：94.34m²）",
  "floor": "階数（例：8階/15階建）",
  "built_year": "築年月（例：2000年2月）",
  "parking": "駐車場情報",
  "features": "主要な設備・サービス（箇条書き、最大5つ）",
  "highlights": "物件の魅力ポイント（3つ）",
  "images": {
    "floorPlan": "間取り図のURL",
    "exterior": "外観写真のURL",
    "interior": ["内観写真のURL配列（最大12枚）"]
  },
  "details": {
    "所在地": "詳細な所在地",
    "交通": "交通アクセス",
    "価格": "価格",
    "物件種目": "物件種別",
    "間取り": "間取り",
    "専有面積": "面積",
    "階建/階": "階数",
    "築年月": "築年月",
    "駐車場": "駐車場",
    "土地権利": "土地権利",
    "引渡可能時期": "引渡時期",
    "設備・サービス": "設備・サービスの詳細"
  },
  "lat": 緯度（数値）,
  "lng": 経度（数値）
}

JSONのみを返してください。説明文は不要です。
`;
        const completion = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'あなたは不動産物件情報を整理・整形する専門家です。' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2000,
            temperature: 0.3,
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const responseText = completion.data.choices[0].message.content;
        console.log('[AI Property Enhance GPT] Response:', responseText.substring(0, 500));
        // JSONをパース
        let enhanced;
        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[1] : responseText;
            enhanced = JSON.parse(jsonText);
        }
        catch (parseError) {
            console.error('[AI Property Enhance GPT] JSON parse error:', parseError);
            enhanced = propertyData;
        }
        return res.json({ enhanced });
    }
    catch (error) {
        console.error('[AI Property Enhance GPT] Error:', error);
        if (error?.response?.status === 429) {
            return res.status(429).json({
                error: 'OpenAI APIのリクエスト制限に達しました。しばらく待ってから再度お試しください。',
            });
        }
        return res.status(500).json({
            error: 'AI解析に失敗しました',
            details: error?.message || String(error),
        });
    }
});
exports.default = router;
