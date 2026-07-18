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
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const PropertyService_1 = require("../services/PropertyService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Apply authentication to all routes
router.use(auth_1.authenticate);
/**
 * Create property
 * POST /properties
 */
router.post('/', [
    (0, express_validator_1.body)('sellerId').isUUID().withMessage('Valid seller ID is required'),
    (0, express_validator_1.body)('address').notEmpty().withMessage('Address is required'),
    (0, express_validator_1.body)('propertyType')
        .isIn(Object.values(types_1.PropertyType))
        .withMessage('Valid property type is required'),
    (0, express_validator_1.body)('landArea').optional().isNumeric(),
    (0, express_validator_1.body)('buildingArea').optional().isNumeric(),
    (0, express_validator_1.body)('structure').optional().isString(),
    (0, express_validator_1.body)('sellerSituation').optional().isString(),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        // Validate structure if provided
        if (req.body.structure && !PropertyService_1.propertyService.validateStructure(req.body.structure)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid structure. Must be one of: 木造, 軽量鉄骨, 鉄骨, 他',
                    retryable: false,
                },
            });
        }
        // Validate seller situation if provided
        if (req.body.sellerSituation &&
            !PropertyService_1.propertyService.validateSellerSituation(req.body.sellerSituation)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid seller situation. Must be one of: 居, 空, 賃, 古有, 更, 他',
                    retryable: false,
                },
            });
        }
        const property = await PropertyService_1.propertyService.createProperty(req.body);
        res.status(201).json({ property });
    }
    catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({
            error: {
                code: 'CREATE_PROPERTY_ERROR',
                message: error.message || 'Failed to create property',
                retryable: true,
            },
        });
    }
});
/**
 * Get property by seller ID
 * GET /properties/seller/:sellerId
 * ⚠️ 重要: /:id より前に定義すること（Expressのルートマッチング順序のため）
 */
router.get('/seller/:sellerId', [(0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        const property = await PropertyService_1.propertyService.getPropertyBySellerId(sellerId);
        if (!property) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Property not found for this seller',
                    retryable: false,
                },
            });
        }
        res.json({ property });
    }
    catch (error) {
        console.error('Get property by seller error:', error);
        res.status(500).json({
            error: {
                code: 'GET_PROPERTY_ERROR',
                message: error.message || 'Failed to get property',
                retryable: true,
            },
        });
    }
});
/**
 * Get property by ID
 * GET /properties/:id
 */
router.get('/:id', [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid property ID')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        const { id } = req.params;
        const property = await PropertyService_1.propertyService.getProperty(id);
        if (!property) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Property not found',
                    retryable: false,
                },
            });
        }
        res.json({ property });
    }
    catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({
            error: {
                code: 'GET_PROPERTY_ERROR',
                message: error.message || 'Failed to get property',
                retryable: true,
            },
        });
    }
});
/**
 * Update property
 * PUT /properties/:id
 */
router.put('/:id', [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid property ID'),
    (0, express_validator_1.body)('propertyType').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined || value === '')
            return true;
        return Object.values(types_1.PropertyType).includes(value);
    }).withMessage('Invalid property type'),
    (0, express_validator_1.body)('landArea').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined)
            return true;
        return !isNaN(Number(value));
    }),
    (0, express_validator_1.body)('buildingArea').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined)
            return true;
        return !isNaN(Number(value));
    }),
    (0, express_validator_1.body)('landAreaVerified').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined)
            return true;
        return !isNaN(Number(value));
    }),
    (0, express_validator_1.body)('buildingAreaVerified').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined)
            return true;
        return !isNaN(Number(value));
    }),
    (0, express_validator_1.body)('buildYear').optional({ nullable: true }).custom((value) => {
        if (value === null || value === undefined)
            return true;
        return !isNaN(Number(value));
    }),
    (0, express_validator_1.body)('structure').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('floorPlan').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('sellerSituation').optional({ nullable: true }).isString(),
], async (req, res) => {
    try {
        console.log('PUT /properties/:id - Request body:', JSON.stringify(req.body, null, 2));
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            console.error('Property update validation errors:', JSON.stringify(errors.array(), null, 2));
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: errors.array(),
                    retryable: false,
                },
            });
        }
        // Validate structure if provided
        if (req.body.structure && !PropertyService_1.propertyService.validateStructure(req.body.structure)) {
            console.error('Invalid structure:', req.body.structure);
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid structure. Must be one of: 木造, 軽量鉄骨, 鉄骨, 他',
                    retryable: false,
                },
            });
        }
        // Validate seller situation if provided
        if (req.body.sellerSituation &&
            !PropertyService_1.propertyService.validateSellerSituation(req.body.sellerSituation)) {
            console.error('Invalid seller situation:', req.body.sellerSituation);
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid seller situation. Must be one of: 居, 空, 賃, 古有, 更, 他',
                    retryable: false,
                },
            });
        }
        const { id } = req.params;
        const property = await PropertyService_1.propertyService.updateProperty(id, req.body);
        console.log('Updated property response:', JSON.stringify(property, null, 2));
        res.json({ property });
    }
    catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({
            error: {
                code: 'UPDATE_PROPERTY_ERROR',
                message: error.message || 'Failed to update property',
                retryable: true,
            },
        });
    }
});
/**
 * Calculate distribution areas for a property
 * POST /properties/:propertyNumber/calculate-distribution-areas
 */
router.post('/:propertyNumber/calculate-distribution-areas', [
    (0, express_validator_1.param)('propertyNumber').notEmpty().withMessage('Property number is required'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        const { propertyNumber } = req.params;
        // Import calculator service
        const { PropertyDistributionAreaCalculator } = await Promise.resolve().then(() => __importStar(require('../services/PropertyDistributionAreaCalculator')));
        const calculator = new PropertyDistributionAreaCalculator();
        // Get property details from property_listings
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data: property, error: propertyError } = await supabase
            .from('property_listings')
            .select('google_map_url, address')
            .eq('property_number', propertyNumber)
            .single();
        if (propertyError || !property) {
            return res.status(404).json({
                error: {
                    code: 'PROPERTY_NOT_FOUND',
                    message: `Property ${propertyNumber} not found`,
                    retryable: false,
                },
            });
        }
        // Extract city from address
        const city = property.address ? extractCityFromAddress(property.address) : null;
        // Calculate distribution areas
        const result = await calculator.calculateDistributionAreas(property.google_map_url, city);
        res.json({
            success: true,
            areas: result.formatted,
            areaList: result.areas,
            radiusAreas: result.radiusAreas,
            cityWideAreas: result.cityWideAreas,
            calculatedAt: result.calculatedAt,
        });
    }
    catch (error) {
        console.error('Error calculating distribution areas:', error);
        res.status(500).json({
            success: false,
            message: error.message || '配信エリアの計算に失敗しました',
            error: {
                code: 'CALCULATION_ERROR',
                message: error.message || 'Failed to calculate distribution areas',
                retryable: true,
            },
        });
    }
});
/**
 * Extract city from property address
 * POST /properties/:id/extract-city
 */
router.post('/:id/extract-city', [(0, express_validator_1.param)('id').isUUID().withMessage('Valid property ID is required')], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
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
        const { id } = req.params;
        // Get property
        const property = await PropertyService_1.propertyService.getProperty(id);
        if (!property) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Property not found',
                    retryable: false,
                },
            });
        }
        // Extract city from address
        const extractedCity = extractCityFromAddress(property.address);
        if (!extractedCity) {
            return res.status(400).json({
                error: {
                    code: 'EXTRACTION_FAILED',
                    message: '住所から市名を抽出できませんでした',
                    retryable: false,
                },
            });
        }
        // Update property with extracted city
        const updatedProperty = await PropertyService_1.propertyService.updateProperty(id, {
            city: extractedCity,
        });
        res.json({
            success: true,
            data: {
                property: updatedProperty,
                extractedCity,
            },
        });
    }
    catch (error) {
        console.error('Error extracting city:', error);
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to extract city',
                retryable: true,
            },
        });
    }
});
/**
 * Helper function to extract city from address
 */
function extractCityFromAddress(address) {
    if (!address)
        return null;
    // 大分市田尻北3-14 → 大分市
    // 東京都渋谷区恵比寿1-2-3 → 渋谷区
    const cityMatch = address.match(/([^\s]+?[都道府県])?([^\s]+?[市区町村])/);
    if (cityMatch) {
        return cityMatch[2] || cityMatch[0];
    }
    return null;
}
exports.default = router;
