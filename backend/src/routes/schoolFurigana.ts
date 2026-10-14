/**
 * schoolFurigana.ts
 * 学校名のふりがなをOpenAI APIで自動生成するエンドポイント
 *
 * 対象: 売主番号に "FI" を含む売主（福岡イエウール売主）のみ
 *
 * POST /api/school-furigana/generate
 * Body: { sellerId: string, elementaryName?: string, juniorHighName?: string }
 * Returns: { elementaryFurigana?: string, juniorHighFurigana?: string }
 *
 * 生成結果は seller_attached_document2 に自動保存する。
 */
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * OpenAI Chat Completions API でふりがな取得
 * モデル: gpt-4o-mini（コスト最小）
 */
async function getSchoolFurigana(schoolName: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[schoolFurigana] OPENAI_API_KEY が設定されていません');
    return null;
  }
  if (!schoolName?.trim()) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              '福岡市の学校の名前のふりがなを返してください。',
              '「小学校」「中学校」の読みは含めず、学校固有の名前部分のみをひらがなで返してください。',
              '「福岡市立」「市立」も含めないでください。',
              '例:',
              '「玉川小学校」→「たまがわ」',
              '「春吉中学校」→「はるよし」',
              '「福岡市立大楠小学校」→「おおくす」',
              '「内浜中学校」→「うちはま」',
              'ふりがなのみを返してください。説明は不要です。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: schoolName,
          },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[schoolFurigana] OpenAI API エラー:', response.status, err);
      return null;
    }

    const data = await response.json();
    const furigana = data.choices?.[0]?.message?.content?.trim() || null;

    // ひらがな以外が含まれていたら無効とする
    if (furigana && /^[ぁ-ん・ー]+$/.test(furigana)) {
      return furigana;
    }
    // ひらがな以外が混じっていても返す（ただし警告）
    console.warn('[schoolFurigana] 非ひらがな文字を含む:', furigana);
    return furigana;
  } catch (err: any) {
    console.error('[schoolFurigana] OpenAI 呼び出し失敗:', err.message);
    return null;
  }
}

/**
 * POST /api/school-furigana/generate
 *
 * 学校名からふりがなを生成し、seller_attached_document2 に保存する。
 * FI売主（sellerNumber に 'FI' を含む）のみ対象。
 */
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  const { sellerId, sellerNumber, elementaryName, juniorHighName } = req.body;

  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId が必要です' });
  }

  // FI売主チェック
  if (!sellerNumber || !String(sellerNumber).toUpperCase().includes('FI')) {
    return res.json({
      message: 'FI売主以外はふりがな生成対象外です',
      elementaryFurigana: null,
      juniorHighFurigana: null,
    });
  }

  // 既にふりがなが保存されているか確認
  const { data: existing } = await supabase
    .from('seller_attached_document2')
    .select('elementary_school_furigana, junior_high_school_furigana, elementary_school_name, junior_high_school_name')
    .eq('seller_id', sellerId)
    .maybeSingle();

  // すでにふりがながあり、学校名が変わっていなければスキップ
  const currentElemName = elementaryName || existing?.elementary_school_name;
  const currentJhName   = juniorHighName  || existing?.junior_high_school_name;

  let elemFurigana = existing?.elementary_school_furigana ?? null;
  let jhFurigana   = existing?.junior_high_school_furigana ?? null;

  // 学校名が変わった or ふりがな未設定の場合のみ生成
  const needElem = currentElemName && (
    !elemFurigana || elementaryName !== existing?.elementary_school_name
  );
  const needJh = currentJhName && (
    !jhFurigana || juniorHighName !== existing?.junior_high_school_name
  );

  if (needElem || needJh) {
    // 並列生成
    const [newElemFurigana, newJhFurigana] = await Promise.all([
      needElem ? getSchoolFurigana(currentElemName) : Promise.resolve(elemFurigana),
      needJh   ? getSchoolFurigana(currentJhName)   : Promise.resolve(jhFurigana),
    ]);

    elemFurigana = newElemFurigana;
    jhFurigana   = newJhFurigana;

    // DB に保存
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (elemFurigana !== null) patch.elementary_school_furigana = elemFurigana;
    if (jhFurigana   !== null) patch.junior_high_school_furigana = jhFurigana;

    if (existing) {
      await supabase.from('seller_attached_document2').update(patch).eq('seller_id', sellerId);
    } else {
      await supabase.from('seller_attached_document2').insert({ seller_id: sellerId, ...patch });
    }

    console.log(`[schoolFurigana] 生成完了: ${currentElemName}→${elemFurigana}, ${currentJhName}→${jhFurigana}`);
  }

  return res.json({
    elementaryFurigana: elemFurigana,
    juniorHighFurigana: jhFurigana,
  });
});

export default router;
