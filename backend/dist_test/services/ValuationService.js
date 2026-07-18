"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valuationService = exports.ValuationService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const types_1 = require("../types");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
/**
 * Service for managing multiple valuation amounts
 * Handles valuation amount 1, 2, 3 for detached houses and land
 * Supports manual input for apartments and post-visit valuations
 */
class ValuationService {
    /**
     * Calculate three valuation amounts for detached house or land
     * Amount 1 (lowest) ≤ Amount 2 (middle) ≤ Amount 3 (highest)
     *
     * @param propertyType - Property type
     * @param landArea - Land area in square meters
     * @param buildingArea - Building area in square meters (for detached house)
     * @param buildYear - Build year (for depreciation)
     * @param prefecture - Prefecture for location adjustment
     * @param fixedAssetTaxRoadPrice - Fixed asset tax road price (optional)
     * @returns Three valuation amounts
     */
    async calculateValuationAmounts(propertyType, landArea, buildingArea, buildYear, prefecture, fixedAssetTaxRoadPrice) {
        try {
            // Only auto-calculate for detached house and land
            if (propertyType !== types_1.PropertyType.DETACHED_HOUSE &&
                propertyType !== types_1.PropertyType.LAND) {
                throw new Error('Auto-calculation only available for detached house and land');
            }
            // Base price per square meter
            const basePricePerSqm = this.getBasePricePerSqm(propertyType, prefecture);
            // Calculate base valuation
            let baseValuation = 0;
            if (propertyType === types_1.PropertyType.DETACHED_HOUSE) {
                const landValue = (landArea || 0) * basePricePerSqm;
                const buildingValue = this.calculateBuildingValue(buildingArea || 0, buildYear, basePricePerSqm);
                baseValuation = landValue + buildingValue;
            }
            else if (propertyType === types_1.PropertyType.LAND) {
                baseValuation = (landArea || 0) * basePricePerSqm;
            }
            // Apply fixed asset tax road price if available
            if (fixedAssetTaxRoadPrice && landArea) {
                const roadPriceValuation = fixedAssetTaxRoadPrice * landArea;
                // Use average of calculated and road price valuation
                baseValuation = (baseValuation + roadPriceValuation) / 2;
            }
            // Calculate three amounts with ±10% range
            const amount1 = Math.round(baseValuation * 0.9); // Lower bound
            const amount2 = Math.round(baseValuation); // Middle (base)
            const amount3 = Math.round(baseValuation * 1.1); // Upper bound
            return { amount1, amount2, amount3 };
        }
        catch (error) {
            console.error('Calculate valuation amounts error:', error);
            throw error;
        }
    }
    /**
     * Save valuation amounts to seller record
     *
     * @param sellerId - Seller ID
     * @param valuations - Valuation amounts to save
     * @returns Updated valuation amounts
     */
    async saveValuationAmounts(sellerId, valuations) {
        try {
            // Validate order: amount1 <= amount2 <= amount3
            if (valuations.valuationAmount1 && valuations.valuationAmount2) {
                if (valuations.valuationAmount1 > valuations.valuationAmount2) {
                    throw new Error('Valuation amount 1 must be less than or equal to amount 2');
                }
            }
            if (valuations.valuationAmount2 && valuations.valuationAmount3) {
                if (valuations.valuationAmount2 > valuations.valuationAmount3) {
                    throw new Error('Valuation amount 2 must be less than or equal to amount 3');
                }
            }
            if (valuations.valuationAmount1 && valuations.valuationAmount3) {
                if (valuations.valuationAmount1 > valuations.valuationAmount3) {
                    throw new Error('Valuation amount 1 must be less than or equal to amount 3');
                }
            }
            const updateData = {};
            if (valuations.valuationAmount1 !== undefined) {
                updateData.valuation_amount_1 = valuations.valuationAmount1;
            }
            if (valuations.valuationAmount2 !== undefined) {
                updateData.valuation_amount_2 = valuations.valuationAmount2;
            }
            if (valuations.valuationAmount3 !== undefined) {
                updateData.valuation_amount_3 = valuations.valuationAmount3;
            }
            if (valuations.postVisitValuationAmount1 !== undefined) {
                updateData.post_visit_valuation_amount_1 = valuations.postVisitValuationAmount1;
            }
            if (valuations.valuationMethod !== undefined) {
                updateData.valuation_method = valuations.valuationMethod;
            }
            if (valuations.valuationPdfUrl !== undefined) {
                updateData.valuation_pdf_url = valuations.valuationPdfUrl;
            }
            if (valuations.fixedAssetTaxRoadPrice !== undefined) {
                updateData.fixed_asset_tax_road_price = valuations.fixedAssetTaxRoadPrice;
            }
            const { data, error } = await supabase
                .from('sellers')
                .update(updateData)
                .eq('id', sellerId)
                .select(`valuation_amount_1, valuation_amount_2, valuation_amount_3,
           post_visit_valuation_amount_1, valuation_method, valuation_pdf_url,
           fixed_asset_tax_road_price`)
                .single();
            if (error) {
                console.error('Error saving valuation amounts:', error);
                throw new Error(`Failed to save valuation amounts: ${error.message}`);
            }
            return this.mapToValuationAmounts(data);
        }
        catch (error) {
            console.error('Save valuation amounts error:', error);
            throw error;
        }
    }
    /**
     * Get valuation amounts for a seller
     *
     * @param sellerId - Seller ID
     * @returns Valuation amounts or null if not found
     */
    async getValuationAmounts(sellerId) {
        try {
            const { data, error } = await supabase
                .from('sellers')
                .select(`valuation_amount_1, valuation_amount_2, valuation_amount_3,
           post_visit_valuation_amount_1, valuation_method, valuation_pdf_url,
           fixed_asset_tax_road_price`)
                .eq('id', sellerId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                console.error('Error getting valuation amounts:', error);
                throw new Error(`Failed to get valuation amounts: ${error.message}`);
            }
            // Check if any valuation data exists
            if (!data.valuation_amount_1 &&
                !data.valuation_amount_2 &&
                !data.valuation_amount_3) {
                return null;
            }
            return this.mapToValuationAmounts(data);
        }
        catch (error) {
            console.error('Get valuation amounts error:', error);
            throw error;
        }
    }
    /**
     * Update post-visit valuation amount
     *
     * @param sellerId - Seller ID
     * @param amount - Post-visit valuation amount
     * @returns Updated valuation amounts
     */
    async updatePostVisitValuation(sellerId, amount) {
        try {
            const { data, error } = await supabase
                .from('sellers')
                .update({ post_visit_valuation_amount_1: amount })
                .eq('id', sellerId)
                .select(`valuation_amount_1, valuation_amount_2, valuation_amount_3,
           post_visit_valuation_amount_1, valuation_method, valuation_pdf_url,
           fixed_asset_tax_road_price`)
                .single();
            if (error) {
                console.error('Error updating post-visit valuation:', error);
                throw new Error(`Failed to update post-visit valuation: ${error.message}`);
            }
            return this.mapToValuationAmounts(data);
        }
        catch (error) {
            console.error('Update post-visit valuation error:', error);
            throw error;
        }
    }
    /**
     * Update valuation PDF URL (for Tsunagaru Online)
     *
     * @param sellerId - Seller ID
     * @param pdfUrl - PDF URL
     * @returns Updated valuation amounts
     */
    async updateValuationPdfUrl(sellerId, pdfUrl) {
        try {
            const { data, error } = await supabase
                .from('sellers')
                .update({ valuation_pdf_url: pdfUrl })
                .eq('id', sellerId)
                .select(`valuation_amount_1, valuation_amount_2, valuation_amount_3,
           post_visit_valuation_amount_1, valuation_method, valuation_pdf_url,
           fixed_asset_tax_road_price`)
                .single();
            if (error) {
                console.error('Error updating valuation PDF URL:', error);
                throw new Error(`Failed to update valuation PDF URL: ${error.message}`);
            }
            return this.mapToValuationAmounts(data);
        }
        catch (error) {
            console.error('Update valuation PDF URL error:', error);
            throw error;
        }
    }
    /**
     * Get base price per square meter based on property type and location
     *
     * @param propertyType - Property type
     * @param prefecture - Prefecture
     * @returns Base price per square meter
     */
    getBasePricePerSqm(propertyType, prefecture) {
        // Base prices (simplified - in production, use market data)
        const basePrices = {
            [types_1.PropertyType.DETACHED_HOUSE]: 200000,
            [types_1.PropertyType.APARTMENT]: 300000,
            [types_1.PropertyType.LAND]: 150000,
            [types_1.PropertyType.COMMERCIAL]: 400000,
        };
        let basePrice = basePrices[propertyType] || 200000;
        // Location adjustment
        if (prefecture) {
            const premiumPrefectures = ['東京都', '神奈川県', '大阪府', '愛知県'];
            if (premiumPrefectures.includes(prefecture)) {
                basePrice *= 1.3;
            }
        }
        return basePrice;
    }
    /**
     * Calculate building value with depreciation
     *
     * @param buildingArea - Building area in square meters
     * @param buildYear - Build year
     * @param basePricePerSqm - Base price per square meter
     * @returns Building value
     */
    calculateBuildingValue(buildingArea, buildYear, basePricePerSqm) {
        const baseValue = buildingArea * basePricePerSqm;
        if (!buildYear) {
            return baseValue;
        }
        // Apply depreciation
        const currentYear = new Date().getFullYear();
        const age = currentYear - buildYear;
        if (age <= 0) {
            return baseValue;
        }
        // 1.5% depreciation per year, max 50% depreciation
        const depreciationRate = 0.015;
        const depreciationFactor = Math.max(0.5, 1 - age * depreciationRate);
        return baseValue * depreciationFactor;
    }
    /**
     * Validate valuation method
     *
     * @param method - Valuation method to validate
     * @returns true if valid
     */
    validateValuationMethod(method) {
        const validMethods = ['机上査定メール', '郵送', '不通'];
        return validMethods.includes(method);
    }
    /**
     * Map database record to ValuationAmounts type
     */
    mapToValuationAmounts(data) {
        return {
            valuationAmount1: data.valuation_amount_1,
            valuationAmount2: data.valuation_amount_2,
            valuationAmount3: data.valuation_amount_3,
            postVisitValuationAmount1: data.post_visit_valuation_amount_1,
            valuationMethod: data.valuation_method,
            valuationPdfUrl: data.valuation_pdf_url,
            fixedAssetTaxRoadPrice: data.fixed_asset_tax_road_price,
        };
    }
}
exports.ValuationService = ValuationService;
// Export singleton instance
exports.valuationService = new ValuationService();
