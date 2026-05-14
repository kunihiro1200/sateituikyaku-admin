import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import axios from 'axios';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// ============================================================
// Google Drive サービスアカウント認証
// ============================================================

function getGoogleAuth() {
  try {
    let keyFile: any;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (keyFile.private_key) {
        keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
      }
    } else {
      const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
      const absolutePath = path.resolve(__dirname, '../../', keyPath);
      if (!fs.existsSync(absolutePath)) return null;
      keyFile = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }
    return new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } catch {
    return null;
  }
}

// ============================================================
// URL解析ユーティリティ
// ============================================================

interface DriveUrlInfo {
  type: 'file' | 'folder' | 'unknown';
  id: string | null;
}

function parseDriveUrl(url: string): DriveUrlInfo {
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return { type: 'folder', id: folderMatch[1] };

  const fileMatch = url.match(/\/(?:file\/d|d)\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return { type: 'file', id: fileMatch[1] };

  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return { type: 'file', id: openMatch[1] };

  return { type: 'unknown', id: null };
}

// ============================================================
// ファイル名による間取り図判定
// ============================================================

// 間取り図として優先するキーワード
const FLOOR_PLAN_KEYWORDS = [
  '間取', 'madori', 'floor', '図面', 'layout', 'plan',
  '1f', '2f', '3f', '1階', '2階', '3階',
  'floorplan', 'floor_plan', 'floor-plan',
];

// 間取り図ではないキーワード（外観・現地写真など）
const NON_FLOOR_PLAN_KEYWORDS = [
  '外観', '外壁', '現地', '写真', 'photo', 'img_', 'dsc_', 'dsc0',
  '道路', '前面', '周辺', '地図', 'map', '公図', '謄本',
  '登記', '測量', '重説', '契約', '領収', '請求', '見積',
  'panorama', 'pano',
];

function isLikelyFloorPlan(fileName: string): 'yes' | 'no' | 'maybe' {
  const lower = fileName.toLowerCase();

  for (const kw of NON_FLOOR_PLAN_KEYWORDS) {
    if (lower.includes(kw)) return 'no';
  }

  for (const kw of FLOOR_PLAN_KEYWORDS) {
    if (lower.includes(kw)) return 'yes';
  }

  return 'maybe';
}

// ============================================================
// フォルダ内ファイル一覧取得（サービスアカウント使用）
// ============================================================

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  likelyFloorPlan: 'yes' | 'no' | 'maybe';
}

async function listFilesInFolder(folderId: string): Promise<DriveFileInfo[]> {
  const auth = getGoogleAuth();
  if (!auth) {
    throw new Error('Google Drive認証が設定されていません（GOOGLE_SERVICE_ACCOUNT_JSON）');
  }

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient as any });

  const imageMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
  ];
  const mimeQuery = imageMimeTypes.map(m => `mimeType='${m}'`).join(' or ');

  const res = await drive.files.list({
    q: `'${folderId}' in parents and (${mimeQuery}) and trashed=false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 200,
    orderBy: 'name',
  });

  const files = (res.data.files || []) as { id: string; name: string; mimeType: string }[];
  return files.map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    likelyFloorPlan: isLikelyFloorPlan(f.name),
  }));
}

// ============================================================
// ファイルをBase64で取得（サービスアカウント優先、公開URLフォールバック）
// ============================================================

async function fetchFileAsBase64(
  fileId: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string } | null> {
  if (mimeType === 'application/pdf') return null;

  // サービスアカウント認証でダウンロード
  try {
    const auth = getGoogleAuth();
    if (auth) {
      const authClient = await auth.getClient();
      const drive = google.drive({ version: 'v3', auth: authClient as any });
      const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );
      const base64 = Buffer.from(res.data as ArrayBuffer).toString('base64');
      return { base64, mimeType };
    }
  } catch (err: any) {
    console.warn(`⚠️ サービスアカウントでの取得失敗 (${fileId}):`, err.message);
  }

  // 公開共有リンク経由でフォールバック
  try {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const contentType = (response.headers['content-type'] || mimeType).split(';')[0];
    if (contentType.includes('pdf') || contentType.includes('html')) return null;
    const base64 = Buffer.from(response.data).toString('base64');
    return { base64, mimeType: contentType };
  } catch (err: any) {
    console.warn(`⚠️ 公開URLでの取得失敗 (${fileId}):`, err.message);
    return null;
  }
}

// ============================================================
// フォルダから間取り図を自動選択（AI判定付き）
// ============================================================

interface SelectedFloorPlan {
  image: { base64: string; mimeType: string };
  fileName: string;
  fileId: string;
  selectionReason: string;
}

async function selectFloorPlanFromFolder(
  folderId: string,
  openai: OpenAI
): Promise<SelectedFloorPlan | null> {
  const files = await listFilesInFolder(folderId);

  if (files.length === 0) {
    throw new Error('フォルダ内に画像ファイル（JPG/PNG）が見つかりませんでした');
  }

  console.log(`[FloorPlanCompare] フォルダ内ファイル数: ${files.length}`);
  files.forEach(f => console.log(`  - ${f.name} (${f.mimeType}) → ${f.likelyFloorPlan}`));

  // ファイル名で分類
  const yesFiles = files.filter(f => f.likelyFloorPlan === 'yes');
  const maybeFiles = files.filter(f => f.likelyFloorPlan === 'maybe');
  const noFiles = files.filter(f => f.likelyFloorPlan === 'no');

  // 優先順位: yes → maybe → no（最後の手段）
  const candidates = yesFiles.length > 0 ? yesFiles
    : maybeFiles.length > 0 ? maybeFiles
    : noFiles;

  console.log(`[FloorPlanCompare] 候補: yes=${yesFiles.length}, maybe=${maybeFiles.length}, no=${noFiles.length}`);

  // 候補ファイルを順番に試す
  for (const file of candidates) {
    const imageData = await fetchFileAsBase64(file.id, file.mimeType);
    if (!imageData) continue;

    // ファイル名で確実に間取り図と判断できる場合はAI判定をスキップ
    if (file.likelyFloorPlan === 'yes') {
      console.log(`[FloorPlanCompare] ファイル名で間取り図と判定: ${file.name}`);
      return {
        image: imageData,
        fileName: file.name,
        fileId: file.id,
        selectionReason: `ファイル名「${file.name}」から間取り図と判定`,
      };
    }

    // AIで間取り図かどうか判定（低解像度で高速・低コスト）
    try {
      const aiRes = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'この画像は不動産の間取り図ですか？「はい」または「いいえ」のみで答えてください。',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageData.mimeType};base64,${imageData.base64}`,
                detail: 'low',
              },
            },
          ],
        }],
      });
      const answer = aiRes.choices[0]?.message?.content?.trim() || '';
      if (answer.includes('はい') || answer.toLowerCase().includes('yes')) {
        console.log(`[FloorPlanCompare] AIで間取り図と判定: ${file.name}`);
        return {
          image: imageData,
          fileName: file.name,
          fileId: file.id,
          selectionReason: `AIが間取り図と判定（ファイル名: ${file.name}）`,
        };
      } else {
        console.log(`[FloorPlanCompare] AIで間取り図でないと判定: ${file.name} → ${answer}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ AI判定失敗: ${file.name}`, err.message);
      // AI判定失敗時はそのファイルを使用
      return {
        image: imageData,
        fileName: file.name,
        fileId: file.id,
        selectionReason: `AI判定失敗のため使用（ファイル名: ${file.name}）`,
      };
    }
  }

  return null;
}

// ============================================================
// GET /api/floor-plan-compare/list-files
// フォルダ内のファイル一覧を返す（フロントエンドのプレビュー用）
// ============================================================

router.get('/list-files', async (req: Request, res: Response) => {
  try {
    const { url } = req.query as { url: string };
    if (!url) return res.status(400).json({ error: 'url パラメータが必要です' });

    const parsed = parseDriveUrl(url);
    if (parsed.type !== 'folder' || !parsed.id) {
      return res.status(400).json({ error: 'フォルダURLを入力してください（/folders/... の形式）' });
    }

    const files = await listFilesInFolder(parsed.id);
    return res.json({
      folderId: parsed.id,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        likelyFloorPlan: f.likelyFloorPlan,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${f.id}&sz=w200`,
        viewUrl: `https://drive.google.com/file/d/${f.id}/view`,
      })),
    });
  } catch (error: any) {
    console.error('[FloorPlanCompare] list-files エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/floor-plan-compare/from-url
// メイン比較エンドポイント（認証不要・公開）
//
// リクエストボディ:
// {
//   originalUrl: string,      // 元図面のURL（フォルダURL or ファイルURL）
//   publishedUrl: string,     // 作成後図面のURL（フォルダURL or ファイルURL）
//   originalFileId?: string,  // フォルダの場合にユーザーが選択したファイルID
//   publishedFileId?: string,
// }
// ============================================================

router.post('/from-url', async (req: Request, res: Response) => {
  try {
    const { originalUrl, publishedUrl, originalFileId, publishedFileId } = req.body;

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

    // ---- 元図面を取得 ----
    console.log(`[FloorPlanCompare] 元図面取得中: ${originalUrl}`);
    let originalImage: { base64: string; mimeType: string } | null = null;
    let originalFileName = '元図面';
    let originalSelectionNote = '';

    const origParsed = parseDriveUrl(originalUrl);

    if (origParsed.type === 'folder' && origParsed.id) {
      if (originalFileId) {
        // ユーザーが特定ファイルを指定した場合
        originalImage = await fetchFileAsBase64(originalFileId, 'image/jpeg');
        originalFileName = `指定ファイル`;
        originalSelectionNote = 'ユーザーが選択したファイル';
      } else {
        // フォルダから自動選択
        const selected = await selectFloorPlanFromFolder(origParsed.id, openai);
        if (selected) {
          originalImage = selected.image;
          originalFileName = selected.fileName;
          originalSelectionNote = selected.selectionReason;
        }
      }
    } else if (origParsed.type === 'file' && origParsed.id) {
      originalImage = await fetchFileAsBase64(origParsed.id, 'image/jpeg');
      originalFileName = `ファイル`;
    } else {
      // 直接URL（Googleドライブ以外）
      try {
        const response = await axios.get(originalUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0];
        if (!contentType.includes('pdf') && !contentType.includes('html')) {
          originalImage = { base64: Buffer.from(response.data).toString('base64'), mimeType: contentType };
        }
      } catch (err: any) {
        console.warn('直接URL取得失敗:', err.message);
      }
    }

    // ---- 作成後図面を取得 ----
    console.log(`[FloorPlanCompare] 作成後図面取得中: ${publishedUrl}`);
    let publishedImage: { base64: string; mimeType: string } | null = null;
    let publishedFileName = '作成後図面';
    let publishedSelectionNote = '';

    const pubParsed = parseDriveUrl(publishedUrl);

    if (pubParsed.type === 'folder' && pubParsed.id) {
      if (publishedFileId) {
        publishedImage = await fetchFileAsBase64(publishedFileId, 'image/jpeg');
        publishedFileName = `指定ファイル`;
        publishedSelectionNote = 'ユーザーが選択したファイル';
      } else {
        const selected = await selectFloorPlanFromFolder(pubParsed.id, openai);
        if (selected) {
          publishedImage = selected.image;
          publishedFileName = selected.fileName;
          publishedSelectionNote = selected.selectionReason;
        }
      }
    } else if (pubParsed.type === 'file' && pubParsed.id) {
      publishedImage = await fetchFileAsBase64(pubParsed.id, 'image/jpeg');
      publishedFileName = `ファイル`;
    } else {
      try {
        const response = await axios.get(publishedUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const contentType = (response.headers['content-type'] || 'image/jpeg').split(';')[0];
        if (!contentType.includes('pdf') && !contentType.includes('html')) {
          publishedImage = { base64: Buffer.from(response.data).toString('base64'), mimeType: contentType };
        }
      } catch (err: any) {
        console.warn('直接URL取得失敗:', err.message);
      }
    }

    if (!originalImage && !publishedImage) {
      return res.status(400).json({
        error: '両方の図面を取得できませんでした。',
        hint: 'フォルダ内に間取り図（JPG/PNG）が含まれているか確認してください。PDFは非対応です。',
      });
    }

    // ---- GPT-4o Vision で比較 ----
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
      contentParts.push({
        type: 'text',
        text: `## 図面A（元図面・原本）\nファイル: ${originalFileName}${originalSelectionNote ? `\n選択理由: ${originalSelectionNote}` : ''}`,
      });
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
        text: `## 図面A（元図面・原本）\n（画像の取得に失敗しました）`,
      });
    }

    if (publishedImage) {
      contentParts.push({
        type: 'text',
        text: `## 図面B（作成後の間取り図）\nファイル: ${publishedFileName}${publishedSelectionNote ? `\n選択理由: ${publishedSelectionNote}` : ''}`,
      });
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
        text: `## 図面B（作成後の間取り図）\n（画像の取得に失敗しました）`,
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
      originalFileName,
      publishedFileName,
      originalSelectionNote,
      publishedSelectionNote,
    });
  } catch (error: any) {
    console.error('[FloorPlanCompare] エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
