/**
 * 画像のEXIF回転情報を読み取り、Canvasで正しい向きに補正したbase64を返す
 * スマホで撮影した写真やスキャンした画像が横向きになる問題を解決する
 */

/** DataViewからuint16を読む（ビッグエンディアン/リトルエンディアン対応） */
function readUint16(view: DataView, offset: number, littleEndian: boolean): number {
  return view.getUint16(offset, littleEndian);
}

/** JPEG画像のEXIFからOrientationタグを取得（1〜8） */
function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  // JPEGマーカー確認
  if (view.getUint16(0) !== 0xFFD8) return 1; // not JPEG

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xFFE1) {
      // APP1 (EXIF)
      const length = view.getUint16(offset);
      offset += 2;
      // "Exif\0\0" チェック
      const exifHeader = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      if (exifHeader !== 'Exif') return 1;
      const tiffOffset = offset + 6;
      const littleEndian = view.getUint16(tiffOffset) === 0x4949;
      const ifdOffset = tiffOffset + readUint16(view, tiffOffset + 4, littleEndian);
      const ifdCount = readUint16(view, ifdOffset, littleEndian);
      for (let i = 0; i < ifdCount; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = readUint16(view, entryOffset, littleEndian);
        if (tag === 0x0112) {
          // Orientation tag
          return readUint16(view, entryOffset + 8, littleEndian);
        }
      }
      return 1;
    } else if ((marker & 0xFF00) !== 0xFF00) {
      break;
    } else {
      offset += view.getUint16(offset);
    }
  }
  return 1;
}

/**
 * FileをCanvasで正しい向きに補正し、base64文字列（data:image/jpeg;base64,... の , 以降）を返す
 * JPEG以外（PNG/WebP等）は補正なしでそのまま返す
 */
export async function fixImageOrientationToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const mediaType = file.type || 'image/jpeg';

  // PDFは変換しない
  if (mediaType === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mediaType });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target!.result as ArrayBuffer;
      const orientation = mediaType === 'image/jpeg' ? getExifOrientation(arrayBuffer) : 1;

      const blob = new Blob([arrayBuffer], { type: mediaType });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // orientationに応じてcanvasサイズと変換を設定
        const w = img.width;
        const h = img.height;

        if (orientation >= 5 && orientation <= 8) {
          // 90度 or 270度回転 → widthとheightを入れ替え
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }

        ctx.save();
        switch (orientation) {
          case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
          case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
          case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
          case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
          case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
          case 7: ctx.transform(0, -1, -1, 0, h, w); break;
          case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
          default: break; // orientation === 1: no transform
        }
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = url;
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
