"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ValuationEngine_supabase_1 = require("../services/ValuationEngine.supabase");
const SellerService_supabase_1 = require("../services/SellerService.supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const valuationEngine = new ValuationEngine_supabase_1.ValuationEngine();
const sellerService = new SellerService_supabase_1.SellerService();
// 全てのルートに認証を適用
router.use(auth_1.authenticate);
/**
 * 査定を実行
 */
router.post('/:sellerId/valuations', async (req, res) => {
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
        // 物件情報を取得
        const { data: property, error: propertyError } = await valuationEngine['table']('properties')
            .select('*')
            .eq('seller_id', sellerId)
            .single();
        if (propertyError || !property) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Property information not found',
                    retryable: false,
                },
            });
        }
        console.log('Property data from DB:', property);
        // データベースのスネークケースをキャメルケースに変換
        const propertyInfo = {
            id: property.id,
            sellerId: property.seller_id,
            address: property.address,
            prefecture: property.prefecture,
            city: property.city,
            propertyType: property.property_type,
            landArea: property.land_area,
            buildingArea: property.building_area,
            buildYear: property.build_year,
            structure: property.structure,
            floors: property.floors,
            rooms: property.rooms,
            parking: property.parking,
            additionalInfo: property.additional_info,
        };
        console.log('Converted property info:', propertyInfo);
        // 査定を実行
        const valuation = await valuationEngine.calculateValuation(sellerId, propertyInfo);
        res.status(201).json(valuation);
    }
    catch (error) {
        console.error('Valuation error:', error);
        res.status(500).json({
            error: {
                code: 'VALUATION_ERROR',
                message: 'Failed to calculate valuation',
                retryable: true,
            },
        });
    }
});
/**
 * 査定履歴を取得
 */
router.get('/:sellerId/valuations', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const valuations = await valuationEngine.getValuationHistory(sellerId);
        res.json(valuations);
    }
    catch (error) {
        console.error('Get valuation history error:', error);
        res.status(500).json({
            error: {
                code: 'GET_VALUATION_HISTORY_ERROR',
                message: 'Failed to get valuation history',
                retryable: true,
            },
        });
    }
});
/**
 * 査定額1を計算（詳細計算式）
 */
router.post('/:sellerId/calculate-valuation-amount1', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const { fixedAssetTaxRoadPrice } = req.body; // リクエストボディから固定資産税路線価を取得
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
        // 🚨 重要：リクエストボディで固定資産税路線価が指定されている場合、それを優先
        const effectiveRoadPrice = fixedAssetTaxRoadPrice ?? seller.fixedAssetTaxRoadPrice;
        if (!effectiveRoadPrice || effectiveRoadPrice <= 0) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '固定資産税路線価が設定されていません。路線価を入力してから査定額を計算してください。',
                    retryable: false,
                },
            });
        }
        seller.fixedAssetTaxRoadPrice = effectiveRoadPrice;
        console.log('Using effectiveRoadPrice:', effectiveRoadPrice);
        // 物件情報を取得（seller.property がない場合は seller の直接フィールドから構築）
        let propertyInfo = seller.property;
        if (!propertyInfo) {
            // seller の直接フィールドから PropertyInfo を構築
            propertyInfo = {
                id: '',
                sellerId: seller.id || '',
                address: seller.propertyAddress || '',
                propertyType: seller.propertyType || '',
                landArea: seller.landArea || 0,
                buildingArea: seller.buildingArea || 0,
                landAreaVerified: seller.landAreaVerified || undefined, // 土地（当社調べ）: 独自調査値を優先するために追加
                buildingAreaVerified: seller.buildingAreaVerified || undefined, // 建物（当社調べ）: 独自調査値を優先するために追加
                buildYear: seller.buildYear || 0,
                structure: seller.structure || '',
                floorPlan: seller.floorPlan || '',
                currentStatus: seller.currentStatus || '',
                sellerSituation: seller.currentStatus || '',
            };
            console.log('seller.property is null, using seller direct fields:', propertyInfo);
        }
        // 査定額1を計算
        console.log('Calculating valuation amount 1 for seller:', seller.id);
        console.log('Property data:', propertyInfo);
        const { valuationCalculatorService } = await Promise.resolve().then(() => __importStar(require('../services/ValuationCalculatorService')));
        const valuationAmount1 = await valuationCalculatorService.calculateValuationAmount1(seller, propertyInfo);
        console.log('Calculated valuation amount 1:', valuationAmount1);
        res.json({
            valuationAmount1,
            calculatedAt: new Date(),
        });
    }
    catch (error) {
        console.error('Calculate valuation amount 1 error:', error);
        res.status(500).json({
            error: {
                code: 'CALCULATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to calculate valuation amount 1',
                retryable: true,
            },
        });
    }
});
/**
 * 査定額2を計算
 */
router.post('/:sellerId/calculate-valuation-amount2', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const { valuationAmount1 } = req.body;
        if (valuationAmount1 === undefined || valuationAmount1 === null) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'valuationAmount1 is required',
                    retryable: false,
                },
            });
        }
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
        // 査定額2を計算
        const { valuationCalculatorService } = await Promise.resolve().then(() => __importStar(require('../services/ValuationCalculatorService')));
        const valuationAmount2 = await valuationCalculatorService.calculateValuationAmount2(seller, valuationAmount1);
        res.json({
            valuationAmount2,
            calculatedAt: new Date(),
        });
    }
    catch (error) {
        console.error('Calculate valuation amount 2 error:', error);
        res.status(500).json({
            error: {
                code: 'CALCULATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to calculate valuation amount 2',
                retryable: true,
            },
        });
    }
});
/**
 * 査定額3を計算
 */
router.post('/:sellerId/calculate-valuation-amount3', async (req, res) => {
    try {
        const { sellerId } = req.params;
        const { valuationAmount1 } = req.body;
        if (valuationAmount1 === undefined || valuationAmount1 === null) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'valuationAmount1 is required',
                    retryable: false,
                },
            });
        }
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
        // 査定額3を計算
        const { valuationCalculatorService } = await Promise.resolve().then(() => __importStar(require('../services/ValuationCalculatorService')));
        const valuationAmount3 = await valuationCalculatorService.calculateValuationAmount3(seller, valuationAmount1);
        res.json({
            valuationAmount3,
            calculatedAt: new Date(),
        });
    }
    catch (error) {
        console.error('Calculate valuation amount 3 error:', error);
        res.status(500).json({
            error: {
                code: 'CALCULATION_ERROR',
                message: error instanceof Error ? error.message : 'Failed to calculate valuation amount 3',
                retryable: true,
            },
        });
    }
});
exports.default = router;
