"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertySyncHandler = void 0;
/**
 * Property Sync Handler
 *
 * Handles synchronization of property information from spreadsheet to database.
 * Manages property creation and updates linked to sellers.
 */
class PropertySyncHandler {
    constructor(supabase) {
        this.supabase = supabase;
    }
    /**
     * Sync property data for a seller
     * Creates new property if doesn't exist, updates if exists
     *
     * @param sellerId - 売主ID
     * @param propertyData - 物件データ
     * @param propertyNumber - 物件番号（オプショナル）
     */
    async syncProperty(sellerId, propertyData, propertyNumber) {
        try {
            // Find or create property
            const propertyId = await this.findOrCreateProperty(sellerId, propertyNumber);
            // Update property fields
            await this.updatePropertyFields(propertyId, propertyData, propertyNumber);
            return {
                success: true,
                propertyId,
                operation: 'update',
            };
        }
        catch (error) {
            console.error(`❌ Failed to sync property for seller ${sellerId}:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Find existing property or create new one
     * Returns property ID
     *
     * @param sellerId - 売主ID
     * @param propertyNumber - 物件番号（オプショナル、現在は使用しない）
     */
    async findOrCreateProperty(sellerId, propertyNumber) {
        // seller_idで検索
        const { data: existingBySeller, error: findBySellerError } = await this.supabase
            .from('properties')
            .select('id, created_at, property_address, land_area, building_area')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
        if (findBySellerError) {
            throw new Error(`Error finding property by seller: ${findBySellerError.message}`);
        }
        // If multiple properties exist, warn and use the latest one
        if (existingBySeller && existingBySeller.length > 1) {
            console.warn(`⚠️  Seller ${sellerId} has ${existingBySeller.length} properties. Using the latest one (${existingBySeller[0].id}).`);
            console.warn(`   This indicates a data quality issue that should be cleaned up.`);
        }
        // If at least one property exists, return the latest one
        if (existingBySeller && existingBySeller.length > 0) {
            return existingBySeller[0].id;
        }
        // Create new property only if none exists
        // Note: property_address column has NOT NULL constraint, so we use '' as default
        // Note: property_type column has NOT NULL constraint and CHECK constraint
        // Allowed values: '戸建て', '土地', 'マンション'
        const insertData = {
            seller_id: sellerId,
            property_address: '',
            property_type: '土地', // デフォルトは '土地'（制約: '戸建て', '土地', 'マンション'のみ）
        };
        const { data: newProperty, error: createError } = await this.supabase
            .from('properties')
            .insert(insertData)
            .select('id')
            .single();
        if (createError || !newProperty) {
            throw new Error(`Error creating property: ${createError?.message}`);
        }
        console.log(`✅ Created new property ${newProperty.id} for seller ${sellerId}`);
        return newProperty.id;
    }
    /**
     * Update property fields with data from spreadsheet
     * Handles numeric conversions and null values
     *
     * @param propertyId - 物件ID
     * @param data - 物件データ
     * @param propertyNumber - 物件番号（オプショナル、現在は使用しない）
     */
    async updatePropertyFields(propertyId, data, propertyNumber) {
        // Prepare update data
        const updateData = {};
        // Add fields if they exist
        if (data.address !== undefined) {
            updateData.property_address = data.address || null;
        }
        if (data.property_type !== undefined) {
            updateData.property_type = data.property_type || null;
        }
        if (data.land_area !== undefined) {
            updateData.land_area = this.parseNumeric(data.land_area);
        }
        if (data.building_area !== undefined) {
            updateData.building_area = this.parseNumeric(data.building_area);
        }
        if (data.build_year !== undefined) {
            updateData.construction_year = this.parseNumeric(data.build_year);
        }
        if (data.structure !== undefined) {
            // properties.structure の CHECK制約: ('木造', '軽量鉄骨', '鉄骨', '他') のみ許可
            // 無効な値（"済", "木造２F建て", "未", "不要", "木造平屋", "不明" など）は null にマッピング
            const validStructures = ['木造', '軽量鉄骨', '鉄骨', '他'];
            const structureValue = data.structure ? String(data.structure).trim() : null;
            updateData.structure = (structureValue && validStructures.includes(structureValue)) ? structureValue : null;
        }
        if (data.seller_situation !== undefined) {
            updateData.seller_situation = data.seller_situation || null;
        }
        if (data.floor_plan !== undefined) {
            updateData.floor_plan = data.floor_plan || null;
        }
        if (data.land_rights !== undefined) {
            updateData.land_rights = data.land_rights || null;
        }
        if (data.current_status !== undefined) {
            updateData.current_status = data.current_status || null;
        }
        // Update property
        const { error } = await this.supabase
            .from('properties')
            .update(updateData)
            .eq('id', propertyId);
        if (error) {
            throw new Error(`Error updating property: ${error.message}`);
        }
    }
    /**
     * Parse numeric value, handling commas and empty values
     */
    parseNumeric(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        if (typeof value === 'number') {
            return value;
        }
        // Remove commas and parse
        const str = String(value).replace(/,/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }
}
exports.PropertySyncHandler = PropertySyncHandler;
