"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inquiryService = exports.InquiryService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
/**
 * Service for managing inquiry (反響) information
 * Handles inquiry tracking from various valuation sites
 */
class InquiryService {
    /**
     * Record inquiry information for a seller
     *
     * @param sellerId - Seller ID
     * @param inquiryData - Inquiry information to record
     * @returns Updated inquiry information
     */
    async recordInquiry(sellerId, inquiryData) {
        try {
            const { data, error } = await supabase
                .from('sellers')
                .update({
                inquiry_year: inquiryData.inquiryYear,
                inquiry_detailed_datetime: inquiryData.inquiryDetailedDateTime,
                inquiry_site: inquiryData.inquirySite,
                inquiry_reason: inquiryData.inquiryReason,
                site_url: inquiryData.siteUrl,
                number_of_companies: inquiryData.numberOfCompanies,
            })
                .eq('id', sellerId)
                .select('inquiry_year, inquiry_detailed_datetime, inquiry_site, inquiry_reason, site_url, number_of_companies')
                .single();
            if (error) {
                console.error('Error recording inquiry:', error);
                throw new Error(`Failed to record inquiry: ${error.message}`);
            }
            return this.mapToInquiryInfo(data);
        }
        catch (error) {
            console.error('Record inquiry error:', error);
            throw error;
        }
    }
    /**
     * Get inquiry information for a seller
     *
     * @param sellerId - Seller ID
     * @returns Inquiry information or null if not found
     */
    async getInquiry(sellerId) {
        try {
            const { data, error } = await supabase
                .from('sellers')
                .select('inquiry_year, inquiry_date, inquiry_detailed_datetime, inquiry_site, inquiry_reason, site_url, number_of_companies')
                .eq('id', sellerId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                console.error('Error getting inquiry:', error);
                throw new Error(`Failed to get inquiry: ${error.message}`);
            }
            // Check if inquiry data exists
            if (!data.inquiry_year && !data.inquiry_date) {
                return null;
            }
            return this.mapToInquiryInfo(data);
        }
        catch (error) {
            console.error('Get inquiry error:', error);
            throw error;
        }
    }
    /**
     * Get inquiry site name from code
     *
     * @param siteCode - Site code (e.g., 'ウ', 'L', 'S', 'H')
     * @returns Full site name
     */
    getInquirySiteName(siteCode) {
        const siteNames = {
            ウ: 'イエウール',
            L: 'LIFULL HOME',
            S: 'SUUMO',
            H: 'HOME4U',
            その他: 'その他',
        };
        return siteNames[siteCode] || siteCode;
    }
    /**
     * Get inquiry site code from name
     *
     * @param siteName - Full site name
     * @returns Site code
     */
    getInquirySiteCode(siteName) {
        const siteCodes = {
            イエウール: 'ウ',
            'LIFULL HOME': 'L',
            SUUMO: 'S',
            HOME4U: 'H',
            その他: 'その他',
        };
        return siteCodes[siteName] || siteName;
    }
    /**
     * Validate inquiry site code
     *
     * @param siteCode - Site code to validate
     * @returns true if valid
     */
    validateInquirySite(siteCode) {
        const validSites = ['ウ', 'L', 'S', 'H', 'その他'];
        return validSites.includes(siteCode);
    }
    /**
     * Auto-transfer valuation reason from inquiry site
     * Different sites may have different formats
     *
     * @param siteCode - Inquiry site code
     * @param rawReason - Raw reason text from site
     * @returns Formatted reason
     */
    autoTransferValuationReason(siteCode, rawReason) {
        // Site-specific processing can be added here
        switch (siteCode) {
            case 'ウ': // イエウール
                return this.processIeulReason(rawReason);
            case 'L': // LIFULL HOME
                return this.processLifullReason(rawReason);
            case 'S': // SUUMO
                return this.processSuumoReason(rawReason);
            case 'H': // HOME4U
                return this.processHome4uReason(rawReason);
            default:
                return rawReason;
        }
    }
    /**
     * Process イエウール specific reason format
     */
    processIeulReason(rawReason) {
        // Add イエウール-specific processing if needed
        return rawReason.trim();
    }
    /**
     * Process LIFULL HOME specific reason format
     */
    processLifullReason(rawReason) {
        // Add LIFULL HOME-specific processing if needed
        return rawReason.trim();
    }
    /**
     * Process SUUMO specific reason format
     */
    processSuumoReason(rawReason) {
        // Add SUUMO-specific processing if needed
        return rawReason.trim();
    }
    /**
     * Process HOME4U specific reason format
     */
    processHome4uReason(rawReason) {
        // Add HOME4U-specific processing if needed
        return rawReason.trim();
    }
    /**
     * Generate site URL based on site code and seller information
     *
     * @param siteCode - Inquiry site code
     * @param sellerId - Seller ID
     * @returns Generated site URL
     */
    generateSiteUrl(siteCode, sellerId) {
        // This is a placeholder - actual URLs would depend on the site's structure
        const baseUrls = {
            ウ: 'https://ieul.jp',
            L: 'https://www.homes.co.jp',
            S: 'https://suumo.jp',
            H: 'https://www.home4u.jp',
        };
        const baseUrl = baseUrls[siteCode];
        if (!baseUrl) {
            return '';
        }
        return `${baseUrl}/inquiry/${sellerId}`;
    }
    /**
     * Calculate inquiry year from date
     *
     * @param inquiryDate - Inquiry date
     * @returns Inquiry year
     */
    calculateInquiryYear(inquiryDate) {
        return inquiryDate.getFullYear();
    }
    /**
     * Map database record to InquiryInfo type
     */
    mapToInquiryInfo(data) {
        return {
            inquiryYear: data.inquiry_year,
            inquiryDetailedDateTime: data.inquiry_detailed_datetime
                ? new Date(data.inquiry_detailed_datetime)
                : undefined,
            inquirySite: data.inquiry_site,
            inquiryReason: data.inquiry_reason,
            siteUrl: data.site_url,
            numberOfCompanies: data.number_of_companies,
        };
    }
}
exports.InquiryService = InquiryService;
// Export singleton instance
exports.inquiryService = new InquiryService();
