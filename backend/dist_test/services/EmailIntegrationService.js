"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailIntegrationService = void 0;
const SellerNumberService_1 = require("./SellerNumberService");
const encryption_1 = require("../utils/encryption");
const types_1 = require("../types");
/**
 * メール統合サービス
 *
 * 査定依頼メールから自動的に売主を登録し、
 * SupabaseとGoogleスプレッドシートの両方に同期します。
 */
class EmailIntegrationService {
    constructor(supabase, syncService) {
        this.supabase = supabase;
        this.syncService = syncService;
    }
    /**
     * 査定依頼メールを処理して売主を登録
     */
    async handleInquiryEmail(emailData) {
        try {
            // バリデーション
            const validationError = this.validateEmailData(emailData);
            if (validationError) {
                return {
                    success: false,
                    error: validationError,
                };
            }
            // 売主番号を生成
            const sellerNumber = await this.generateSellerNumber();
            // 個人情報を暗号化
            const encryptedData = {
                seller_number: sellerNumber,
                name: (0, encryption_1.encrypt)(emailData.name),
                address: (0, encryption_1.encrypt)(emailData.address),
                phone_number: (0, encryption_1.encrypt)(emailData.phoneNumber),
                email: emailData.email ? (0, encryption_1.encrypt)(emailData.email) : null,
                inquiry_source: emailData.inquirySource,
                inquiry_date: emailData.inquiryDate.toISOString(),
                inquiry_year: emailData.inquiryYear || emailData.inquiryDate.getFullYear(),
                status: types_1.SellerStatus.FOLLOWING_UP,
                is_unreachable: false,
                duplicate_confirmed: false,
            };
            // Supabaseに売主を作成
            const { data: seller, error: sellerError } = await this.supabase
                .from('sellers')
                .insert(encryptedData)
                .select()
                .single();
            if (sellerError || !seller) {
                return {
                    success: false,
                    error: `Failed to create seller: ${sellerError?.message}`,
                };
            }
            // 物件情報を作成
            const { error: propertyError } = await this.supabase
                .from('properties')
                .insert({
                seller_id: seller.id,
                address: emailData.propertyAddress,
                prefecture: emailData.prefecture,
                city: emailData.city,
                property_type: emailData.propertyType,
                land_area: emailData.landArea,
                building_area: emailData.buildingArea,
                build_year: emailData.buildYear,
                additional_info: emailData.additionalInfo,
            });
            if (propertyError) {
                // ロールバック: 売主を削除
                await this.supabase.from('sellers').delete().eq('id', seller.id);
                return {
                    success: false,
                    error: `Failed to create property: ${propertyError.message}`,
                };
            }
            // スプレッドシートに同期
            const syncResult = await this.syncService.syncToSpreadsheet(seller.id);
            if (!syncResult.success) {
                console.error('Failed to sync to spreadsheet:', syncResult.error);
                // 同期失敗はエラーとして扱わない（後でリトライ可能）
            }
            return {
                success: true,
                sellerId: seller.id,
                sellerNumber: sellerNumber,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * メールデータをバリデーション
     */
    validateEmailData(data) {
        if (!data.name || data.name.trim() === '') {
            return '名前は必須です';
        }
        if (!data.address || data.address.trim() === '') {
            return '住所は必須です';
        }
        if (!data.phoneNumber || data.phoneNumber.trim() === '') {
            return '電話番号は必須です';
        }
        // 電話番号の形式チェック（簡易版）
        const phoneRegex = /^[0-9\-\(\)\s]+$/;
        if (!phoneRegex.test(data.phoneNumber)) {
            return '電話番号の形式が不正です';
        }
        // メールアドレスの形式チェック
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                return 'メールアドレスの形式が不正です';
            }
        }
        if (!data.propertyAddress || data.propertyAddress.trim() === '') {
            return '物件住所は必須です';
        }
        if (!data.inquirySource || data.inquirySource.trim() === '') {
            return '反響元は必須です';
        }
        if (!data.inquiryDate) {
            return '反響日は必須です';
        }
        return null;
    }
    /**
     * 売主番号を生成
     */
    async generateSellerNumber() {
        try {
            return await SellerNumberService_1.sellerNumberService.generateWithRetry();
        }
        catch (error) {
            console.error('Failed to generate seller number, using fallback:', error);
            // Fallback: タイムスタンプベースの番号を生成
            const timestamp = Date.now().toString().slice(-5);
            return `AA${timestamp}`;
        }
    }
    /**
     * 重複チェック（オプション）
     */
    async checkDuplicates(phoneNumber, email) {
        const encryptedPhone = (0, encryption_1.encrypt)(phoneNumber);
        const encryptedEmail = email ? (0, encryption_1.encrypt)(email) : undefined;
        const matches = [];
        // 電話番号で検索
        const { data: phoneMatches } = await this.supabase
            .from('sellers')
            .select('id, seller_number')
            .eq('phone_number', encryptedPhone);
        if (phoneMatches && phoneMatches.length > 0) {
            phoneMatches.forEach(match => {
                matches.push({
                    sellerId: match.id,
                    sellerNumber: match.seller_number,
                    matchType: 'phone',
                });
            });
        }
        // メールアドレスで検索
        if (encryptedEmail) {
            const { data: emailMatches } = await this.supabase
                .from('sellers')
                .select('id, seller_number')
                .eq('email', encryptedEmail);
            if (emailMatches && emailMatches.length > 0) {
                emailMatches.forEach(match => {
                    // 既に電話番号でマッチしている場合はスキップ
                    if (!matches.find(m => m.sellerId === match.id)) {
                        matches.push({
                            sellerId: match.id,
                            sellerNumber: match.seller_number,
                            matchType: 'email',
                        });
                    }
                });
            }
        }
        return {
            hasDuplicates: matches.length > 0,
            matches,
        };
    }
    /**
     * バッチ処理: 複数のメールを一括処理
     */
    async handleBatchInquiryEmails(emails) {
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        for (const email of emails) {
            const result = await this.handleInquiryEmail(email);
            results.push(result);
            if (result.success) {
                successCount++;
            }
            else {
                failureCount++;
            }
        }
        return {
            successCount,
            failureCount,
            results,
        };
    }
}
exports.EmailIntegrationService = EmailIntegrationService;
