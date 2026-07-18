"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataIntegrityDiagnosticService = void 0;
// Data Integrity Diagnostic Service
// Diagnoses data synchronization issues between sellers and property_listings tables
const supabase_js_1 = require("@supabase/supabase-js");
const PropertyDistributionAreaCalculator_1 = require("./PropertyDistributionAreaCalculator");
class DataIntegrityDiagnosticService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.distributionCalculator = new PropertyDistributionAreaCalculator_1.PropertyDistributionAreaCalculator();
    }
    /**
     * Diagnose a single property for data integrity issues
     */
    async diagnoseProperty(propertyNumber) {
        // Check property_listings table
        const { data: propertyListing, error: plError } = await this.supabase
            .from('property_listings')
            .select('*')
            .eq('property_number', propertyNumber)
            .maybeSingle();
        if (plError && plError.code !== 'PGRST116') {
            throw new Error(`Failed to query property_listings: ${plError.message}`);
        }
        // Check sellers table (using seller_number which is the property number)
        const { data: seller, error: sellerError } = await this.supabase
            .from('sellers')
            .select('*')
            .eq('seller_number', propertyNumber)
            .maybeSingle();
        if (sellerError && sellerError.code !== 'PGRST116') {
            throw new Error(`Failed to query sellers: ${sellerError.message}`);
        }
        // Determine sync status
        const existsInPropertyListings = !!propertyListing;
        const existsInSellers = !!seller;
        let syncStatus;
        if (existsInPropertyListings && existsInSellers) {
            syncStatus = 'synced';
        }
        else if (!existsInPropertyListings && existsInSellers) {
            syncStatus = 'missing_property_listing';
        }
        else if (existsInPropertyListings && !existsInSellers) {
            syncStatus = 'missing_seller';
        }
        else {
            syncStatus = 'not_found';
        }
        return {
            propertyNumber,
            existsInPropertyListings,
            existsInSellers,
            syncStatus,
            sellerData: seller ? {
                seller_number: seller.seller_number,
                property_number: seller.seller_number, // seller_number IS the property number
                address: seller.address,
                city: seller.city,
                price: seller.price,
                property_type: seller.property_type,
            } : undefined,
            propertyListingData: propertyListing ? {
                property_number: propertyListing.property_number,
                address: propertyListing.address,
                city: propertyListing.city,
                price: propertyListing.price,
                property_type: propertyListing.property_type,
            } : undefined,
        };
    }
    /**
     * Diagnose multiple properties in batch
     */
    async diagnoseBatch(propertyNumbers) {
        const results = [];
        for (const propertyNumber of propertyNumbers) {
            try {
                const result = await this.diagnoseProperty(propertyNumber);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to diagnose property ${propertyNumber}:`, error);
                // Continue with other properties
                results.push({
                    propertyNumber,
                    existsInPropertyListings: false,
                    existsInSellers: false,
                    syncStatus: 'not_found',
                });
            }
        }
        return results;
    }
    /**
     * Find all property numbers that exist in sellers but not in property_listings
     */
    async findAllMissingPropertyListings() {
        // Get all property numbers from sellers (using seller_number)
        const { data: sellers, error: sellersError } = await this.supabase
            .from('sellers')
            .select('seller_number')
            .not('seller_number', 'is', null);
        if (sellersError) {
            throw new Error(`Failed to query sellers: ${sellersError.message}`);
        }
        if (!sellers || sellers.length === 0) {
            return [];
        }
        const sellerPropertyNumbers = sellers.map(s => s.seller_number);
        // Get all property numbers from property_listings
        const { data: propertyListings, error: plError } = await this.supabase
            .from('property_listings')
            .select('property_number');
        if (plError) {
            throw new Error(`Failed to query property_listings: ${plError.message}`);
        }
        const propertyListingNumbers = new Set((propertyListings || []).map(pl => pl.property_number));
        // Find missing property numbers
        const missingPropertyNumbers = sellerPropertyNumbers.filter(pn => !propertyListingNumbers.has(pn));
        return missingPropertyNumbers;
    }
    /**
     * Get summary statistics of data integrity
     */
    async getSummaryStats() {
        // Count sellers with seller_number (property_number)
        const { count: totalSellers, error: sellersError } = await this.supabase
            .from('sellers')
            .select('*', { count: 'exact', head: true })
            .not('seller_number', 'is', null);
        if (sellersError) {
            throw new Error(`Failed to count sellers: ${sellersError.message}`);
        }
        // Count property_listings
        const { count: totalPropertyListings, error: plError } = await this.supabase
            .from('property_listings')
            .select('*', { count: 'exact', head: true });
        if (plError) {
            throw new Error(`Failed to count property_listings: ${plError.message}`);
        }
        // Find missing property_listings
        const missingPropertyNumbers = await this.findAllMissingPropertyListings();
        return {
            totalSellers: totalSellers || 0,
            totalPropertyListings: totalPropertyListings || 0,
            synced: (totalSellers || 0) - missingPropertyNumbers.length,
            missingPropertyListings: missingPropertyNumbers.length,
            missingSellerRecords: Math.max(0, (totalPropertyListings || 0) - (totalSellers || 0)),
        };
    }
    /**
     * Diagnose distribution areas for a single property
     */
    async diagnoseDistributionAreas(propertyNumber) {
        // Get property data from sellers table
        const { data: seller, error: sellerError } = await this.supabase
            .from('sellers')
            .select('seller_number, address, city, google_map_url')
            .eq('seller_number', propertyNumber)
            .maybeSingle();
        if (sellerError) {
            throw new Error(`Failed to query seller: ${sellerError.message}`);
        }
        if (!seller) {
            throw new Error(`Property ${propertyNumber} not found in sellers table`);
        }
        // Get current distribution areas from property_listings
        const { data: propertyListing, error: plError } = await this.supabase
            .from('property_listings')
            .select('distribution_areas')
            .eq('property_number', propertyNumber)
            .maybeSingle();
        if (plError) {
            throw new Error(`Failed to query property_listings: ${plError.message}`);
        }
        const currentDistributionAreas = propertyListing?.distribution_areas || [];
        // Calculate what the distribution areas should be
        const { result, debugInfo } = await this.distributionCalculator.calculateWithDebugInfo(seller.google_map_url, seller.city);
        const calculatedDistributionAreas = result.areas;
        // Compare current vs calculated
        const missingAreas = calculatedDistributionAreas.filter((area) => !currentDistributionAreas.includes(area));
        const unexpectedAreas = currentDistributionAreas.filter((area) => !calculatedDistributionAreas.includes(area));
        const discrepancy = missingAreas.length > 0 || unexpectedAreas.length > 0;
        return {
            propertyNumber,
            address: seller.address || '',
            googleMapUrl: seller.google_map_url,
            city: seller.city,
            currentDistributionAreas,
            calculatedDistributionAreas,
            discrepancy,
            missingAreas,
            unexpectedAreas,
            distanceDebugInfo: debugInfo
        };
    }
    /**
     * Validate all distribution areas
     */
    async validateAllDistributionAreas() {
        // Get all property listings with their property numbers
        const { data: propertyListings, error } = await this.supabase
            .from('property_listings')
            .select('property_number');
        if (error) {
            throw new Error(`Failed to query property_listings: ${error.message}`);
        }
        if (!propertyListings || propertyListings.length === 0) {
            return {
                total: 0,
                correct: 0,
                incorrect: 0,
                missing: 0,
                diagnostics: []
            };
        }
        const diagnostics = [];
        let correct = 0;
        let incorrect = 0;
        let missing = 0;
        for (const listing of propertyListings) {
            try {
                const diagnostic = await this.diagnoseDistributionAreas(listing.property_number);
                diagnostics.push(diagnostic);
                if (diagnostic.discrepancy) {
                    incorrect++;
                }
                else {
                    correct++;
                }
                if (diagnostic.currentDistributionAreas.length === 0) {
                    missing++;
                }
            }
            catch (error) {
                console.error(`Failed to diagnose ${listing.property_number}:`, error);
                missing++;
            }
        }
        return {
            total: propertyListings.length,
            correct,
            incorrect,
            missing,
            diagnostics
        };
    }
    /**
     * Generate distribution area report
     */
    async generateDistributionAreaReport() {
        // Get all sellers with their data
        const { data: sellers, error: sellersError } = await this.supabase
            .from('sellers')
            .select('seller_number, google_map_url, city');
        if (sellersError) {
            throw new Error(`Failed to query sellers: ${sellersError.message}`);
        }
        if (!sellers || sellers.length === 0) {
            return {
                summary: {
                    totalProperties: 0,
                    propertiesWithGoogleMapUrl: 0,
                    propertiesWithCity: 0,
                    propertiesWithCompleteData: 0,
                    propertiesWithIncorrectAreas: 0
                },
                issues: []
            };
        }
        let propertiesWithGoogleMapUrl = 0;
        let propertiesWithCity = 0;
        let propertiesWithCompleteData = 0;
        let propertiesWithIncorrectAreas = 0;
        const issues = [];
        for (const seller of sellers) {
            const hasUrl = !!seller.google_map_url && seller.google_map_url.trim() !== '';
            const hasCity = !!seller.city && seller.city.trim() !== '';
            if (hasUrl)
                propertiesWithGoogleMapUrl++;
            if (hasCity)
                propertiesWithCity++;
            if (hasUrl && hasCity)
                propertiesWithCompleteData++;
            // Check for issues
            if (!hasUrl) {
                issues.push({
                    propertyNumber: seller.seller_number,
                    issueType: 'missing_url',
                    details: 'Google Map URLが未設定です'
                });
            }
            if (!hasCity) {
                issues.push({
                    propertyNumber: seller.seller_number,
                    issueType: 'missing_city',
                    details: '市フィールドが未設定です'
                });
            }
            // Check for incorrect calculation (only if we have data)
            if (hasUrl || hasCity) {
                try {
                    const diagnostic = await this.diagnoseDistributionAreas(seller.seller_number);
                    if (diagnostic.discrepancy) {
                        propertiesWithIncorrectAreas++;
                        issues.push({
                            propertyNumber: seller.seller_number,
                            issueType: 'incorrect_calculation',
                            details: `配信エリアが不一致: 不足=${diagnostic.missingAreas.join(',')}, 余分=${diagnostic.unexpectedAreas.join(',')}`
                        });
                    }
                }
                catch (error) {
                    console.error(`Failed to diagnose ${seller.seller_number}:`, error);
                }
            }
        }
        return {
            summary: {
                totalProperties: sellers.length,
                propertiesWithGoogleMapUrl,
                propertiesWithCity,
                propertiesWithCompleteData,
                propertiesWithIncorrectAreas
            },
            issues
        };
    }
}
exports.DataIntegrityDiagnosticService = DataIntegrityDiagnosticService;
