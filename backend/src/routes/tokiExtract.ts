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
    if (!mediationType) {
      return res.status(400).json({ error: '媒介形態が設定されていません' });
    }
    if (!propertyType) {
      return res.status(400).json({ error: '種別が設定されていません' });
    }

    // シート名を決定
    const sheetName = tokiExtractService.getSheetName(mediationType, propertyType);
    if (!sheetName) {
      return res.status(400).json({
        error: `この種別（${propertyType}）または媒介形態（${mediationType}）には現在対応していません`,
      });
    }

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

export default router;
