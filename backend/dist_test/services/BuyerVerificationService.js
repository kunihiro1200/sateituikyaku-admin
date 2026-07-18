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
exports.BuyerVerificationService = void 0;
const googleapis_1 = require("googleapis");
const supabase_js_1 = require("@supabase/supabase-js");
const path = __importStar(require("path"));
const BuyerColumnMapper_1 = require("./BuyerColumnMapper");
const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';
/**
 * Service for verifying buyer data consistency between database and spreadsheet
 */
class BuyerVerificationService {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase credentials');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
        this.columnMapper = new BuyerColumnMapper_1.BuyerColumnMapper();
    }
    /**
     * Verify a specific buyer by buyer number
     * @param buyerNumber The buyer number to verify
     * @returns Verification result
     */
    async verifyBuyer(buyerNumber) {
        console.log(`Verifying buyer ${buyerNumber}...`);
        // Check database
        const { data: dbBuyer, error: dbError } = await this.supabase
            .from('buyers')
            .select('*')
            .eq('buyer_number', buyerNumber)
            .single();
        if (dbError && dbError.code !== 'PGRST116') {
            throw new Error(`Database error: ${dbError.message}`);
        }
        const existsInDatabase = !!dbBuyer;
        // Check spreadsheet
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../../google-service-account.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        // Get headers
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!1:1`,
        });
        const headers = headerResponse.data.values?.[0] || [];
        // Get all data
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A2:GZ`,
        });
        const rows = dataResponse.data.values || [];
        // Find buyer in spreadsheet
        let sheetBuyer = null;
        for (const row of rows) {
            const data = this.columnMapper.mapSpreadsheetToDatabase(headers, row);
            if (data.buyer_number === buyerNumber) {
                sheetBuyer = data;
                break;
            }
        }
        const existsInSpreadsheet = !!sheetBuyer;
        // Compare fields if both exist
        let mismatches = [];
        let dataMatches = false;
        if (existsInDatabase && existsInSpreadsheet) {
            mismatches = this.compareFields(dbBuyer, sheetBuyer);
            dataMatches = mismatches.length === 0;
        }
        return {
            buyerNumber,
            existsInDatabase,
            existsInSpreadsheet,
            dataMatches,
            mismatches,
            lastSyncedAt: dbBuyer?.last_synced_at || null,
        };
    }
    /**
     * Compare fields between database and spreadsheet buyer
     * @param dbBuyer Buyer from database
     * @param sheetBuyer Buyer from spreadsheet
     * @returns Array of field mismatches
     */
    compareFields(dbBuyer, sheetBuyer) {
        const mismatches = [];
        // Fields to compare (excluding system fields)
        const fieldsToCompare = [
            'buyer_number',
            'name',
            'name_kana',
            'email',
            'phone',
            'address',
            'inquiry_source',
            'inquiry_date',
            'property_type',
            'budget_min',
            'budget_max',
            'desired_area',
            'notes',
        ];
        for (const field of fieldsToCompare) {
            const dbValue = dbBuyer[field];
            const sheetValue = sheetBuyer[field];
            // Normalize values for comparison
            const normalizedDbValue = this.normalizeValue(dbValue);
            const normalizedSheetValue = this.normalizeValue(sheetValue);
            if (normalizedDbValue !== normalizedSheetValue) {
                mismatches.push({
                    field,
                    databaseValue: dbValue,
                    spreadsheetValue: sheetValue,
                });
            }
        }
        return mismatches;
    }
    /**
     * Normalize value for comparison
     * @param value Value to normalize
     * @returns Normalized value
     */
    normalizeValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).trim();
    }
    /**
     * Verify all buyers
     * @returns Summary of verification results
     */
    async verifyAllBuyers() {
        console.log('Verifying all buyers...');
        // Get all buyers from database
        const { data: dbBuyers, error: dbError } = await this.supabase
            .from('buyers')
            .select('buyer_number');
        if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
        }
        const dbBuyerNumbers = new Set(dbBuyers?.map(b => b.buyer_number) || []);
        // Get all buyers from spreadsheet
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../../google-service-account.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!1:1`,
        });
        const headers = headerResponse.data.values?.[0] || [];
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A2:GZ`,
        });
        const rows = dataResponse.data.values || [];
        const sheetBuyerNumbers = new Set();
        for (const row of rows) {
            const data = this.columnMapper.mapSpreadsheetToDatabase(headers, row);
            if (data.buyer_number && String(data.buyer_number).trim() !== '') {
                sheetBuyerNumbers.add(data.buyer_number);
            }
        }
        // Calculate statistics
        const total = sheetBuyerNumbers.size;
        let matched = 0;
        let mismatched = 0;
        let missingInDb = 0;
        for (const buyerNumber of sheetBuyerNumbers) {
            if (dbBuyerNumbers.has(buyerNumber)) {
                matched++;
            }
            else {
                missingInDb++;
            }
        }
        const missingInSheet = dbBuyerNumbers.size - matched;
        return {
            total,
            matched,
            mismatched,
            missingInDb,
            missingInSheet,
        };
    }
}
exports.BuyerVerificationService = BuyerVerificationService;
