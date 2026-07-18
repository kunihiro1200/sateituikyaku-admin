"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = __importDefault(require("../config/supabase"));
const router = (0, express_1.Router)();
/**
 * 物件の座標を保存
 * POST /api/geocode/save
 */
router.post('/save', async (req, res) => {
    try {
        const { propertyNumber, latitude, longitude } = req.body;
        if (!propertyNumber || !latitude || !longitude) {
            return res.status(400).json({
                error: 'propertyNumber, latitude, longitude are required',
            });
        }
        // 直接SQLを実行してPostgRESTキャッシュを回避
        const { data, error } = await supabase_1.default.rpc('update_property_coordinates', {
            p_property_number: propertyNumber,
            p_latitude: latitude,
            p_longitude: longitude,
        });
        if (error) {
            console.error('Geocode save error:', error);
            return res.status(500).json({
                error: 'Failed to save coordinates',
                message: error.message,
            });
        }
        res.json({
            success: true,
            property: { property_number: propertyNumber },
        });
    }
    catch (error) {
        console.error('Geocode save error:', error);
        res.status(500).json({
            error: 'Failed to save coordinates',
            message: error.message,
        });
    }
});
/**
 * 複数物件の座標を一括保存
 * POST /api/geocode/batch-save
 */
router.post('/batch-save', async (req, res) => {
    try {
        const { properties } = req.body;
        if (!Array.isArray(properties) || properties.length === 0) {
            return res.status(400).json({
                error: 'properties array is required',
            });
        }
        let successCount = 0;
        let failCount = 0;
        // 各物件の座標を更新（直接SQLを実行）
        for (const prop of properties) {
            try {
                const { error } = await supabase_1.default.rpc('update_property_coordinates', {
                    p_property_number: prop.propertyNumber,
                    p_latitude: prop.latitude,
                    p_longitude: prop.longitude,
                });
                if (error) {
                    console.error(`Failed to update ${prop.propertyNumber}:`, error);
                    failCount++;
                }
                else {
                    successCount++;
                }
            }
            catch (error) {
                console.error(`Failed to update ${prop.propertyNumber}:`, error);
                failCount++;
            }
        }
        res.json({
            success: true,
            successCount,
            failCount,
            total: properties.length,
        });
    }
    catch (error) {
        console.error('Batch geocode save error:', error);
        res.status(500).json({
            error: 'Failed to save coordinates',
            message: error.message,
        });
    }
});
exports.default = router;
