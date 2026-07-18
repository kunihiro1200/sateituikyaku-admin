"use strict";
/**
 * 買主紐づけ検証サービス
 * 特定の物件番号の買主紐づけを検証し、APIエンドポイントをテストする
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerLinkageValidator = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
class BuyerLinkageValidator {
    constructor(apiBaseUrl = 'http://localhost:3000/api') {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.apiBaseUrl = apiBaseUrl;
    }
    /**
     * 特定物件の買主紐づけを検証
     */
    async validateProperty(propertyNumber) {
        const errors = [];
        let databaseCount = 0;
        let apiCount = 0;
        let buyers = [];
        try {
            // データベースから直接カウント取得
            const { count, error: dbError } = await this.supabase
                .from('buyers')
                .select('*', { count: 'exact', head: true })
                .eq('property_number', propertyNumber);
            if (dbError) {
                errors.push(`Database error: ${dbError.message}`);
            }
            else {
                databaseCount = count || 0;
            }
            // APIエンドポイントからカウント取得
            try {
                const response = await axios_1.default.get(`${this.apiBaseUrl}/property-listings/${propertyNumber}/buyers`, { timeout: 5000 });
                buyers = response.data;
                apiCount = buyers.length;
            }
            catch (apiError) {
                if (apiError.response) {
                    errors.push(`API error: ${apiError.response.status} - ${apiError.response.statusText}`);
                }
                else if (apiError.request) {
                    errors.push(`API error: No response received`);
                }
                else {
                    errors.push(`API error: ${apiError.message}`);
                }
            }
            // 検証
            const match = databaseCount === apiCount && errors.length === 0;
            return {
                propertyNumber,
                databaseCount,
                apiCount,
                match,
                buyers,
                errors
            };
        }
        catch (error) {
            errors.push(`Validation error: ${error.message}`);
            return {
                propertyNumber,
                databaseCount,
                apiCount,
                match: false,
                buyers,
                errors
            };
        }
    }
    /**
     * 複数物件の買主紐づけを一括検証
     */
    async validateBatch(propertyNumbers) {
        const results = [];
        for (const propertyNumber of propertyNumbers) {
            const result = await this.validateProperty(propertyNumber);
            results.push(result);
        }
        const passed = results.filter(r => r.match).length;
        const failed = results.filter(r => !r.match).length;
        return {
            total: results.length,
            passed,
            failed,
            results
        };
    }
    /**
     * 買主データの整合性を検証
     */
    async validateBuyerData(propertyNumber) {
        const issues = [];
        try {
            const { data, error } = await this.supabase
                .from('buyers')
                .select('*')
                .eq('property_number', propertyNumber);
            if (error) {
                issues.push(`Failed to fetch buyers: ${error.message}`);
                return { valid: false, issues };
            }
            if (!data || data.length === 0) {
                return { valid: true, issues: [] };
            }
            // 各買主データを検証
            data.forEach((buyer, index) => {
                // 必須フィールドの検証
                if (!buyer.buyer_number) {
                    issues.push(`Buyer ${index + 1}: Missing buyer_number`);
                }
                if (!buyer.name) {
                    issues.push(`Buyer ${index + 1}: Missing name`);
                }
                if (!buyer.property_number) {
                    issues.push(`Buyer ${index + 1}: Missing property_number`);
                }
                // property_numberに対象物件番号が含まれているか検証
                if (buyer.property_number && !buyer.property_number.includes(propertyNumber)) {
                    issues.push(`Buyer ${index + 1}: property_number does not contain ${propertyNumber}`);
                }
                // 日付フォーマットの検証
                if (buyer.reception_date) {
                    const date = new Date(buyer.reception_date);
                    if (isNaN(date.getTime())) {
                        issues.push(`Buyer ${index + 1}: Invalid reception_date format`);
                    }
                }
            });
            return {
                valid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            issues.push(`Validation error: ${error.message}`);
            return { valid: false, issues };
        }
    }
    /**
     * APIレスポンスの構造を検証
     */
    async validateApiResponse(propertyNumber) {
        const issues = [];
        try {
            const response = await axios_1.default.get(`${this.apiBaseUrl}/property-listings/${propertyNumber}/buyers`, { timeout: 5000 });
            const buyers = response.data;
            // レスポンスが配列であることを確認
            if (!Array.isArray(buyers)) {
                issues.push('Response is not an array');
                return { valid: false, issues };
            }
            // 各買主オブジェクトの構造を検証
            buyers.forEach((buyer, index) => {
                const requiredFields = ['buyer_number', 'name', 'phone_number', 'latest_status'];
                requiredFields.forEach(field => {
                    if (!(field in buyer)) {
                        issues.push(`Buyer ${index + 1}: Missing required field '${field}'`);
                    }
                });
                // フィールドの型を検証
                if (buyer.buyer_number && typeof buyer.buyer_number !== 'string') {
                    issues.push(`Buyer ${index + 1}: buyer_number should be string`);
                }
                if (buyer.name && typeof buyer.name !== 'string') {
                    issues.push(`Buyer ${index + 1}: name should be string`);
                }
            });
            return {
                valid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            if (error.response) {
                issues.push(`API error: ${error.response.status}`);
            }
            else {
                issues.push(`API error: ${error.message}`);
            }
            return { valid: false, issues };
        }
    }
    /**
     * 包括的な検証を実行
     */
    async validateComprehensive(propertyNumber) {
        const linkage = await this.validateProperty(propertyNumber);
        const data = await this.validateBuyerData(propertyNumber);
        const api = await this.validateApiResponse(propertyNumber);
        const linkageValid = linkage.match;
        const dataValid = data.valid;
        const apiValid = api.valid;
        let summary = '';
        if (linkageValid && dataValid && apiValid) {
            summary = '✓ All validations passed';
        }
        else {
            const failures = [];
            if (!linkageValid)
                failures.push('linkage');
            if (!dataValid)
                failures.push('data integrity');
            if (!apiValid)
                failures.push('API response');
            summary = `✗ Failed: ${failures.join(', ')}`;
        }
        return {
            propertyNumber,
            linkageValid,
            dataValid,
            apiValid,
            summary,
            details: {
                linkage,
                data,
                api
            }
        };
    }
}
exports.BuyerLinkageValidator = BuyerLinkageValidator;
