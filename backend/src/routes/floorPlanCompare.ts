import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import axios from 'axios';

const router = Router();

/**
 * GoogleドライブのURLからファイルIDを抽出する
 */
function extractGoogleDriveFileId(url: string): string | null {
  // フォルダURL: /folders/FILEID
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // ファイルURL: /file/d/FILEID/ または /d/FILEID/
  const fileMatch = url.match(/\/(?:file\/d|d)\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // open?id=FILEID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

/**
 * GoogleドライブのファイルをBase64で取得する
 * 公開共有リンクの場合はAPIキー不要でダウンロード可能
 */
async function fetchGoogleDriveFileAsBase64(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Google Drive直接ダウンロードURL
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');

    // PDFの場合はnullを返す（Vision APIはPDFを直接処理できない）
    if (contentType.includes('pdf')) {
      return null;
    }

    return { base64, mimeType: contentType.split(';')[0] };
  } catch (err: any) {
    console.warn(`⚠️ ファイル取得失敗 (${fileId}):`, err.message);
    return null;
  }
}

/**
 * URLが画像ファイルかどうかを判定してBase64で取得する
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';

    if (contentType.includes('pdf')) {
      return null;
    }

    const base64 = Buffer.from(response.data).toString('base64');
    return { base64, mimeType: contentType.split(';')[0] };
  } catch (err: any) {
    console.warn(`⚠️ 画像取得失敗 (${url}):`, err.message);
    return null;
  }
}

/**
 * POST /api/floor-plan-compare/from-url
 * 認証不要の公開エンドポイント
 * 2つのGoogleドライブURL（または画像URL）を受け取り、GPT-4oで比較する
 *
 * リクエストボディ:
 * {
 *   originalUrl: string,   // 元図面のURL（GoogleドライブURL or 画像URL）
 *   publishedUrl: string,  // 作成後図面のURL（GoogleドライブURL or 画像URL）
 * }
 */
router.post('/from-url', async (req: Request, res: Response) => {
  try {
    const { originalUrl, publishedUrl } = req.body;

    if (!originalUrl || !publishedUrl) {
      return res.status(400).json({
        error: '元図面のURLと作成後図面のURLの両方を入力してください',
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI APIキーが設定されていません' });
    }

    const openai = new OpenAI({ apiKey });

    // 元図面を取得
    console.log(`[FloorPlanCompare] 元図面取得中: ${originalUrl}`);
    let originalImage: { base64: string; mimeType: string } | null = null;

    const originalFileId = extractGoogleDriveFileId(originalUrl);
    if (originalFileId) {
      originalImage = await fetchGoogleDriveFileAsBase64(originalFileId);
    } else {
      originalImage = await fetchImageAsBase64(originalUrl);
    }

    // 作成後図面を取得
    console.log(`[FloorPlanCompare] 作成後図面取得中: ${publishedUrl}`);
    let publishedImage: { base64: string; mimeType: string } | null = null;

    const publishedFileId = extractGoogleDriveFileId(publishedUrl);
    if (publishedFileId) {
      publishedImage = await fetchGoogleDriveFileAsBase64(publishedFileId);
    } else {
      publishedImage = await fetchImageAsBase64(publishedUrl);
    }

    if (!originalImage && !publishedImage) {
      return res.status(400).json({
        error: '両方の図面を取得できませんでした。URLが正しいか、ファイルが公開共有されているか確認してください。PDFファイルは現在非対応です（JPG/PNG形式をご利用ください）。',
      });
    }

    // GPT-4o Vision で比較
    const contentParts: any[] = [
      {
        type: 'text',
        text: `不動産の間取り図を2枚比較して、以下の項目を詳細にチェックしてください。

## チェック項目
1. **部屋数** - 部屋の数は同じか（LDK、洋室、和室、寝室など）
2. **各部屋の種別** - 洋室・和室・LDK等の種別は一致しているか
3. **各部屋の面積** - 面積の数値表記に違いはあるか
4. **窓の数・位置** - 窓の数と配置は一致しているか
5. **扉の数・向き** - ドアの数・位置・開き方向は一致しているか
6. **収納スペース** - 収納・WIC・押入れ・納戸の有無と位置
7. **水回り設備** - キッチン・浴室・トイレ・洗面台の位置
8. **方位（N方向）** - 北方向の向きは一致しているか
9. **玄関位置** - 玄関の位置は一致しているか
10. **階段位置** - 階段の位置は一致しているか（2階建ての場合）
11. **バルコニー・テラス** - バルコニーやテラスの有無と位置

## 出力形式
各項目を以下の形式で回答してください：
- ✅ 一致: [項目名]
- ⚠️ 差異あり: [項目名] → [具体的な差異の内容]
- ❓ 判定不可: [項目名] → [理由]

最後に「## 総評」として全体的な評価と、特に注意が必要な点をまとめてください。

【図面A】が元図面（原本）、【図面B】が作成後の間取り図です。`,
      },
    ];

    if (originalImage) {
      contentParts.push({ type: 'text', text: '## 図面A（元図面・原本）' });
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${originalImage.mimeType};base64,${originalImage.base64}`,
          detail: 'high',
        },
      });
    } else {
      contentParts.push({
        type: 'text',
        text: '## 図面A（元図面・原本）\n（画像の取得に失敗しました。URLを確認してください）',
      });
    }

    if (publishedImage) {
      contentParts.push({ type: 'text', text: '## 図面B（作成後の間取り図）' });
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${publishedImage.mimeType};base64,${publishedImage.base64}`,
          detail: 'high',
        },
      });
    } else {
      contentParts.push({
        type: 'text',
        text: '## 図面B（作成後の間取り図）\n（画像の取得に失敗しました。URLを確認してください）',
      });
    }

    console.log(`[FloorPlanCompare] GPT-4o Vision 比較開始`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{ role: 'user', content: contentParts }],
    });

    const compareResult = response.choices[0]?.message?.content || '比較結果を取得できませんでした';
    console.log(`[FloorPlanCompare] 比較完了`);

    return res.json({
      success: true,
      result: compareResult,
      originalFetched: !!originalImage,
      publishedFetched: !!publishedImage,
    });
  } catch (error: any) {
    console.error('[FloorPlanCompare] エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
