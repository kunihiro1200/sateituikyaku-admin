import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabaseクライアント
const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// チェック項目の定義（表示順）
const CHECK_ITEMS = [
  { key: 'usage_restriction', label: '用途制限' },
  { key: 'pets', label: 'ペットの飼育' },
  { key: 'piano', label: 'ピアノ・楽器の使用' },
  { key: 'flooring', label: 'フローリング張替え工事' },
  { key: 'renovation', label: 'リフォーム・改修工事全般' },
  { key: 'balcony_exclusive', label: '専用使用権 - バルコニー' },
  { key: 'parking_exclusive', label: '専用使用権 - 専用駐車場' },
  { key: 'bicycle_exclusive', label: '専用使用権 - 専用駐輪場' },
  { key: 'garden_exclusive', label: '専用使用権 - 専用庭' },
  { key: 'storage_exclusive', label: '専用使用権 - 専用倉庫' },
  { key: 'sublease', label: '民泊・短期賃貸（Airbnb等）' },
  { key: 'parking', label: '駐車場・駐輪場の利用' },
  { key: 'noise', label: '騒音・生活音の制限' },
  { key: 'garbage', label: 'ゴミ出しルール' },
  { key: 'subletting', label: '専有部分の第三者への貸与' },
];

/**
 * POST /api/management-rules/analyze
 * 管理規約のPDF/画像を解析して項目ごとの条文を抽出
 *
 * リクエスト形式: JSON { files: [{ name, mimeType, base64 }] }
 * - PDFはそのままClaudeに送信（画像変換不要）
 * - 画像（JPEG/PNG等）もそのまま送信
 * - テキストPDF・スキャンPDF両方対応
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { files } = req.body as {
      files: Array<{ name: string; mimeType: string; base64: string }>;
    };

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
    }

    const client = new Anthropic({ apiKey });

    // チェック項目リスト
    const itemsDetail = CHECK_ITEMS.map((item) => `- "${item.key}": ${item.label}`).join('\n');

    // コンテンツブロックを構築
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/pdf') {
        // PDFはdocumentタイプで直接送信（テキストPDF・スキャンPDF両方対応）
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        } as any);
      } else {
        // 画像ファイル
        const mediaType = file.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: file.base64,
          },
        });
      }
    }

    // プロンプトを追加
    contentBlocks.push({
      type: 'text',
      text: `あなたはマンション管理規約の専門家です。
添付された管理規約の文書を読み取り、以下の各項目について該当する条文を抽出してください。

【抽出するkey一覧】
${itemsDetail}

【重要ルール】
1. 条文番号（第○条）とページ番号を含めること
2. 原文に近い形で記載すること
3. 「第○条に基づき〜」のような参照がある場合は、参照先の条文内容も合わせて記載すること
4. 「別表第○」「別表○」が参照されている場合：
   - 必ずその別表を探して、表の全内容をMarkdown形式で記載すること
   - Markdown表の書き方: 1行目にヘッダー、2行目に「|---|---|」、3行目以降にデータ
   - 例：
     第14条の規定による。

     | 専用使用部分 | 位置 | 専用使用権者 |
     |---|---|---|
     | バルコニー | 各住戸に接する | 各住戸の区分所有者 |
     | 玄関扉・窓枠・窓ガラス | 各住戸に付属する | 各住戸の区分所有者 |
     | 自転車置場 | 位置図の通り | 各住戸の区分所有者 |
     | 駐車場 | 位置図の通り | 各住戸の区分所有者 |
   - 別表が見つからない場合のみ「（別表第○ 参照）」と付記すること
5. 見つからない場合はnull
6. 必ず以下のJSON形式のみで応答すること（説明文・コードブロック記号は不要）

{"usage_restriction":null,"pets":null,"piano":null,"flooring":null,"renovation":null,"balcony_exclusive":null,"parking_exclusive":null,"bicycle_exclusive":null,"garden_exclusive":null,"storage_exclusive":null,"sublease":null,"parking":null,"noise":null,"garbage":null,"subletting":null}`,
    });

    // Claude APIに送信（PDF直接対応）
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    console.log('[management-rules] Claude response (first 300):', responseText.substring(0, 300));
    console.log('[management-rules] stop_reason:', response.stop_reason);

    let extractedData: Record<string, string | null> = {};

    // JSONを抽出（コードブロックあり・なし両対応）
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (jsonStr) {
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[management-rules] JSON parse error:', parseError);
        // パース失敗でも空結果として返す（エラーにしない）
        extractedData = {};
      }
    } else {
      console.warn('[management-rules] No JSON in response:', responseText.substring(0, 200));
      extractedData = {};
    }

    const results = CHECK_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      content: extractedData[item.key] ?? null,
      found: extractedData[item.key] != null,
    }));

    return res.json({
      success: true,
      fileCount: files.length,
      results,
    });

  } catch (error: any) {
    console.error('管理規約解析エラー:', error?.message || error);

    // Claudeのレート制限
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'APIのレート制限に達しました。しばらく待ってから再試行します。',
        },
      });
    }

    return res.status(500).json({
      error: error?.message || '解析中にエラーが発生しました',
    });
  }
});

/**
 * POST /api/management-rules/summarize
 * 条文テキストを要約する
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { label, content } = req.body as { label: string; content: string };

    if (!content) {
      return res.status(400).json({ error: 'content が必要です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY が設定されていません' });
    }

    const axios = (await import('axios')).default;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: 'マンション管理規約の条文を、不動産業者が買主・売主に説明できるよう、3〜5文の平易な日本語で要約してください。専門用語は避け、具体的な制限内容を明確に伝えてください。',
          },
          {
            role: 'user',
            content: `【項目】${label}\n\n【条文】\n${content}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const summary = response.data?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({ summary });

  } catch (error: any) {
    console.error('要約エラー:', error?.response?.data || error.message);
    return res.status(500).json({ error: '要約に失敗しました' });
  }
});

/**
 * POST /api/management-rules/save
 * 解析結果をDBに保存（物件番号ごとにupsert）
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { propertyNumber, results } = req.body as {
      propertyNumber: string;
      results: Array<{ key: string; label: string; content: string | null; found: boolean }>;
    };

    if (!propertyNumber) {
      return res.status(400).json({ error: 'propertyNumber が必要です' });
    }
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results が必要です' });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('management_rules_analysis')
      .upsert(
        {
          property_number: propertyNumber,
          results: results,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: 'property_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('[management-rules/save] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[management-rules/save] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/management-rules/:propertyNumber
 * 物件番号で保存済み解析結果を取得
 */
router.get('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('management_rules_analysis')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data: data || null });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/management-rules/transfer-to-spreadsheet
 * 管理規約解析結果をスプレッドシートの「重説」シートに転記
 */
router.post('/transfer-to-spreadsheet', async (req: Request, res: Response) => {
  try {
    const { propertyNumber, spreadsheetUrl, results } = req.body as {
      propertyNumber: string;
      spreadsheetUrl: string;
      results: Array<{ key: string; label: string; content: string | null; found: boolean }>;
    };

    if (!propertyNumber) {
      return res.status(400).json({ error: 'propertyNumber が必要です' });
    }
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'spreadsheetUrl が必要です' });
    }
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results が必要です' });
    }

    // スプレッドシートIDを抽出
    const spreadsheetIdMatch = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!spreadsheetIdMatch) {
      return res.status(400).json({ error: '無効なスプレッドシートURLです' });
    }
    const spreadsheetId = spreadsheetIdMatch[1];

    // GoogleSheetsClientをインポート
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');

    // 重説シートに接続
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: '重説',
    });

    await sheetsClient.authenticate();

    // 転記データを準備
    const transferData: Record<string, any> = {};

    // ヘルパー関数: 条文番号やページ番号を抽出（複数対応）
    const extractReferences = (content: string): string => {
      const references: string[] = [];
      
      // 第○条を抽出
      const articleMatches = content.matchAll(/第(\d+)条/g);
      for (const match of articleMatches) {
        const ref = `第${match[1]}条`;
        if (!references.includes(ref)) {
          references.push(ref);
        }
      }
      
      // ページ番号を抽出
      const pageMatches = content.matchAll(/(?:ページ|p\.?)\s*(\d+)/gi);
      for (const match of pageMatches) {
        const ref = `${match[1]}ページ`;
        if (!references.includes(ref)) {
          references.push(ref);
        }
      }
      
      return references.join('、');
    };

    // ヘルパー関数: 条文番号やページ番号を除去して内容のみを抽出
    const extractContentOnly = (text: string, maxLength: number): string => {
      // 条文番号やページ番号のパターンを除去
      let content = text
        // 第○条（○○）を除去
        .replace(/第\d+条[（(][^)）]*[)）]/g, '')
        // 第○条を除去
        .replace(/第\d+条/g, '')
        // ページ番号を除去
        .replace(/(?:ページ|p\.?)\s*\d+/gi, '')
        .replace(/[（(]\d+ページ[)）]/g, '')
        // 使用細則第○条第○項を除去
        .replace(/使用細則第\d+条第?\d*項?/g, '')
        // 管理規約第○条第○項を除去
        .replace(/管理規約第\d+条第?\d*項?/g, '')
        // 「により」「を遵守」を除去
        .replace(/により|を遵守。?/g, '')
        // 「使用細則」単体を除去
        .replace(/使用細則/g, '')
        // 「管理規約」単体を除去
        .replace(/管理規約/g, '')
        // 先頭の句読点・空白・コロンを除去
        .replace(/^[、。：:\s]+/, '')
        // 末尾の句読点・空白を除去
        .replace(/[、。：:\s]+$/, '')
        .trim();
      
      // 空になった場合や、あまりにも短い場合は元のテキストから再抽出
      if (!content || content.length < 10) {
        // 「：」以降の内容を抽出（条文の説明部分）
        const colonMatch = text.match(/[：:]\s*(.+)/);
        if (colonMatch && colonMatch[1]) {
          content = colonMatch[1]
            .replace(/第\d+条/g, '')
            .replace(/(?:ページ|p\.?)\s*\d+/gi, '')
            .replace(/[（(]\d+ページ[)）]/g, '')
            .trim();
        }
        
        // それでも短い場合は元のテキストを使用
        if (!content || content.length < 10) {
          content = text;
        }
      }
      
      // 指定文字数以内に切り詰め
      if (content.length <= maxLength) return content;
      return content.substring(0, maxLength - 1) + '…';
    };

    // ヘルパー関数: 専用使用なしうる者の範囲を判定
    const determineUserRange = (content: string): string => {
      if (content.includes('区分所有者') || content.includes('各住戸')) {
        return '区分所有者に限る';
      }
      if (content.includes('区分所有者、占有者') || content.includes('占有者')) {
        return '区分所有者、占有者に限らない';
      }
      return '区分所有者に限る'; // デフォルト
    };

    // ヘルパー関数: 専用使用料の有無を判定（厳格版）
    const hasFee = (content: string): boolean => {
      // 「無償」「発生しない」「不要」などの否定表現がある場合は明確に「無」
      if (/無償|発生しない|不要|徴収しない|負担なし|無料/.test(content)) {
        return false;
      }
      
      // 金額が明示されている場合のみ「有」
      // 例: 「月額○○円」「○○円/月」「金○○円」
      if (/\d+円|金\d+|月額\d+/.test(content)) {
        return true;
      }
      
      // 「使用料を徴収」「使用料を支払」など、明確に料金が発生する表現がある場合のみ「有」
      if (/使用料を徴収|使用料を支払|使用料の支払|料金を徴収/.test(content)) {
        return true;
      }
      
      // それ以外は「無」（デフォルト）
      return false;
    };

    // ヘルパー関数: 支払先を判定
    const determinePayee = (content: string): string => {
      if (content.includes('管理組合')) return '管理組合';
      if (content.includes('管理会社')) return '管理会社';
      if (content.includes('理事会')) return '理事会';
      return '管理組合'; // デフォルト
    };

    // ヘルパー関数: 用途制限の種類を判定
    const determineUsageRestriction = (content: string): string => {
      const lowerContent = content.toLowerCase();
      
      // 住居専用の判定
      if (/住居専用|居住専用|住宅専用|居住の用/.test(content)) {
        return '住居専用';
      }
      
      // 店舗専用の判定
      if (/店舗専用|店舗の用/.test(content)) {
        return '店舗専用';
      }
      
      // 事務所専用の判定
      if (/事務所専用|事務所の用/.test(content)) {
        return '事務所専用';
      }
      
      // デフォルトは住居専用
      return '住居専用';
    };

    // 1. 用途制限（L410, AS410）
    const usageRestriction = results.find(r => r.key === 'usage_restriction');
    if (usageRestriction?.found && usageRestriction.content) {
      // L410: 用途制限の種類を判定
      transferData['L410'] = determineUsageRestriction(usageRestriction.content);
      // AS410: 条文番号やページ番号
      const refs = extractReferences(usageRestriction.content);
      if (refs) transferData['AS410'] = refs;
    }

    // 2. ペットの飼育（L411, V411, AS411に条文番号追加）
    const pets = results.find(r => r.key === 'pets');
    if (pets?.found && pets.content) {
      transferData['L411'] = true;
      // V411: 内容のみ（条文番号除去）
      transferData['V411'] = extractContentOnly(pets.content, 52);
      // AS411: 条文番号を追加
      const refs = extractReferences(pets.content);
      if (refs) {
        transferData['AS411'] = transferData['AS411'] 
          ? `${transferData['AS411']}、${refs}` 
          : refs;
      }
    }

    // 3. ピアノの使用（L412, V412, AS411に条文番号追加）
    const piano = results.find(r => r.key === 'piano');
    if (piano?.found && piano.content) {
      transferData['L412'] = true;
      // V412: 内容のみ（条文番号除去）
      transferData['V412'] = extractContentOnly(piano.content, 52);
      // AS411: 条文番号を追加
      const refs = extractReferences(piano.content);
      if (refs) {
        transferData['AS411'] = transferData['AS411'] 
          ? `${transferData['AS411']}、${refs}` 
          : refs;
      }
    }

    // 4. フローリング張替え工事（L413, Z413, AS411に条文番号追加）
    const flooring = results.find(r => r.key === 'flooring');
    if (flooring?.found && flooring.content) {
      transferData['L413'] = true;
      // Z413: 内容のみ（条文番号除去）
      transferData['Z413'] = extractContentOnly(flooring.content, 40);
      // AS411: 条文番号を追加
      const refs = extractReferences(flooring.content);
      if (refs) {
        transferData['AS411'] = transferData['AS411'] 
          ? `${transferData['AS411']}、${refs}` 
          : refs;
      }
    }

    // 5. 上記以外の利用の制限（L414, S414, AS411に条文番号追加）
    const renovation = results.find(r => r.key === 'renovation');
    if (renovation?.found && renovation.content) {
      transferData['L414'] = true;
      // S414: 内容のみ（条文番号除去）
      transferData['S414'] = extractContentOnly(renovation.content, 52);
      // AS411: 条文番号を追加
      const refs = extractReferences(renovation.content);
      if (refs) {
        transferData['AS411'] = transferData['AS411'] 
          ? `${transferData['AS411']}、${refs}` 
          : refs;
      }
    }

    // 6. 専用使用権 - バルコニー（M419, Q419, AE419, AI419）
    const balconyExclusive = results.find(r => r.key === 'balcony_exclusive');
    if (balconyExclusive?.found && balconyExclusive.content) {
      transferData['M419'] = '有';
      transferData['Q419'] = determineUserRange(balconyExclusive.content);
      const fee = hasFee(balconyExclusive.content);
      transferData['AE419'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI419'] = determinePayee(balconyExclusive.content);
      }
    }

    // 7. 専用使用権 - 専用駐車場（M420, Q420, AE420, AI420）
    const parkingExclusive = results.find(r => r.key === 'parking_exclusive');
    if (parkingExclusive?.found && parkingExclusive.content) {
      transferData['M420'] = '有';
      transferData['Q420'] = determineUserRange(parkingExclusive.content);
      const fee = hasFee(parkingExclusive.content);
      transferData['AE420'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI420'] = determinePayee(parkingExclusive.content);
      }
    }

    // 8. 専用使用権 - 専用駐輪場（M421, Q421, AE421, AI421）
    const bicycleExclusive = results.find(r => r.key === 'bicycle_exclusive');
    if (bicycleExclusive?.found && bicycleExclusive.content) {
      transferData['M421'] = '有';
      transferData['Q421'] = determineUserRange(bicycleExclusive.content);
      const fee = hasFee(bicycleExclusive.content);
      transferData['AE421'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI421'] = determinePayee(bicycleExclusive.content);
      }
    }

    // 9. 専用使用権 - 専用庭（M422, Q422, AE422, AI422）
    const gardenExclusive = results.find(r => r.key === 'garden_exclusive');
    if (gardenExclusive?.found && gardenExclusive.content) {
      transferData['M422'] = '有';
      transferData['Q422'] = determineUserRange(gardenExclusive.content);
      const fee = hasFee(gardenExclusive.content);
      transferData['AE422'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI422'] = determinePayee(gardenExclusive.content);
      }
    }

    // 10. 専用使用権 - 専用倉庫（M423, Q423, AE423, AI423）
    const storageExclusive = results.find(r => r.key === 'storage_exclusive');
    if (storageExclusive?.found && storageExclusive.content) {
      transferData['M423'] = '有';
      transferData['Q423'] = determineUserRange(storageExclusive.content);
      const fee = hasFee(storageExclusive.content);
      transferData['AE423'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI423'] = determinePayee(storageExclusive.content);
      }
    }

    // 11. 専用使用権 - ルーフバルコニー（M424, Q424, AE424, AI424）
    // ルーフバルコニーは別表に含まれる可能性があるため、balcony_exclusiveから判定
    if (balconyExclusive?.found && balconyExclusive.content?.includes('ルーフバルコニー')) {
      transferData['M424'] = '有';
      transferData['Q424'] = determineUserRange(balconyExclusive.content);
      const fee = hasFee(balconyExclusive.content);
      transferData['AE424'] = fee ? '有' : '無';
      if (fee) {
        transferData['AI424'] = determinePayee(balconyExclusive.content);
      }
    }

    // スプレッドシートに書き込み
    const { google } = await import('googleapis');
    const sheets = google.sheets({ version: 'v4', auth: sheetsClient.getAuth() });

    const updateRequests: any[] = [];

    for (const [cell, value] of Object.entries(transferData)) {
      updateRequests.push({
        range: `重説!${cell}`,
        values: [[value]],
      });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateRequests,
        },
      });
    }

    return res.json({
      success: true,
      transferredCells: Object.keys(transferData).length,
      message: `${Object.keys(transferData).length}個のセルに転記しました`,
      details: transferData,
    });

  } catch (error: any) {
    console.error('[management-rules/transfer-to-spreadsheet] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
