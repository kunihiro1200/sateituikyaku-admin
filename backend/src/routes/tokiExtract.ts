import { Router, Request, Response } from 'express';
import { WorkTaskService } from '../services/WorkTaskService';
import { TokiExtractService } from '../services/TokiExtractService';

const router = Router();
const workTaskService = new WorkTaskService();
const tokiExtractService = new TokiExtractService();

/**
 * POST /api/toki-extract/:propertyNumber/extract
 * 謄本PDFを読み取り、抽出結果をプレビューとして返す（スプシへの書き込みはしない）
 */
router.post('/:propertyNumber/extract', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    // 業務データを取得
    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);
    if (!workTask) {
      return res.status(404).json({ error: '業務データが見つかりません', propertyNumber });
    }

    const storageUrl: string | null = workTask.storage_url ?? null;
    const spreadsheetUrl: string | null = workTask.spreadsheet_url ?? null;
    const mediationType: string | null = workTask.mediation_type ?? null;
    const propertyType: string | null = workTask.property_type ?? null;

    // バリデーション
    if (!storageUrl) {
      return res.status(400).json({ error: '格納先URLが設定されていません' });
    }
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'スプシURLが設定されていません' });
    }
    if (!propertyType) {
      return res.status(400).json({ error: '種別が設定されていません' });
    }

    // シート名を決定（媒介形態が未設定の場合は専任媒介シートをデフォルトとして使用）
    const sheetName = tokiExtractService.getSheetName(mediationType ?? '', propertyType);

    // DriveフォルダからPDFを検索
    console.log(`[TokiExtract] 謄本PDF検索開始: ${propertyNumber}`);
    const pdfData = await tokiExtractService.findTokiPdf(storageUrl);
    if (!pdfData) {
      return res.status(404).json({
        error: '格納先フォルダに「全部事項」を含むPDFが見つかりませんでした',
      });
    }

    // Claude APIで謄本を解析
    console.log(`[TokiExtract] 謄本解析開始: ${pdfData.fileName}`);
    const extractResult = await tokiExtractService.extractFromPdf(pdfData.base64);

    return res.json({
      success: true,
      fileName: pdfData.fileName,
      sheetName,
      spreadsheetUrl,
      extractResult,
    });
  } catch (error: any) {
    console.error('[TokiExtract] 抽出エラー:', error.message);

    // Claudeのレート制限
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
      });
    }

    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/write
 * 抽出結果をスプレッドシートの指定セルに書き込む
 */
router.post('/:propertyNumber/write', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { extractResult, sheetName, spreadsheetUrl } = req.body;

    if (!extractResult || !sheetName || !spreadsheetUrl) {
      return res.status(400).json({
        error: 'extractResult・sheetName・spreadsheetUrl は必須です',
      });
    }

    console.log(`[TokiExtract] スプシ書き込み開始: ${propertyNumber} → シート「${sheetName}」`);

    await tokiExtractService.writeToSpreadsheet({
      spreadsheetUrl,
      sheetName,
      extractResult,
    });

    return res.json({
      success: true,
      message: `スプレッドシートへの書き込みが完了しました（シート：${sheetName}）`,
    });
  } catch (error: any) {
    console.error('[TokiExtract] 書き込みエラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/extract-keiyaku
 * 契約決済タブ用：謄本PDFを読み取り、重説シート向けの抽出結果をプレビューとして返す
 */
router.post('/:propertyNumber/extract-keiyaku', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    // 業務データを取得
    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);
    if (!workTask) {
      return res.status(404).json({ error: '業務データが見つかりません', propertyNumber });
    }

    const storageUrl: string | null = workTask.storage_url ?? null;
    const spreadsheetUrl: string | null = workTask.spreadsheet_url ?? null;
    const propertyType: string | null = workTask.property_type ?? null;

    // バリデーション
    if (!storageUrl) {
      return res.status(400).json({ error: '格納先URLが設定されていません' });
    }
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'スプシURLが設定されていません' });
    }
    if (!propertyType) {
      return res.status(400).json({ error: '種別が設定されていません' });
    }

    // 種別チェック（マンションのみ対応）
    const isManshon = propertyType === 'マ' || propertyType === 'マンション';
    if (!isManshon) {
      return res.status(400).json({ error: 'この機能はマンション（種別：マ）のみ対応しています' });
    }

    // 重説シート名は固定
    const sheetName = '重説';

    // DriveフォルダからPDFを検索（「建物_全部事項」を含むPDF）
    console.log(`[TokiKeiyaku] 謄本PDF検索開始: ${propertyNumber}`);
    const pdfData = await tokiExtractService.findTokiPdfForKeiyaku(storageUrl);
    if (!pdfData) {
      return res.status(404).json({
        error: '格納先フォルダに「建物_全部事項」を含むPDFが見つかりませんでした',
      });
    }

    // Claude APIで謄本を解析（重説シート用）
    console.log(`[TokiKeiyaku] 謄本解析開始: ${pdfData.fileName}`);
    const extractResult = await tokiExtractService.extractFromPdfForKeiyaku(pdfData.base64);

    return res.json({
      success: true,
      fileName: pdfData.fileName,
      sheetName,
      spreadsheetUrl,
      extractResult,
    });
  } catch (error: any) {
    console.error('[TokiKeiyaku] 抽出エラー:', error.message);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
      });
    }

    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/write-keiyaku
 * 契約決済タブ用：抽出結果を「重説」シートの指定セルに書き込む
 */
router.post('/:propertyNumber/write-keiyaku', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { extractResult, sheetName, spreadsheetUrl } = req.body;

    if (!extractResult || !sheetName || !spreadsheetUrl) {
      return res.status(400).json({
        error: 'extractResult・sheetName・spreadsheetUrl は必須です',
      });
    }

    console.log(`[TokiKeiyaku] スプシ書き込み開始: ${propertyNumber} → シート「${sheetName}」`);

    await tokiExtractService.writeToSpreadsheetForKeiyaku({
      spreadsheetUrl,
      sheetName,
      extractResult,
    });

    return res.json({
      success: true,
      message: `スプレッドシートへの書き込みが完了しました（シート：${sheetName}）`,
    });
  } catch (error: any) {
    console.error('[TokiKeiyaku] 書き込みエラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/toki-extract/:propertyNumber/list-kodate-pdfs
 * 戸建て用：格納先フォルダのPDF一覧（fileId付き）を返す（高速・タイムアウトなし）
 */
router.get('/:propertyNumber/list-kodate-pdfs', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);
    if (!workTask) return res.status(404).json({ error: '業務データが見つかりません' });

    const storageUrl: string | null = workTask.storage_url ?? null;
    const spreadsheetUrl: string | null = workTask.spreadsheet_url ?? null;
    const mediationType: string | null = workTask.mediation_type ?? null;
    const propertyType: string | null = workTask.property_type ?? null;

    if (!storageUrl) return res.status(400).json({ error: '格納先URLが設定されていません' });
    if (!spreadsheetUrl) return res.status(400).json({ error: 'スプシURLが設定されていません' });
    if (!propertyType) return res.status(400).json({ error: '種別が設定されていません' });

    const isKodate = ['戸', '戸建', '戸建て'].includes(propertyType);
    if (!isKodate) return res.status(400).json({ error: 'この機能は戸建て（種別：戸）のみ対応しています' });

    const sheetName = tokiExtractService.getSheetName(mediationType ?? '', propertyType);
    if (!sheetName) return res.status(400).json({ error: '対応するシートが見つかりません' });

    // PDF一覧のみ返す（ダウンロード・解析はしない）
    const pdfList = await tokiExtractService.listTokiPdfsForKodate(storageUrl);
    if (pdfList.length === 0) {
      return res.status(404).json({ error: '格納先フォルダに「全部事項」を含むPDFが見つかりませんでした' });
    }

    return res.json({ success: true, pdfList, sheetName, spreadsheetUrl });
  } catch (error: any) {
    console.error('[TokiKodate] PDF一覧取得エラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/extract-kodate-single
 * 戸建て用：fileIdを受け取り、1枚のPDFだけを解析して返す（タイムアウト対策）
 */
router.post('/:propertyNumber/extract-kodate-single', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { fileId, fileName, pdfType } = req.body as {
      fileId: string;
      fileName: string;
      pdfType: 'land' | 'building' | 'unknown';
    };

    if (!fileId) return res.status(400).json({ error: 'fileId は必須です' });

    console.log(`[TokiKodate] 1枚解析開始: ${fileName} (${pdfType})`);
    const extractResult = await tokiExtractService.extractSingleTokiPdfForKodate(fileId, fileName);

    return res.json({ success: true, fileName, pdfType, extractResult });
  } catch (error: any) {
    console.error('[TokiKodate] 1枚解析エラー:', error.message);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/extract-kodate
 * 戸建て用：謄本PDFを読み取り、媒介契約シート向けの抽出結果をプレビューとして返す
 */
router.post('/:propertyNumber/extract-kodate', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    // 業務データを取得
    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);
    if (!workTask) {
      return res.status(404).json({ error: '業務データが見つかりません', propertyNumber });
    }

    const storageUrl: string | null = workTask.storage_url ?? null;
    const spreadsheetUrl: string | null = workTask.spreadsheet_url ?? null;
    const mediationType: string | null = workTask.mediation_type ?? null;
    const propertyType: string | null = workTask.property_type ?? null;

    // バリデーション
    if (!storageUrl) {
      return res.status(400).json({ error: '格納先URLが設定されていません' });
    }
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'スプシURLが設定されていません' });
    }
    if (!propertyType) {
      return res.status(400).json({ error: '種別が設定されていません' });
    }

    // 種別チェック（戸建てのみ対応）
    const isKodate = propertyType === '戸' || propertyType === '戸建' || propertyType === '戸建て';
    if (!isKodate) {
      return res.status(400).json({ error: 'この機能は戸建て（種別：戸）のみ対応しています' });
    }

    // シート名を決定
    const sheetName = tokiExtractService.getSheetName(mediationType ?? '', propertyType);
    if (!sheetName) {
      return res.status(400).json({ error: '対応するシートが見つかりません' });
    }

    // DriveフォルダからPDFを検索（「土地_全部事項」「建物_全部事項」を区別して複数取得）
    console.log(`[TokiKodate] 謄本PDF検索開始: ${propertyNumber}`);
    const { landPdfs, buildingPdf } = await tokiExtractService.findTokiPdfsForKodate(storageUrl);
    if (landPdfs.length === 0 && buildingPdf === null) {
      return res.status(404).json({
        error: '格納先フォルダに「全部事項」を含むPDFが見つかりませんでした',
      });
    }

    // Claude APIで謄本を解析（戸建て用・複数PDF統合）
    console.log(`[TokiKodate] 謄本解析開始: 土地${landPdfs.length}件, 建物${buildingPdf ? 1 : 0}件`);
    const { mergedResult, fileNames } = await tokiExtractService.extractFromPdfsForKodate(landPdfs, buildingPdf);

    return res.json({
      success: true,
      fileNames,
      sheetName,
      spreadsheetUrl,
      extractResult: mergedResult,
    });
  } catch (error: any) {
    console.error('[TokiKodate] 抽出エラー:', error.message);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
      });
    }

    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/write-kodate
 * 戸建て用：抽出結果をスプレッドシートの指定セルに書き込む
 */
router.post('/:propertyNumber/write-kodate', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { extractResult, sheetName, spreadsheetUrl } = req.body;

    if (!extractResult || !sheetName || !spreadsheetUrl) {
      return res.status(400).json({
        error: 'extractResult・sheetName・spreadsheetUrl は必須です',
      });
    }

    console.log(`[TokiKodate] スプシ書き込み開始: ${propertyNumber} → シート「${sheetName}」`);

    await tokiExtractService.writeToSpreadsheetForKodate({
      spreadsheetUrl,
      sheetName,
      extractResult,
    });

    return res.json({
      success: true,
      message: `スプレッドシートへの書き込みが完了しました（シート：${sheetName}）`,
    });
  } catch (error: any) {
    console.error('[TokiKodate] 書き込みエラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/extract-kodate-keiyaku
 * 戸建て用（契約決済タブ）：謄本PDFを複数読み取り、重説シート向けの抽出結果をプレビューとして返す
 */
router.post('/:propertyNumber/extract-kodate-keiyaku', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    const workTask = await workTaskService.getByPropertyNumber(propertyNumber);
    if (!workTask) {
      return res.status(404).json({ error: '業務データが見つかりません', propertyNumber });
    }

    const storageUrl: string | null = workTask.storage_url ?? null;
    const spreadsheetUrl: string | null = workTask.spreadsheet_url ?? null;
    const propertyType: string | null = workTask.property_type ?? null;

    if (!storageUrl) return res.status(400).json({ error: '格納先URLが設定されていません' });
    if (!spreadsheetUrl) return res.status(400).json({ error: 'スプシURLが設定されていません' });
    if (!propertyType) return res.status(400).json({ error: '種別が設定されていません' });

    const isKodate = ['戸', '戸建', '戸建て'].includes(propertyType);
    if (!isKodate) {
      return res.status(400).json({ error: 'この機能は戸建て（種別：戸）のみ対応しています' });
    }

    const sheetName = '重説';

    console.log(`[TokiKodateKeiyaku] 謄本PDF検索開始: ${propertyNumber}`);
    const pdfs = await tokiExtractService.findTokiPdfsForKodateKeiyaku(storageUrl);
    if (pdfs.length === 0) {
      return res.status(404).json({
        error: '格納先フォルダに「全部事項」または「全部謄本」を含むPDFが見つかりませんでした',
      });
    }

    console.log(`[TokiKodateKeiyaku] 謄本解析開始: ${pdfs.length}件`);
    const { mergedResult, fileNames } = await tokiExtractService.extractFromPdfsForKodateKeiyaku(pdfs);

    return res.json({
      success: true,
      fileNames,
      sheetName,
      spreadsheetUrl,
      extractResult: mergedResult,
    });
  } catch (error: any) {
    console.error('[TokiKodateKeiyaku] 抽出エラー:', error.message);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/toki-extract/:propertyNumber/write-kodate-keiyaku
 * 戸建て用（契約決済タブ）：抽出結果を「重説」シートの指定セルに書き込む
 */
router.post('/:propertyNumber/write-kodate-keiyaku', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { extractResult, sheetName, spreadsheetUrl } = req.body;

    if (!extractResult || !sheetName || !spreadsheetUrl) {
      return res.status(400).json({ error: 'extractResult・sheetName・spreadsheetUrl は必須です' });
    }

    console.log(`[TokiKodateKeiyaku] スプシ書き込み開始: ${propertyNumber} → シート「${sheetName}」`);

    await tokiExtractService.writeToSpreadsheetForKodateKeiyaku({ spreadsheetUrl, sheetName, extractResult });

    return res.json({
      success: true,
      message: `スプレッドシートへの書き込みが完了しました（シート：${sheetName}）`,
    });
  } catch (error: any) {
    console.error('[TokiKodateKeiyaku] 書き込みエラー:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
