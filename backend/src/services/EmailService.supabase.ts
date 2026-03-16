import { BaseRepository } from '../repositories/BaseRepository';
import { Seller, ValuationResult } from '../types';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { retryGmailApi } from '../utils/retry';
import { GoogleDriveService, DriveFile } from './GoogleDriveService';
import { ImageIdentifierService } from './ImageIdentifierService';

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
  cid: string;
}

export interface EmailResult {
  messageId: string;
  sentAt: Date;
  success: boolean;
  error?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailWithImagesParams {
  sellerId: string;
  sellerNumber: string;
  to: string;
  subject: string;
  body: string;
  from: string;
  selectedImages?: Array<{
    id: string;
    name: string;
    source: 'drive' | 'local' | 'url';
    size: number;
    mimeType: string;
    thumbnailUrl?: string;
    previewUrl: string;
    driveFileId?: string;
    localFile?: any;
    url?: string;
  }>;
}

export class EmailService extends BaseRepository {
  private oauth2Client: OAuth2Client;
  private driveService: GoogleDriveService;
  private imageIdentifier: ImageIdentifierService;

  constructor() {
    super();
    this.driveService = new GoogleDriveService();
    this.imageIdentifier = new ImageIdentifierService();
    
    // 環境変数の確認
    console.log('🔧 Gmail API Configuration:');
    console.log('  GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID ? '✓ Set' : '✗ Missing');
    
    // Gmail API OAuth2クライアントを初期化
    // GMAIL_CLIENT_ID が設定されている場合はそれを使用、なければ GOOGLE_CALENDAR_CLIENT_ID を使用
    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // GMAIL_REFRESH_TOKEN が設定されている場合はそれを使用
    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      });
    }
  }

  /**
   * 査定メールを送信
   */
  async sendValuationEmail(
    seller: Seller,
    valuation: ValuationResult,
    employeeEmail: string,
    employeeId: string
  ): Promise<EmailResult> {
    try {
      if (!seller.email) {
        throw new Error('Seller email is not set');
      }

      // メールテンプレートを生成
      const template = this.generateValuationEmailTemplate(seller, valuation);

      console.log('📧 Sending valuation email:');
      console.log(`  To: ${seller.email}`);
      console.log(`  Subject: ${template.subject}`);
      console.log(`  From: ${employeeEmail}`);

      // Gmail APIでメール送信（リトライ付き）
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // メールメッセージを作成（プレーンテキスト）
      const message = this.createEmailMessage(
        employeeEmail,
        seller.email,
        template.subject,
        template.body,
        false
      );

      // メール送信（リトライロジック付き）
      const result = await retryGmailApi(async () => {
        return await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: message,
          },
        });
      });

      const messageId = result.data.id || `sent-${Date.now()}`;
      const sentAt = new Date();

      // メール送信ログをactivitiesテーブルに保存
      await this.saveEmailLog(
        seller.id,
        employeeId,
        template.subject,
        template.body,
        seller.email,
        messageId
      );

      return {
        messageId,
        sentAt,
        success: true,
      };
    } catch (error) {
      console.error('Send valuation email error:', error);
      return {
        messageId: '',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * メール送信ログを保存
   */
  private async saveEmailLog(
    sellerId: string,
    employeeId: string,
    subject: string,
    body: string,
    recipientEmail: string,
    messageId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('activities').insert({
        seller_id: sellerId,
        employee_id: employeeId,
        type: 'email',
        content: `メール送信: ${subject}`,
        result: '送信成功',
        metadata: {
          subject,
          body,
          recipient_email: recipientEmail,
          message_id: messageId,
          sent_at: new Date().toISOString(),
        },
      });

      if (error) {
        console.error('Failed to save email log:', error);
      } else {
        console.log('✅ Email log saved to activities table');
      }
    } catch (error) {
      console.error('Error saving email log:', error);
    }
  }

  /**
   * メールメッセージを作成（Base64エンコード）
   */
  private createEmailMessage(
    from: string,
    to: string,
    subject: string,
    body: string,
    isHtml: boolean = false
  ): string {
    const contentType = isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
    
    // 件名をRFC 2047形式でエンコード（日本語対応）
    const encodedSubject = this.encodeSubject(subject);
    
    // メールヘッダーとボディを作成
    const messageParts = [
      'From: ' + from,
      'To: ' + to,
      'Subject: ' + encodedSubject,
      'MIME-Version: 1.0',
      'Content-Type: ' + contentType,
      '',
      body
    ];

    const message = messageParts.join('\r\n');
    
    // Gmail API用にBase64 URL-safeエンコード
    const encodedMessage = Buffer.from(message, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }

  /**
   * 追客メールを送信
   */
  async sendFollowUpEmail(
    seller: Seller,
    _content: string,
    employeeEmail: string
  ): Promise<EmailResult> {
    try {
      const subject = `【フォローアップ】${seller.name}様へのご連絡`;

      // TODO: 実際のメール送信実装
      console.log('📧 Sending follow-up email:');
      console.log(`  To: ${seller.email}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  From: ${employeeEmail}`);

      // モック応答
      return {
        messageId: `mock-${Date.now()}`,
        sentAt: new Date(),
        success: true,
      };
    } catch (error) {
      console.error('Send follow-up email error:', error);
      return {
        messageId: '',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * テンプレートメールを送信
   */
  async sendTemplateEmail(
    seller: Seller,
    subject: string,
    content: string,
    employeeEmail: string,
    employeeId: string,
    htmlBody?: string,
    from?: string
  ): Promise<EmailResult> {
    try {
      if (!seller.email) {
        throw new Error('Seller email is not set');
      }

      // GMAIL_REFRESH_TOKEN が未設定の場合、google_calendar_tokens からトークンを取得
      if (!process.env.GMAIL_REFRESH_TOKEN) {
        try {
          const { GoogleAuthService } = await import('./GoogleAuthService');
          const googleAuthService = new GoogleAuthService();
          const authenticatedClient = await googleAuthService.getAuthenticatedClient();
          this.oauth2Client = authenticatedClient;
        } catch (authError: any) {
          console.error('Failed to get authenticated client from GoogleAuthService:', authError);
          throw new Error('Gmail認証が設定されていません。Google連携を行ってください。');
        }
      }

      // fromが指定されていない場合はemployeeEmailを使用（後方互換性）
      const senderAddress = from || employeeEmail;

      console.log('📧 Sending template email:');
      console.log(`  To: ${seller.email}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  From: ${senderAddress}`);

      // Gmail APIでメール送信（リトライ付き）
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      console.log('📄 htmlBody provided:', !!htmlBody);
      console.log('📄 htmlBody length:', htmlBody?.length || 0);
      if (htmlBody) {
        console.log('📄 htmlBody preview (first 200 chars):', htmlBody.substring(0, 200));
      }

      // カスタムHTMLボディに埋め込み画像（data:image/...）が含まれているかチェック
      const hasEmbeddedImages = htmlBody && /<img[^>]+src="data:image\/[^"]+"/i.test(htmlBody);
      console.log('🔍 Has embedded images:', hasEmbeddedImages);

      let message: string;
      
      if (hasEmbeddedImages) {
        // 埋め込み画像がある場合、画像を抽出してマルチパートメッセージを作成
        console.log('📎 Detected embedded images in HTML body, creating multipart message');
        
        const attachments: EmailAttachment[] = [];
        // htmlBodyをそのまま使用（画像が埋め込まれている位置を保持）
        let processedHtml = htmlBody!;
        let imageIndex = 0;
        
        // data:image/... 形式の画像を抽出して置き換え
        processedHtml = processedHtml.replace(
          /<img([^>]*)src="data:image\/([^;]+);base64,([^"]+)"([^>]*)>/gi,
          (fullMatch, beforeSrc, mimeType, base64Data, afterSrc) => {
            try {
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              // ファイルサイズチェック（5MB制限）
              const maxSize = 5 * 1024 * 1024;
              if (imageBuffer.length > maxSize) {
                console.warn(`⚠️ Skipping embedded image ${imageIndex}: size ${imageBuffer.length} exceeds 5MB limit`);
                return fullMatch;
              }
              
              const cid = `embedded-image-${imageIndex}`;
              
              attachments.push({
                filename: `image-${imageIndex}.${mimeType}`,
                mimeType: `image/${mimeType}`,
                data: imageBuffer,
                cid: cid,
              });
              
              console.log(`✅ Extracted embedded image ${imageIndex}: ${imageBuffer.length} bytes`);
              imageIndex++;
              
              // data:image/...をcid:に置き換え
              return `<img${beforeSrc}src="cid:${cid}"${afterSrc}>`;
            } catch (error) {
              console.error(`❌ Error processing embedded image ${imageIndex}:`, error);
              return fullMatch;
            }
          }
        );
        
        console.log(`✅ Processed ${attachments.length} embedded images`);
        console.log('📄 Processed HTML preview (first 500 chars):', processedHtml.substring(0, 500));
        
        // マルチパートメッセージを作成
        message = this.createMultipartMessage(
          senderAddress,
          seller.email,
          subject,
          processedHtml,
          attachments
        );
      } else {
        // 埋め込み画像がない場合
        let finalHtmlBody: string;
        
        if (htmlBody) {
          // htmlBodyが提供されている場合は、シンプルにラップ
          finalHtmlBody = this.wrapInEmailTemplate(htmlBody);
        } else {
          // htmlBodyがない場合は、デフォルトテンプレートを使用
          finalHtmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.8; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>${seller.name} 様</p>
      <p style="white-space: pre-wrap;">${content}</p>
    </div>
    <div class="footer">
      <p>このメールは自動送信されています。<br>
      返信される場合は、担当者のメールアドレスへお願いいたします。</p>
    </div>
  </div>
</body>
</html>
          `;
        }
        
        message = this.createEmailMessage(
          senderAddress,
          seller.email,
          subject,
          finalHtmlBody,
          true
        );
      }

      // メール送信（リトライロジック付き）
      const result = await retryGmailApi(async () => {
        return await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: message,
          },
        });
      });

      const messageId = result.data.id || `sent-${Date.now()}`;
      const sentAt = new Date();

      console.log(`✅ Template email sent successfully: ${messageId}`);

      // メール送信ログをactivitiesテーブルに保存
      await this.saveEmailLog(
        seller.id,
        employeeId,
        subject,
        content,
        seller.email,
        messageId
      );

      return {
        messageId,
        sentAt,
        success: true,
      };
    } catch (error) {
      console.error('Send template email error:', error);
      return {
        messageId: '',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 査定メールテンプレートを生成（新しい査定額1、2、3を使用）
   */
  private generateValuationEmailTemplate(
    seller: Seller,
    valuationData: any
  ): EmailTemplate {
    const subject = `【査定結果】${seller.name}様の物件査定について`;

    // 査定額を万円単位に変換
    const amount1Man = Math.round(valuationData.valuationAmount1 / 10000);
    const amount2Man = Math.round(valuationData.valuationAmount2 / 10000);
    const amount3Man = Math.round(valuationData.valuationAmount3 / 10000);

    // 土地面積と建物面積を取得
    const landArea = valuationData.landArea || '未設定';
    const buildingArea = valuationData.buildingArea || '未設定';

    const body = `${seller.name}様

この度は査定依頼を頂きまして誠に有難うございます。
大分市舞鶴町にございます、不動産会社の株式会社いふうです。

机上査定は以下の通りとなっております。
※土地${landArea}㎡、建物${buildingArea}㎡で算出しております。

＜相場価格＞
　　　${amount1Man}万円～${amount2Man}万円（3ヶ月で売却可能）

＜チャレンジ価格＞
${amount2Man}万円～${amount3Man}万円（6ヶ月以上も可）

＜買取価格＞
　　　ご訪問後査定させて頂くことが可能です。

【訪問査定をご希望の方】（電話でも可能です）
★無料です！所要時間は1時間程度です。
↓こちらよりご予約可能です！
★遠方の方はWEB打合せも可能となっておりますので、ご連絡下さい！
http://bit.ly/44U9pjl

↑↑訪問査定はちょっと・・・でも来店して、「売却の流れの説明を聞きたい！！」という方もぜひご予約ください！！

机上査定はあくまで固定資産税路線価や周辺事例の平均値で自動計算されております。
チャレンジ価格以上の金額での売出も可能ですが、売却までにお時間がかかる可能性があります。ご了承ください。

●当該エリアは、子育て世代のファミリー層から人気で問い合せの多い地域となっております。
●13名のお客様が周辺で物件を探されています。

売却には自信がありますので、是非当社でご紹介させて頂ければと思います。

なお、上記は概算での金額であり、正式には訪問査定後となりますのでご了承ください。
訪問査定は30分程度で終わり、無料となっておりますのでお気軽にお申し付けください。

売却の流れから良くあるご質問をまとめた資料はこちらになります。
https://ifoo-oita.com/testsite/wp-content/uploads/2020/12/d58af49c9c6dd87c7aee1845265204b6.pdf

また、不動産を売却した際には譲渡所得税というものが課税されます。
控除方法もございますが、住宅ローン控除との併用は出来ません。
詳細はお問い合わせくださいませ。

不動産売却のほか、住み替え先のご相談や物件紹介などについてもお気軽にご相談ください。

何卒よろしくお願い致します。

***************************
株式会社 いふう（実績はこちら：bit.ly/4l8lWFF　）
〒870-0044
大分市舞鶴町1丁目3-30
TEL：097-533-2022
FAX：097-529-7160
MAIL：tenant@ifoo-oita.com
HP：https://ifoo-oita.com/
採用HP：https://en-gage.net/ifoo-oita/
店休日：毎週水曜日　年末年始、GW、盆
***************************`;

    return { subject, body };
  }

  /**
   * 売主の画像を取得（プレビュー用）
   */
  async getSellerImages(sellerId: string, sellerNumber: string): Promise<DriveFile[]> {
    try {
      console.log(`📸 Getting images for seller: ${sellerNumber} (ID: ${sellerId})`);
      
      // 売主情報を取得してフォルダ情報を確認
      const { data: seller } = await this.supabase
        .from('sellers')
        .select('property_address, name')
        .eq('id', sellerId)
        .single();

      if (!seller) {
        console.error('❌ Seller not found');
        return [];
      }

      // Google Driveフォルダを取得または作成
      const folderInfo = await this.driveService.getOrCreateSellerFolder(
        sellerId,
        sellerNumber,
        seller.property_address,
        seller.name
      );

      console.log(`📁 Folder ID: ${folderInfo.folderId}`);

      // 画像ファイルのみを取得
      const imageFiles = await this.driveService.listImagesWithThumbnails(folderInfo.folderId);
      
      console.log(`✅ Found ${imageFiles.length} images`);
      
      // 画像識別サービスで分類
      const categorized = this.imageIdentifier.categorizeImages(imageFiles);
      
      console.log(`📊 Categorized: ${categorized.exterior.length} exterior, ${categorized.interior.length} interior, ${categorized.uncategorized.length} uncategorized`);

      return imageFiles;
    } catch (error) {
      console.error('❌ Get seller images error:', error);
      throw error;
    }
  }

  /**
   * 画像付きメールを送信（新形式：複数ソース対応）
   */
  async sendEmailWithImages(params: EmailWithImagesParams): Promise<EmailResult> {
    try {
      console.log('📧 Sending email with images:');
      console.log(`  To: ${params.to}`);
      console.log(`  Subject: ${params.subject}`);
      console.log(`  From: ${params.from}`);
      console.log(`  Body contains HTML:`, params.body.includes('<img'));
      console.log(`  Selected images:`, params.selectedImages);

      // bodyに既に画像が埋め込まれているかチェック
      console.log('🔍 Checking for embedded images in body...');
      console.log('📄 Body type:', typeof params.body);
      console.log('📄 Body length:', params.body?.length || 0);
      console.log('📄 Body preview (first 200 chars):', params.body?.substring(0, 200));
      
      const hasEmbeddedImages = /<img[^>]+src="data:image\/[^"]+"/i.test(params.body);
      console.log('🔍 Has embedded images:', hasEmbeddedImages);
      
      if (hasEmbeddedImages) {
        console.log('✅ Detected embedded images in body, extracting them...');
        console.log('📄 Original body HTML (first 500 chars):', params.body.substring(0, 500));
        
        // bodyから画像を抽出してCID参照に置き換え
        const inlineImages: EmailAttachment[] = [];
        let processedBody = params.body;
        let imageIndex = 0;
        
        // data:image/... 形式の画像を検出して置き換え
        const imageRegex = /<img([^>]*)src="data:image\/([^;]+);base64,([^"]+)"([^>]*)>/gi;
        
        processedBody = processedBody.replace(imageRegex, (fullMatch, beforeSrc, mimeType, base64Data, afterSrc) => {
          try {
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // ファイルサイズチェック（5MB制限）
            const maxSize = 5 * 1024 * 1024;
            if (imageBuffer.length > maxSize) {
              console.warn(`⚠️ Skipping embedded image ${imageIndex}: size ${imageBuffer.length} exceeds 5MB limit`);
              return fullMatch; // 元のタグをそのまま残す
            }
            
            const cid = `image-${imageIndex}`;
            
            inlineImages.push({
              filename: `embedded-image-${imageIndex}.${mimeType}`,
              mimeType: `image/${mimeType}`,
              data: imageBuffer,
              cid: cid,
            });
            
            console.log(`✅ Extracted embedded image ${imageIndex}: ${imageBuffer.length} bytes, CID: ${cid}`);
            imageIndex++;
            
            // data:image/...をcid:に置き換え
            return `<img${beforeSrc}src="cid:${cid}"${afterSrc}>`;
          } catch (error) {
            console.error(`❌ Error extracting embedded image ${imageIndex}:`, error);
            return fullMatch; // エラー時は元のタグをそのまま残す
          }
        });
        
        console.log(`✅ Extracted ${inlineImages.length} embedded images from body`);
        console.log('📄 Processed body HTML (first 500 chars):', processedBody.substring(0, 500));
        
        // CID参照の位置を確認
        const cidMatches = processedBody.match(/src="cid:[^"]+"/g);
        console.log('🔍 CID references found:', cidMatches);
        
        // HTMLボディをシンプルにラップ（構造を変更しない）
        const htmlBody = this.wrapInEmailTemplate(processedBody);
        
        console.log('📄 Final HTML body (first 1000 chars):');
        console.log(htmlBody.substring(0, 1000));
        
        // Gmail APIでメール送信
        const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        
        // マルチパートメールメッセージを作成
        const message = this.createMultipartMessage(
          params.from,
          params.to,
          params.subject,
          htmlBody,
          inlineImages
        );
        
        // メール送信（リトライロジック付き）
        const result = await retryGmailApi(async () => {
          return await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: message,
            },
          });
        });
        
        const messageId = result.data.id || `sent-${Date.now()}`;
        const sentAt = new Date();
        
        console.log(`✅ Email sent successfully: ${messageId}`);
        
        // メール送信ログをactivitiesテーブルに保存
        await this.saveEmailLog(
          params.sellerId,
          '', // employeeIdは後で追加
          params.subject,
          params.body,
          params.to,
          messageId
        );
        
        return {
          messageId,
          sentAt,
          success: true,
        };
      }
      
      // 埋め込み画像がない場合は、selectedImagesから画像を取得（従来の動作）
      const inlineImages: EmailAttachment[] = [];
      
      if (params.selectedImages && params.selectedImages.length > 0) {
        for (let i = 0; i < params.selectedImages.length; i++) {
          const image = params.selectedImages[i];
          
          try {
            let imageBuffer: Buffer;
            let mimeType: string = image.mimeType;
            
            // ソースに応じて画像データを取得
            if (image.source === 'drive' && image.driveFileId) {
              // Google Driveから取得
              const imageData = await this.driveService.getImageData(image.driveFileId);
              imageBuffer = imageData.buffer;
              mimeType = imageData.mimeType;
            } else if (image.source === 'local' && image.localFile) {
              // ローカルファイル（Base64エンコード済み）
              const base64Data = image.localFile.split(',')[1] || image.localFile;
              imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (image.source === 'url' && image.url) {
              // URLから取得
              const axios = require('axios');
              const response = await axios.get(image.url, { responseType: 'arraybuffer' });
              imageBuffer = Buffer.from(response.data);
              mimeType = response.headers['content-type'] || mimeType;
            } else {
              console.warn(`⚠️ Skipping image ${image.name}: invalid source data`);
              continue;
            }
            
            // ファイルサイズチェック（5MB制限）
            const maxSize = 5 * 1024 * 1024;
            if (imageBuffer.length > maxSize) {
              console.warn(`⚠️ Skipping image ${image.name}: size ${imageBuffer.length} exceeds 5MB limit`);
              continue;
            }
            
            inlineImages.push({
              filename: image.name,
              mimeType: mimeType,
              data: imageBuffer,
              cid: `image-${i}`,
            });
          } catch (error) {
            console.error(`❌ Error processing image ${image.name}:`, error);
            // エラーが発生しても他の画像の処理は続行
          }
        }
      }

      console.log(`✅ Processed ${inlineImages.length} images from selectedImages`);

      // HTMLボディをシンプルにラップ（構造を変更しない）
      const htmlBody = this.wrapInEmailTemplate(params.body);

      // Gmail APIでメール送信
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // マルチパートメールメッセージを作成
      const message = this.createMultipartMessage(
        params.from,
        params.to,
        params.subject,
        htmlBody,
        inlineImages
      );

      // メール送信（リトライロジック付き）
      const result = await retryGmailApi(async () => {
        return await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: message,
          },
        });
      });

      const messageId = result.data.id || `sent-${Date.now()}`;
      const sentAt = new Date();

      console.log(`✅ Email sent successfully: ${messageId}`);

      // メール送信ログをactivitiesテーブルに保存
      await this.saveEmailLog(
        params.sellerId,
        '', // employeeIdは後で追加
        params.subject,
        params.body,
        params.to,
        messageId
      );

      return {
        messageId,
        sentAt,
        success: true,
      };
    } catch (error) {
      console.error('❌ Send email with images error:', error);
      return {
        messageId: '',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 件名をRFC 2047形式でエンコード（日本語対応）
   */
  private encodeSubject(subject: string): string {
    // ASCII文字のみの場合はそのまま返す
    if (/^[\x00-\x7F]*$/.test(subject)) {
      return subject;
    }
    
    // UTF-8でBase64エンコード
    const encoded = Buffer.from(subject, 'utf-8').toString('base64');
    return `=?UTF-8?B?${encoded}?=`;
  }

  /**
   * 処理済みHTMLを最小限のメールテンプレートでラップ
   * 構造を変更せず、スタイルのみを追加
   */
  private wrapInEmailTemplate(bodyHtml: string): string {
    console.log('🎨 [wrapInEmailTemplate] Input body HTML (first 500 chars):', bodyHtml.substring(0, 500));
    
    const wrapped = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 10px 0;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
    
    console.log('🎨 [wrapInEmailTemplate] Output wrapped HTML (first 800 chars):', wrapped.substring(0, 800));
    
    return wrapped;
  }

  /**
   * マルチパートメールメッセージを作成（画像添付対応）
   */
  private createMultipartMessage(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    attachments: EmailAttachment[]
  ): string {
    const boundary = '----=_Part_' + Date.now();
    
    // 件名をRFC 2047形式でエンコード（日本語対応）
    const encodedSubject = this.encodeSubject(subject);
    
    // RFC準拠の改行コード（\r\n）を使用
    const messageParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',  // quoted-printableではなく8bitを使用
      '',
      htmlBody,
      '',
    ];

    // 添付ファイル（インライン画像）を追加
    for (const attachment of attachments) {
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: ${attachment.mimeType}`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-ID: <${attachment.cid}>`);
      messageParts.push(`Content-Disposition: inline; filename="${attachment.filename}"`);
      messageParts.push('');
      
      // Base64エンコードされた画像データを76文字ごとに改行（RFC 2045準拠）
      const base64Data = attachment.data.toString('base64');
      const lines = base64Data.match(/.{1,76}/g) || [];
      messageParts.push(lines.join('\r\n'));
      messageParts.push('');
    }

    messageParts.push(`--${boundary}--`);

    // RFC準拠の改行コード（\r\n）を使用
    const message = messageParts.join('\r\n');
    
    console.log('📧 [createMultipartMessage] Message structure:');
    console.log(`  Boundary: ${boundary}`);
    console.log(`  HTML body length: ${htmlBody.length}`);
    console.log(`  Attachments: ${attachments.length}`);
    console.log(`  Total message length: ${message.length}`);
    console.log('📄 [createMultipartMessage] Message preview (first 1000 chars):');
    console.log(message.substring(0, 1000));
    
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }
}
