/**
 * PDFファイルを画像（JPEG base64）に変換するユーティリティ
 * pdfjs-dist を使ってCanvasにレンダリングし、JPEGに変換する
 * 横長ページは自動で90度回転して縦向きにする
 */
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker（ビルド済みworkerを使用）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * PDFファイルの各ページをJPEG画像のbase64配列に変換する
 * 横長ページは自動で90度反時計回りに回転して縦向きにする
 * @param file PDFファイル
 * @param maxPages 変換する最大ページ数（デフォルト: 全ページ）
 * @param scale レンダリング倍率（デフォルト: 2.0 = 高解像度）
 * @returns base64文字列の配列（data:image/jpeg;base64, は含まない）
 */
export async function pdfToImageBase64(
  file: File,
  maxPages: number = 10,
  scale: number = 2.0
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);
  const results: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // 横長ページを検出して90度回転（反時計回り = 物件概要書が正しい向きになる）
    if (viewport.width > viewport.height) {
      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = viewport.height;
      rotatedCanvas.height = viewport.width;
      const rotCtx = rotatedCanvas.getContext('2d')!;
      rotCtx.translate(0, viewport.width);
      rotCtx.rotate(-Math.PI / 2);
      rotCtx.drawImage(canvas, 0, 0);
      const dataUrl = rotatedCanvas.toDataURL('image/jpeg', 0.92);
      results.push(dataUrl.split(',')[1]);
    } else {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      results.push(dataUrl.split(',')[1]);
    }
  }

  return results;
}
