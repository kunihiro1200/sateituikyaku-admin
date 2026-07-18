"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessorService = void 0;
const sharp_1 = __importDefault(require("sharp"));
const ImageIdentifierService_1 = require("./ImageIdentifierService");
/**
 * 画像処理サービス
 * 画像のリサイズ、エンコード、HTML埋め込みを提供
 */
class ImageProcessorService {
    constructor() {
        this.MAX_SIZE_MB = 5;
        this.MAX_WIDTH_PX = 600;
        this.IMAGE_ATTACHMENT_KEYWORD = '画像添付';
        this.imageIdentifier = new ImageIdentifierService_1.ImageIdentifierService();
    }
    /**
     * メール本文に「画像添付」キーワードが含まれているかチェック
     * @param emailBody メール本文
     * @returns キーワードが含まれている場合true
     */
    detectImageAttachmentKeyword(emailBody) {
        return emailBody.includes(this.IMAGE_ATTACHMENT_KEYWORD);
    }
    /**
     * 画像をリサイズ
     * @param imageBuffer 画像バッファ
     * @param maxSizeMB 最大サイズ（MB）
     * @returns リサイズ後の画像バッファ
     */
    async resizeImage(imageBuffer, maxSizeMB = this.MAX_SIZE_MB) {
        try {
            // 最初のリサイズ試行（品質85%）
            let resized = await (0, sharp_1.default)(imageBuffer)
                .resize(this.MAX_WIDTH_PX, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
                .jpeg({ quality: 85 })
                .toBuffer();
            // サイズチェック
            const sizeMB = resized.length / (1024 * 1024);
            if (sizeMB > maxSizeMB) {
                // さらに品質を下げる（品質70%）
                resized = await (0, sharp_1.default)(imageBuffer)
                    .resize(this.MAX_WIDTH_PX, null, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                    .jpeg({ quality: 70 })
                    .toBuffer();
            }
            return resized;
        }
        catch (error) {
            console.error('画像リサイズエラー:', error.message);
            throw new Error(`画像のリサイズに失敗しました: ${error.message}`);
        }
    }
    /**
     * 画像をBase64エンコード
     * @param imageBuffer 画像バッファ
     * @returns Base64エンコードされた文字列
     */
    encodeImageToBase64(imageBuffer) {
        return imageBuffer.toString('base64');
    }
    /**
     * メール本文に画像を埋め込み
     * @param emailBody メール本文
     * @param images 選択された画像
     * @returns 画像埋め込み済みHTML
     */
    async embedImagesInEmail(emailBody, images) {
        // 画像HTMLを生成
        const imageHtml = await this.generateImageHtml(images);
        // 「画像添付」キーワードを探す
        const keywordIndex = emailBody.indexOf(this.IMAGE_ATTACHMENT_KEYWORD);
        if (keywordIndex !== -1) {
            // キーワードがあった位置に画像を挿入
            const before = emailBody.substring(0, keywordIndex);
            const after = emailBody.substring(keywordIndex + this.IMAGE_ATTACHMENT_KEYWORD.length);
            return before + imageHtml + after;
        }
        else {
            // キーワードがない場合は本文の最後に追加
            return emailBody + '\n\n' + imageHtml;
        }
    }
    /**
     * 画像HTMLを生成
     * @param images 選択された画像
     * @returns 画像HTML
     */
    async generateImageHtml(images) {
        let html = '<div style="margin: 20px 0;">';
        // 建物外観
        if (images.exterior && images.exterior.buffer) {
            const resizedBuffer = await this.resizeImage(images.exterior.buffer);
            const base64 = this.encodeImageToBase64(resizedBuffer);
            const mimeType = images.exterior.mimeType || 'image/jpeg';
            html += `
        <div style="margin-bottom: 15px;">
          <p style="font-weight: bold; margin-bottom: 5px;">建物外観</p>
          <img src="data:${mimeType};base64,${base64}" 
               style="max-width: 600px; height: auto; display: block;" 
               alt="建物外観" />
        </div>
      `;
        }
        // メイン室内
        if (images.interior && images.interior.buffer) {
            const resizedBuffer = await this.resizeImage(images.interior.buffer);
            const base64 = this.encodeImageToBase64(resizedBuffer);
            const mimeType = images.interior.mimeType || 'image/jpeg';
            html += `
        <div style="margin-bottom: 15px;">
          <p style="font-weight: bold; margin-bottom: 5px;">室内（リビング・キッチン）</p>
          <img src="data:${mimeType};base64,${base64}" 
               style="max-width: 600px; height: auto; display: block;" 
               alt="室内" />
        </div>
      `;
        }
        html += '</div>';
        return html;
    }
    /**
     * 売主フォルダから画像を自動選択
     * @param images フォルダ内の全画像
     * @returns 選択された画像
     */
    autoSelectImages(images) {
        // 画像ファイルのみをフィルタリング
        const imageFiles = this.imageIdentifier.filterImageFiles(images);
        // 外観画像を選択
        const exteriorImage = this.imageIdentifier.selectBestImage(imageFiles, ImageIdentifierService_1.ImageCategory.EXTERIOR);
        // 室内画像を選択
        const interiorImage = this.imageIdentifier.selectBestImage(imageFiles, ImageIdentifierService_1.ImageCategory.INTERIOR);
        // フォールバック: パターンに一致しない場合は最初の2つの画像を使用
        let finalExterior = exteriorImage;
        let finalInterior = interiorImage;
        if (!finalExterior && !finalInterior && imageFiles.length >= 2) {
            // 最新の2つの画像を使用
            const sortedImages = [...imageFiles].sort((a, b) => {
                const dateA = new Date(a.modifiedTime).getTime();
                const dateB = new Date(b.modifiedTime).getTime();
                return dateB - dateA;
            });
            finalExterior = sortedImages[0];
            finalInterior = sortedImages[1];
        }
        else if (!finalExterior && !finalInterior && imageFiles.length === 1) {
            // 1枚しかない場合は外観として使用
            finalExterior = imageFiles[0];
        }
        return {
            exterior: finalExterior,
            interior: finalInterior,
            selectionMethod: 'auto'
        };
    }
    /**
     * メール本文から「画像添付」キーワードを削除
     * @param emailBody メール本文
     * @returns キーワード削除後のメール本文
     */
    removeImageAttachmentKeyword(emailBody) {
        return emailBody.replace(new RegExp(this.IMAGE_ATTACHMENT_KEYWORD, 'g'), '');
    }
    /**
     * 画像添付処理
     * @param emailBody メール本文
     * @param images フォルダ内の全画像
     * @param selectedImages 手動選択された画像（オプション）
     * @returns 処理済みメール
     */
    async processImageAttachment(emailBody, images, selectedImages) {
        const originalBody = emailBody;
        // キーワード検出
        if (!this.detectImageAttachmentKeyword(emailBody)) {
            return {
                body: emailBody,
                hasImages: false,
                images: null,
                originalBody
            };
        }
        // 画像選択（手動選択がある場合はそれを使用、なければ自動選択）
        const imagesToUse = selectedImages || this.autoSelectImages(images);
        // 画像が選択されていない場合
        if (!imagesToUse.exterior && !imagesToUse.interior) {
            return {
                body: this.removeImageAttachmentKeyword(emailBody),
                hasImages: false,
                images: null,
                originalBody
            };
        }
        // 画像を埋め込み
        const processedBody = await this.embedImagesInEmail(emailBody, imagesToUse);
        return {
            body: processedBody,
            hasImages: true,
            images: imagesToUse,
            originalBody
        };
    }
}
exports.ImageProcessorService = ImageProcessorService;
