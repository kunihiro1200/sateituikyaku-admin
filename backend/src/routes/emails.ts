import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { EmailService } from '../services/EmailService.supabase';
import { SellerService } from '../services/SellerService.supabase';
import { ValuationEngine } from '../services/ValuationEngine.supabase';
import { authenticate } from '../middleware/auth';

const router = Router();
const emailService = new EmailService();
const sellerService = new SellerService();
const valuationEngine = new ValuationEngine();

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * 査定メールを送信
 */
router.post(
  '/:sellerId/send-valuation-email',
  async (req: Request, res: Response) => {
    try {
      const { sellerId } = req.params;

      // 売主情報を取得
      const seller = await sellerService.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Seller not found',
            retryable: false,
          },
        });
      }

      // 査定額が計算されているか確認
      if (!seller.valuationAmount1 || !seller.valuationAmount2 || !seller.valuationAmount3) {
        return res.status(400).json({
          error: {
            code: 'VALUATION_NOT_CALCULATED',
            message: 'Valuation amounts not calculated. Please calculate first.',
            retryable: false,
          },
        });
      }

      // 新しい査定額データを作成
      const valuationData = {
        valuationAmount1: seller.valuationAmount1,
        valuationAmount2: seller.valuationAmount2,
        valuationAmount3: seller.valuationAmount3,
        fixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice,
      };

      // メールを送信
      const result = await emailService.sendValuationEmail(
        seller,
        valuationData as any,
        req.employee!.email,
        req.employee!.id
      );

      if (!result.success) {
        return res.status(502).json({
          error: {
            code: 'EMAIL_SEND_ERROR',
            message: result.error || 'Failed to send email',
            retryable: true,
          },
        });
      }

      res.json({
        messageId: result.messageId,
        sentAt: result.sentAt,
        success: true,
      });
    } catch (error) {
      console.error('Send valuation email error:', error);
      res.status(500).json({
        error: {
          code: 'EMAIL_SEND_ERROR',
          message: 'Failed to send valuation email',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 追客メールを送信
 */
router.post(
  '/:sellerId/send-follow-up-email',
  [
    body('content').notEmpty().withMessage('Email content is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { content } = req.body;

      // 売主情報を取得
      const seller = await sellerService.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Seller not found',
            retryable: false,
          },
        });
      }

      // メールを送信
      const result = await emailService.sendFollowUpEmail(
        seller,
        content,
        req.employee!.email
      );

      if (!result.success) {
        return res.status(502).json({
          error: {
            code: 'EMAIL_SEND_ERROR',
            message: result.error || 'Failed to send email',
            retryable: true,
          },
        });
      }

      res.json({
        messageId: result.messageId,
        sentAt: result.sentAt,
        success: true,
      });
    } catch (error) {
      console.error('Send follow-up email error:', error);
      res.status(500).json({
        error: {
          code: 'EMAIL_SEND_ERROR',
          message: 'Failed to send follow-up email',
          retryable: true,
        },
      });
    }
  }
);

/**
 * テンプレートメールを送信
 */
router.post(
  '/:sellerId/send-template-email',
  [
    body('templateId').notEmpty().withMessage('Template ID is required'),
    body('to').optional().isEmail().withMessage('Invalid email address'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('htmlBody').optional().isString().withMessage('HTML body must be a string'),
    body('from').optional().isEmail().withMessage('Invalid from email address'),
    body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  ],
  async (req: Request, res: Response) => {
    try {
      // デバッグログ: リクエストボディを記録
      console.log('📧 [send-template-email] Request body keys:', Object.keys(req.body));
      console.log('📧 [send-template-email] templateId:', req.body.templateId);
      console.log('📧 [send-template-email] to:', req.body.to);
      console.log('📧 [send-template-email] subject:', req.body.subject);
      console.log('📧 [send-template-email] from:', req.body.from);
      console.log('📧 [send-template-email] attachments count:', req.body.attachments?.length ?? 0);
      console.log('📧 [send-template-email] content length:', req.body.content?.length ?? 0);
      console.log('📧 [send-template-email] htmlBody length:', req.body.htmlBody?.length ?? 0);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('📧 [send-template-email] Validation errors:', JSON.stringify(errors.array()));
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId } = req.params;
      const { templateId, to, subject, content, htmlBody, from, attachments } = req.body;

      // 売主情報を取得
      const seller = await sellerService.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Seller not found',
            retryable: false,
          },
        });
      }

      // 送信先メールアドレス（編集された値を優先、なければ売主のメールアドレス）
      const recipientEmail = to || seller.email;
      
      if (!recipientEmail) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Recipient email address is required',
            retryable: false,
          },
        });
      }

      let result;

      // 添付ファイルがある場合は各ソースに応じてデータを取得して添付付きで送信
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const { GoogleDriveService } = await import('../services/GoogleDriveService');
        const driveService = new GoogleDriveService();

        const emailAttachmentsRaw = await Promise.all(
          attachments.map(async (img: any) => {
            // ローカルファイル（Base64データ）
            if (img.base64Data) {
              return {
                filename: img.name || 'attachment.jpg',
                mimeType: img.mimeType || 'image/jpeg',
                data: Buffer.from(img.base64Data, 'base64'),
                cid: `attachment-${img.id}`,
              };
            }
            // URL指定
            if (img.url) {
              try {
                const https = await import('https');
                const http = await import('http');
                const data = await new Promise<Buffer>((resolve, reject) => {
                  const client = img.url.startsWith('https') ? https : http;
                  (client as any).get(img.url, (res: any) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                  }).on('error', reject);
                });
                return {
                  filename: img.name || 'attachment.jpg',
                  mimeType: 'image/jpeg',
                  data,
                  cid: `attachment-${img.id}`,
                };
              } catch (urlErr) {
                console.warn(`⚠️ Could not fetch image from URL: ${img.url}`, urlErr);
                return null;
              }
            }
            // Google Drive ファイル
            const fileData = await driveService.getFile(img.id);
            if (!fileData) {
              console.warn(`⚠️ Could not fetch file from Google Drive: ${img.id}`);
              return null;
            }
            return {
              filename: img.name || `image-${img.id}.jpg`,
              mimeType: fileData.mimeType || 'image/jpeg',
              data: fileData.data,
              cid: `attachment-${img.id}`,
            };
          })
        );
        // nullを除外
        const emailAttachments = emailAttachmentsRaw.filter((a): a is NonNullable<typeof a> => a !== null);

        result = await emailService.sendEmailWithCcAndAttachments({
          to: recipientEmail,
          subject,
          body: htmlBody || content,
          from: from || req.employee!.email,
          attachments: emailAttachments,
          isHtml: !!htmlBody,
        });
      } else {
        // 添付ファイルなし: 既存フロー（変更なし）
        const sellerWithUpdatedEmail = { ...seller, email: recipientEmail };
        result = await emailService.sendTemplateEmail(
          sellerWithUpdatedEmail,
          subject,
          content || '',
          req.employee!.email,
          req.employee!.id,
          htmlBody,  // オプション: カスタムHTMLボディ（貼り付けた画像を含む場合）
          from       // オプション: 送信元メールアドレス
        );
      }

      if (!result.success) {
        return res.status(502).json({
          error: {
            code: 'EMAIL_SEND_ERROR',
            message: result.error || 'Failed to send email',
            retryable: true,
          },
        });
      }

      // templateIdに対応するassigneeフィールドを自動セット（バックエンドで確実に処理）
      const EMAIL_TEMPLATE_ASSIGNEE_MAP: Record<string, string> = {
        visit_reminder: 'visitReminderAssignee',
        remind: 'callReminderEmailAssignee',
        exclusion_long_term: 'longTermEmailAssignee',
        ieul_call_cancel: 'cancelNoticeAssignee',
        ieul_cancel_only: 'cancelNoticeAssignee',
        reason_relocation_3day: 'valuationReasonEmailAssignee',
        reason_inheritance_3day: 'valuationReasonEmailAssignee',
        reason_divorce_3day: 'valuationReasonEmailAssignee',
        reason_loan_3day: 'valuationReasonEmailAssignee',
      };
      const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[templateId];
      // フロントエンドから送信者イニシャルを受け取る（最優先）
      let senderInitials = (req.body.senderInitials || '').trim();
      console.log(`📧 [send-template-email] senderInitials from request: "${senderInitials}", employee.initials: "${(req.employee as any)?.initials}"`);
      // フォールバック1: req.employee.initials
      if (!senderInitials) senderInitials = (req.employee as any)?.initials || '';
      // フォールバック2: employeeUtils
      if (!senderInitials && req.employee?.email) {
        try {
          const { EmployeeUtils } = await import('../utils/employeeUtils');
          const empUtils = new EmployeeUtils();
          const activeEmps = await empUtils.getActiveEmployeesWithEmail();
          const matched = activeEmps.find(e => e.email?.toLowerCase() === req.employee!.email?.toLowerCase());
          if (matched?.initials) senderInitials = matched.initials;
          console.log(`📧 [send-template-email] Resolved initials via employeeUtils: ${senderInitials}`);
        } catch (empErr) {
          console.warn('📧 [send-template-email] Failed to resolve initials via employeeUtils:', empErr);
        }
      }
      // フォールバック3: StaffManagementService（スプシから取得）
      if (!senderInitials && req.employee?.email) {
        try {
          const { StaffManagementService } = await import('../services/StaffManagementService');
          const staffService = new StaffManagementService();
          const resolved = await staffService.getInitialsByEmail(req.employee.email);
          if (resolved) senderInitials = resolved;
          console.log(`📧 [send-template-email] Resolved initials via StaffManagementService.getInitialsByEmail: ${senderInitials}`);
        } catch (staffErr) {
          console.warn('📧 [send-template-email] Failed to resolve initials via StaffManagementService:', staffErr);
        }
      }
      if (assigneeKey && senderInitials && sellerId) {
        try {
          await sellerService.updateSeller(sellerId, { [assigneeKey]: senderInitials } as any);
          console.log(`📧 [send-template-email] Auto-set ${assigneeKey}=${senderInitials} for seller ${sellerId}`);
        } catch (assigneeErr) {
          console.warn(`📧 [send-template-email] Failed to auto-set ${assigneeKey}:`, assigneeErr);
        }
      }

      res.json({
        messageId: result.messageId,
        sentAt: result.sentAt,
        success: true,
        templateId,
        senderInitials,
        assigneeKey: assigneeKey || null,
      });
    } catch (error) {
      console.error('Send template email error:', error);
      res.status(500).json({
        error: {
          code: 'EMAIL_SEND_ERROR',
          message: 'Failed to send template email',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 画像付きメールを送信
 */
router.post(
  '/with-images',
  [
    body('sellerId').notEmpty().withMessage('Seller ID is required'),
    body('sellerNumber').notEmpty().withMessage('Seller number is required'),
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('body').notEmpty().withMessage('Email body is required'),
    body('selectedImages').optional().isObject().withMessage('Selected images must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerId, sellerNumber, to, subject, body, selectedImages } = req.body;

      // メールを送信
      const result = await emailService.sendEmailWithImages({
        sellerId,
        sellerNumber,
        to,
        subject,
        body,
        from: req.employee!.email,
        selectedImages,
      });

      if (!result.success) {
        return res.status(502).json({
          error: {
            code: 'EMAIL_SEND_ERROR',
            message: result.error || 'Failed to send email with images',
            retryable: true,
          },
        });
      }

      res.json({
        messageId: result.messageId,
        sentAt: result.sentAt,
        success: true,
      });
    } catch (error) {
      console.error('Send email with images error:', error);
      res.status(500).json({
        error: {
          code: 'EMAIL_SEND_ERROR',
          message: 'Failed to send email with images',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 売主の画像一覧を取得
 */
router.get(
  '/images/:sellerNumber',
  async (req: Request, res: Response) => {
    try {
      const { sellerNumber } = req.params;

      console.log(`📸 GET /api/emails/images/${sellerNumber}`);

      // 売主情報を取得して売主IDを確認
      const sellers = await sellerService.searchSellers(sellerNumber);
      if (!sellers || sellers.length === 0) {
        console.error(`❌ Seller not found: ${sellerNumber}`);
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Seller not found',
            retryable: false,
          },
        });
      }

      const seller = sellers[0];
      console.log(`✅ Seller found: ${seller.name} (ID: ${seller.id})`);

      // 画像一覧を取得
      const images = await emailService.getSellerImages(seller.id, sellerNumber);

      console.log(`📊 Found ${images.length} images in Drive folder`);

      // 画像が見つからない場合
      if (images.length === 0) {
        console.warn(`⚠️ No images found for seller ${sellerNumber}`);
        return res.json({
          images: [],
          categorized: {
            exterior: [],
            interior: [],
            uncategorized: [],
          },
          autoSelected: {
            exterior: null,
            interior: null,
          },
          count: 0,
        });
      }

      // 画像識別サービスで分類
      const { ImageIdentifierService } = await import('../services/ImageIdentifierService');
      const imageIdentifier = new ImageIdentifierService();
      const categorized = imageIdentifier.categorizeImages(images);

      console.log(`📊 Categorization results:`);
      console.log(`  - Exterior: ${categorized.exterior.length} images`);
      console.log(`  - Interior: ${categorized.interior.length} images`);
      console.log(`  - Uncategorized: ${categorized.uncategorized.length} images`);

      // フォールバック戦略: パターンに一致しない場合、最初の2つの画像を使用
      let autoSelectedExterior = null;
      let autoSelectedInterior = null;

      if (categorized.exterior.length > 0) {
        // 外観画像が見つかった場合、最新のものを選択
        autoSelectedExterior = categorized.exterior[0].id;
      } else if (categorized.uncategorized.length > 0) {
        // 外観画像が見つからない場合、未分類の最初の画像を外観として使用
        console.log(`⚠️ No exterior images found, using first uncategorized image`);
        autoSelectedExterior = categorized.uncategorized[0].id;
      }

      if (categorized.interior.length > 0) {
        // 室内画像が見つかった場合、最新のものを選択
        autoSelectedInterior = categorized.interior[0].id;
      } else if (categorized.uncategorized.length > 1) {
        // 室内画像が見つからない場合、未分類の2番目の画像を室内として使用
        console.log(`⚠️ No interior images found, using second uncategorized image`);
        autoSelectedInterior = categorized.uncategorized[1].id;
      } else if (categorized.uncategorized.length === 1 && !autoSelectedExterior) {
        // 未分類が1つだけで、外観にも使われていない場合
        autoSelectedInterior = categorized.uncategorized[0].id;
      }

      const autoSelected = {
        exterior: autoSelectedExterior,
        interior: autoSelectedInterior,
      };

      console.log(`✅ Auto-selected: exterior=${autoSelectedExterior}, interior=${autoSelectedInterior}`);
      console.log(`✅ Returning ${images.length} images with auto-selection`);

      res.json({
        images,
        categorized,
        autoSelected,
        count: images.length,
      });
    } catch (error: any) {
      console.error('❌ Get seller images error:', error);
      res.status(500).json({
        error: {
          code: 'IMAGE_FETCH_ERROR',
          message: error.message || 'Failed to fetch seller images',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 画像プレビューを取得
 */
router.get(
  '/images/preview/:fileId',
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      // Google Drive から画像データを取得
      const { GoogleDriveService } = await import('../services/GoogleDriveService');
      const driveService = new GoogleDriveService();
      const imageData = await driveService.getFile(fileId);

      if (!imageData) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Image not found',
            retryable: false,
          },
        });
      }

      // 画像データを返す
      res.set('Content-Type', imageData.mimeType || 'image/jpeg');
      res.send(imageData.data);
    } catch (error) {
      console.error('Get image preview error:', error);
      res.status(500).json({
        error: {
          code: 'IMAGE_FETCH_ERROR',
          message: 'Failed to fetch image preview',
          retryable: true,
        },
      });
    }
  }
);

/**
 * Gmail配信メールを送信（Gmail API経由）
 */
router.post(
  '/send-distribution',
  [
    body('senderAddress').isEmail().withMessage('Valid sender email address is required'),
    body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
    body('recipients.*').isEmail().withMessage('All recipients must be valid email addresses'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('body').notEmpty().withMessage('Email body is required'),
    body('propertyNumber').optional().isString().withMessage('Property number must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { senderAddress, recipients, subject, body, propertyNumber, attachments } = req.body;

      // recipientsは文字列配列または{email, name, buyerNumber}配列のどちらも受け付ける
      const normalizedRecipients: Array<{ email: string; name: string | null; buyerNumber?: string }> = recipients.map((r: any) => {
        if (typeof r === 'string') return { email: r, name: null };
        return { email: r.email, name: r.name || null, buyerNumber: r.buyerNumber };
      });

      // 送信元アドレスのホワイトリスト検証
      const validSenders = [
        'tenant@ifoo-oita.com',
        'gyosha@ifoo-oita.com',
        'info@ifoo-oita.com',
      ];

      if (!validSenders.includes(senderAddress)) {
        return res.status(400).json({
          success: false,
          message: '無効な送信元アドレスです',
        });
      }

      // 添付ファイルの処理（画像データをBufferに変換）
      let processedAttachments: Array<{ filename: string; mimeType: string; data: Buffer }> | undefined;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const { GoogleDriveService } = await import('../services/GoogleDriveService');
        const driveService = new GoogleDriveService();

        const attachmentsRaw = await Promise.all(
          attachments.map(async (img: any) => {
            // ローカルファイル（Base64データ）
            if (img.base64Data) {
              return {
                filename: img.name || 'attachment.jpg',
                mimeType: img.mimeType || 'image/jpeg',
                data: Buffer.from(img.base64Data, 'base64'),
              };
            }
            // URL指定
            if (img.url) {
              try {
                const https = await import('https');
                const http = await import('http');
                const data = await new Promise<Buffer>((resolve, reject) => {
                  const client = img.url.startsWith('https') ? https : http;
                  (client as any).get(img.url, (res: any) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                  }).on('error', reject);
                });
                return {
                  filename: img.name || 'attachment.jpg',
                  mimeType: 'image/jpeg',
                  data,
                };
              } catch (urlErr) {
                console.warn(`⚠️ Could not fetch image from URL: ${img.url}`, urlErr);
                return null;
              }
            }
            // Google Drive ファイル
            const fileData = await driveService.getFile(img.id);
            if (!fileData) {
              console.warn(`⚠️ Could not fetch file from Google Drive: ${img.id}`);
              return null;
            }
            return {
              filename: img.name || `image-${img.id}.jpg`,
              mimeType: fileData.mimeType || 'image/jpeg',
              data: fileData.data,
            };
          })
        );
        processedAttachments = attachmentsRaw.filter((a): a is NonNullable<typeof a> => a !== null);
      }

      // EmailServiceを使用してメールを送信
      const result = await emailService.sendDistributionEmail({
        senderAddress,
        recipients: normalizedRecipients,
        subject,
        body,
        propertyNumber: propertyNumber || 'unknown',
        attachments: processedAttachments,
      });

      // activity_logsに記録（メール送信成功後）
      // 各買主ごとに記録
      const { ActivityLogService } = await import('../services/ActivityLogService');
      const activityLogService = new ActivityLogService();
      
      // sourceを判定（propertyNumberがある場合は公開前・値下げメール、ない場合は近隣買主）
      const source = propertyNumber ? 'pre_public_price_reduction' : 'nearby_buyers';
      
      for (const recipient of normalizedRecipients) {
        try {
          await activityLogService.logEmail({
            buyerId: recipient.buyerNumber || recipient.email, // buyer_numberを優先、なければemailを使用
            propertyNumbers: propertyNumber ? [propertyNumber] : [],
            recipientEmail: recipient.email,
            subject,
            templateName: source === 'pre_public_price_reduction' ? '公開前・値下げメール' : '近隣買主',
            senderEmail: senderAddress,
            source: source, // 送信元識別子
            createdBy: (req as any).user?.id || 'system',
          });
        } catch (logError) {
          // activity_logs記録失敗はログのみ（ユーザーには通知しない）
          console.error('Failed to log email activity:', logError);
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Send distribution email error:', error);
      res.status(500).json({
        success: false,
        message: 'メール送信中にエラーが発生しました',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);


/**
 * seller_numberを使ってテンプレートメールを送信（物件詳細ページ用）
 */
router.post(
  '/by-seller-number/:sellerNumber/send-template-email',
  [
    body('templateId').notEmpty().withMessage('Template ID is required'),
    body('to').optional().isEmail().withMessage('Invalid email address'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('htmlBody').optional().isString().withMessage('HTML body must be a string'),
    body('from').optional().isEmail().withMessage('Invalid from email address'),
    body('attachments').optional().isArray().withMessage('Attachments must be an array'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerNumber } = req.params;
      const { templateId, to, subject, content, htmlBody, from, attachments } = req.body;

      // seller_numberで売主を検索
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: sellerRow, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('seller_number', sellerNumber.toUpperCase())
        .is('deleted_at', null)
        .single();

      if (sellerError || !sellerRow) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Seller not found',
            retryable: false,
          },
        });
      }

      // sellerServiceのdecryptSellerを使って復号
      const seller = await (sellerService as any).decryptSeller(sellerRow);

      const recipientEmail = to || seller.email;
      if (!recipientEmail) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Recipient email address is required',
            retryable: false,
          },
        });
      }

      let result;

      const senderEmail = from || req.employee?.email || 'tenant@ifoo-oita.com';
      const sellerWithEmail = { ...seller, email: recipientEmail } as any;

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const { GoogleDriveService } = await import('../services/GoogleDriveService');
        const driveService = new GoogleDriveService();

        const emailAttachmentsRaw = await Promise.all(
          attachments.map(async (img: any) => {
            if (img.base64Data) {
              return {
                filename: img.name || 'attachment.jpg',
                mimeType: img.mimeType || 'image/jpeg',
                data: Buffer.from(img.base64Data, 'base64'),
                cid: `attachment-${img.id}`,
              };
            } else if (img.url) {
              try {
                const https = await import('https');
                const http = await import('http');
                const data = await new Promise<Buffer>((resolve, reject) => {
                  const protocol = img.url.startsWith('https') ? https : http;
                  (protocol as any).get(img.url, (response: any) => {
                    const chunks: Buffer[] = [];
                    response.on('data', (chunk: Buffer) => chunks.push(chunk));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                    response.on('error', reject);
                  });
                });
                return { filename: img.name || 'attachment.jpg', mimeType: 'image/jpeg', data, cid: `attachment-${img.id}` };
              } catch { return null; }
            } else if (img.id) {
              const fileData = await driveService.getFile(img.id);
              if (!fileData) return null;
              return {
                filename: img.name || `image-${img.id}.jpg`,
                mimeType: fileData.mimeType || 'image/jpeg',
                data: fileData.data,
                cid: `attachment-${img.id}`,
              };
            }
            return null;
          })
        );

        const emailAttachments = emailAttachmentsRaw.filter(Boolean) as any[];

        result = await emailService.sendEmailWithCcAndAttachments({
          to: recipientEmail,
          subject,
          body: htmlBody || content || '',
          from: senderEmail,
          attachments: emailAttachments,
          isHtml: !!htmlBody,
        });
      } else {
        result = await emailService.sendTemplateEmail(
          sellerWithEmail,
          subject,
          content || '',
          senderEmail,
          req.employee?.id || 'system',
          htmlBody,
          senderEmail
        );
      }

      return res.json({
        success: true,
        message: 'Email sent successfully',
        result,
      });
    } catch (error: any) {
      console.error('Error sending template email by seller number:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
