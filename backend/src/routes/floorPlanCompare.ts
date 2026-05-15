import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import axios from 'axios';

const router = Router();

// ============================================================
// URL解析
// ============================================================

function parseDriveUrl(url: string): { type: 'file' | 'folder' | 'unknown'; id: string | null } {
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

const FLOOR_PLAN_KEYWORDS = [
  '間取', 'madori', 'floor', '図面', 'layout', 'plan',
  '1f', '2f', '3f', '1階', '2階', '3階',
  'floorplan', 'floor_plan', 'floor-plan',
];

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
// Google Drive APIキーでフォルダ内ファイル一覧を取得
// （「リンクを知っている全員が閲覧可能」のフォルダに対応）
// ============================================================

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  likelyFloorPlan: 'yes' | 'no' | 'maybe';
}

async function listFilesInFolderByApiKey(folderId: string): Promise<DriveFileInfo[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Google APIキー（Drive APIも有効化済みの場合）
  if (!apiKey) {
    throw new Error('Google APIキーが設定されていません（GOOGLE_MAPS_API_KEY）');
  }

  const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const mimeQuery = imageMimeTypes.map(m => `mimeType='${m}'`).join(' or ');

  const url = 'https://www.googleapis.com/drive/v3/files';
  const params = {
    q: `'${folderId}' in parents and (${mimeQuery}) and trashed=false`,
    fields: 'files(id,name,mimeType)',
    pageSize: '200',
    orderBy: 'name',
    key: apiKey,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  };

  const res = await axios.get(url, { params, timeout: 30000 });
  const files = (res.data.files || []) as { id: string; name: string; mimeType: string }[];

  return files.map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    likelyFloorPlan: isLikelyFloorPlan(f.name),
  }));
}

// ============================================================
// ファイルをBase64で取得（APIキー経由）
// ============================================================

async function fetchFileAsBase64ByApiKey(
  fileId: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string } | null> {
  if (mimeType === 'application/pdf') return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    // APIキーでダウンロード
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const contentType = (response.headers['content-type'] || mimeType).split(';')[0];
    if (contentType.includes('pdf') || contentType.includes('html')) return null;
    const base64 = Buffer.from(response.data).toString('base64');
    return { base64, mimeType: contentType };
  } catch (err: any) {
    console.warn(`APIキーでのファイル取得失敗 (${fileId}):`, err.message);

    // フォールバック: 公開ダウンロードURL
    try {
      const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await axios.get(fallbackUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const contentType = (response.headers['content-type'] || mimeType).split(';')[0];
      if (contentType.includes('pdf') || contentType.includes('html')) return null;
      const base64 = Buffer.from(response.data).toString('base64');
      return { base64, mimeType: contentType };
    } catch (err2: any) {
      console.warn(`公開URLでのファイル取得も失敗 (${fileId}):`, err2.message);
      return null;
    }
  }
}

// ============================================================
// フォルダから間取り図を収集（AI判定付き）
// ============================================================

interface SelectedFloorPlan {
  image: { base64: string; mimeType: string };
  fileName: string;
  fileId: string;
}

async function collectFloorPlansFromFolder(
  folderId: string,
  openai: OpenAI,
  maxImages: number = 4
): Promise<SelectedFloorPlan[]> {
  const files = await listFilesInFolderByApiKey(folderId);

  if (files.length === 0) {
    throw new Error('フォルダ内に画像ファイル（JPG/PNG）が見つかりませんでした。フォルダの共有設定を「リンクを知っている全員が閲覧可能」にしてください。');
  }

  console.log(`[FloorPlanCompare] フォルダ内ファイル数: ${files.length}`);
  files.forEach(f => console.log(`  - ${f.name} (${f.likelyFloorPlan})`));

  const yesFiles = files.filter(f => f.likelyFloorPlan === 'yes');
  const maybeFiles = files.filter(f => f.likelyFloorPlan === 'maybe');
  const noFiles = files.filter(f => f.likelyFloorPlan === 'no');

  // 優先順位: yes → maybe → no
  const candidates = yesFiles.length > 0 ? yesFiles
    : maybeFiles.length > 0 ? maybeFiles
    : noFiles;

  const results: SelectedFloorPlan[] = [];

  for (const file of candidates) {
    if (results.length >= maxImages) break;

    const imageData = await fetchFileAsBase64ByApiKey(file.id, file.mimeType);
    if (!imageData) continue;

    // ファイル名で確実に間取り図と判断できる場合はAI判定スキップ
    if (file.likelyFloorPlan === 'yes') {
      results.push({ image: imageData, fileName: file.name, fileId: file.id });
      continue;
    }

    // AIで間取り図かどうか判定（低解像度・低コスト）
    try {
      const aiRes = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'この画像は不動産の間取り図ですか？「はい」または「いいえ」のみで答えてください。' },
            { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}`, detail: 'low' } },
          ],
        }],
      });
      const answer = aiRes.choices[0]?.message?.content?.trim() || '';
      if (answer.includes('はい') || answer.toLowerCase().includes('yes')) {
        results.push({ image: imageData, fileName: file.name, fileId: file.id });
      }
    } catch {
      results.push({ image: imageData, fileName: file.name, fileId: file.id });
    }
  }

  return results;
}

// ============================================================
// GET /api/floor-plan-compare/list-files
// ============================================================

router.get('/list-files', async (req: Request, res: Response) => {
  try {
    const { url } = req.query as { url: string };
    if (!url) return res.status(400).json({ error: 'url パラメータが必要です' });

    const parsed = parseDriveUrl(url);
    if (parsed.type !== 'folder' || !parsed.id) {
      return res.status(400).json({ error: 'フォルダURLを入力してください（/folders/... の形式）' });
    }

    const files = await listFilesInFolderByApiKey(parsed.id);
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
// POST /api/floor-plan-compare/from-folder
// ============================================================

router.post('/from-folder', async (req: Request, res: Response) => {
  try {
    const { folderUrl, selectedFileIds } = req.body as {
      folderUrl: string;
      selectedFileIds?: string[];
    };

    if (!folderUrl) {
      return res.status(400).json({ error: 'フォルダURLを入力してください' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI APIキーが設定されていません' });

    const openai = new OpenAI({ apiKey });

    const parsed = parseDriveUrl(folderUrl);
    if (parsed.type !== 'folder' || !parsed.id) {
      return res.status(400).json({ error: 'フォルダURLの形式が正しくありません（/folders/... の形式で入力してください）' });
    }

    // 間取り図を収集
    let floorPlans: SelectedFloorPlan[];

    if (selectedFileIds && selectedFileIds.length >= 2) {
      floorPlans = [];
      for (const fileId of selectedFileIds.slice(0, 4)) {
        const imageData = await fetchFileAsBase64ByApiKey(fileId, 'image/jpeg');
        if (imageData) {
          floorPlans.push({ image: imageData, fileName: fileId, fileId });
        }
      }
    } else {
      floorPlans = await collectFloorPlansFromFolder(parsed.id, openai);
    }

    if (floorPlans.length === 0) {
      return res.status(400).json({
        error: 'フォルダ内に間取り図が見つかりませんでした。',
        hint: 'JPG/PNG形式の間取り図ファイルがフォルダ内にあるか確認してください。PDFは非対応です。',
      });
    }

    if (floorPlans.length < 2) {
      return res.status(400).json({
        error: `間取り図が1枚しか見つかりませんでした（${floorPlans[0].fileName}）。比較するには2枚以上の間取り図が必要です。`,
        hint: '元図面と作成後の図面の両方がフォルダ内にあるか確認してください。',
        foundFiles: floorPlans.map(f => f.fileName),
      });
    }

    console.log(`[FloorPlanCompare] 間取り図 ${floorPlans.length} 枚を取得。GPT-4o比較開始`);

    // GPT-4o Vision で差異を洗い出す
    const contentParts: any[] = [
      {
        type: 'text',
        text: `不動産の間取り図が${floorPlans.length}枚あります。これらを比較して差異を洗い出してください。

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

最後に「## 総評」として全体的な評価と、特に注意が必要な点をまとめてください。`,
      },
    ];

    floorPlans.forEach((fp, idx) => {
      contentParts.push({
        type: 'text',
        text: `## 図面${idx + 1}（${fp.fileName}）`,
      });
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${fp.image.mimeType};base64,${fp.image.base64}`,
          detail: 'high',
        },
      });
    });

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
      foundFiles: floorPlans.map(f => f.fileName),
      fileCount: floorPlans.length,
    });
  } catch (error: any) {
    console.error('[FloorPlanCompare] エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
