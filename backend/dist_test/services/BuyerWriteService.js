"use strict";
/**
 * BuyerWriteService - 買主データのスプレッドシートへの書き込みサービス
 *
 * DBの変更をスプレッドシートに書き戻す機能を提供します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerWriteService = void 0;
class BuyerWriteService {
    constructor(sheetsClient, columnMapper) {
        this.sheetsClient = sheetsClient;
        this.columnMapper = columnMapper;
    }
    /**
     * ヘッダーキャッシュをクリア
     */
    clearHeaderCache() {
        this.sheetsClient.clearHeaderCache();
    }
    /**
     * 買主番号でスプレッドシートの行番号を検索
     * @param buyerNumber 買主番号
     * @returns 行番号（1-indexed、ヘッダー行は1）、見つからない場合はnull
     */
    async findRowByBuyerNumber(buyerNumber) {
        // 買主番号のスプレッドシートカラム名を取得
        const spreadsheetColumnName = this.columnMapper.getSpreadsheetColumnName('buyer_number');
        if (!spreadsheetColumnName) {
            throw new Error('buyer_number column mapping not found');
        }
        return await this.sheetsClient.findRowByColumn(spreadsheetColumnName, buyerNumber);
    }
    /**
     * 単一フィールドをスプレッドシートに書き込み
     * @param buyerNumber 買主番号
     * @param dbFieldName DBフィールド名
     * @param value 新しい値
     * @returns 書き込み結果
     */
    async updateField(buyerNumber, dbFieldName, value) {
        try {
            // 行番号を検索
            const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
            if (!rowNumber) {
                return {
                    success: false,
                    error: `Buyer ${buyerNumber} not found in spreadsheet`
                };
            }
            // スプレッドシートのカラム名を取得
            const spreadsheetColumnName = this.columnMapper.getSpreadsheetColumnName(dbFieldName);
            if (!spreadsheetColumnName) {
                return {
                    success: false,
                    error: `Column mapping not found for field: ${dbFieldName}`
                };
            }
            // 現在の行データを取得
            const rows = await this.sheetsClient.readRange(`${rowNumber}:${rowNumber}`);
            if (rows.length === 0) {
                return {
                    success: false,
                    error: `Row ${rowNumber} not found`
                };
            }
            // 値を更新
            const rowData = rows[0];
            const formattedValue = this.columnMapper.mapDatabaseToSpreadsheet({ [dbFieldName]: value });
            rowData[spreadsheetColumnName] = formattedValue[spreadsheetColumnName] ?? '';
            // スプレッドシートに書き込み
            await this.sheetsClient.updateRow(rowNumber, rowData);
            return {
                success: true,
                rowNumber
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }
    /**
     * If inquiry_source is '2件目以降', force pinrich to '登録不要（不可）'
     */
    applySecondInquiryRule(data) {
        if (data.inquiry_source === '2件目以降') {
            return { ...data, pinrich: '登録不要（不可）' };
        }
        return data;
    }
    /**
     * 複数フィールドを一括でスプレッドシートに書き込み
     * @param buyerNumber 買主番号
     * @param updates 更新するフィールドと値のマップ
     * @returns 書き込み結果
     */
    async updateFields(buyerNumber, updates) {
        try {
            console.log(`[BuyerWriteService] updateFields called for buyer ${buyerNumber}`);
            console.log(`[BuyerWriteService] Updates:`, JSON.stringify(updates, null, 2));
            // Apply second inquiry rule before writing to spreadsheet
            updates = this.applySecondInquiryRule(updates);
            // スプレッドシートにマッピングが存在しないフィールドを除外
            const filteredUpdates = {};
            for (const [dbColumn, value] of Object.entries(updates)) {
                const spreadsheetColumn = this.columnMapper.getSpreadsheetColumnName(dbColumn);
                if (spreadsheetColumn) {
                    filteredUpdates[dbColumn] = value;
                }
                else {
                    console.log(`[BuyerWriteService] Skipping field without spreadsheet mapping: ${dbColumn}`);
                }
            }
            // マッピングが存在するフィールドがない場合は成功として扱う
            if (Object.keys(filteredUpdates).length === 0) {
                console.log(`[BuyerWriteService] No fields to sync to spreadsheet (all fields skipped)`);
                return {
                    success: true,
                    rowNumber: undefined
                };
            }
            // 行番号を検索
            const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
            if (!rowNumber) {
                console.error(`[BuyerWriteService] Buyer ${buyerNumber} not found in spreadsheet`);
                return {
                    success: false,
                    error: `Buyer ${buyerNumber} not found in spreadsheet`
                };
            }
            console.log(`[BuyerWriteService] Found buyer at row ${rowNumber}`);
            // 変更フィールドのみをスプシに書き込み（数式を壊さないよう部分更新）
            const formattedValues = this.columnMapper.mapDatabaseToSpreadsheet(filteredUpdates);
            console.log(`[BuyerWriteService] Formatted values for spreadsheet:`, JSON.stringify(formattedValues, null, 2));
            await this.sheetsClient.updateRowPartial(rowNumber, formattedValues);
            console.log(`[BuyerWriteService] Successfully updated row ${rowNumber}`);
            return {
                success: true,
                rowNumber
            };
        }
        catch (error) {
            console.error(`[BuyerWriteService] Error updating buyer ${buyerNumber}:`, error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }
    /**
     * 複数の買主データを一括更新
     * @param updates 買主番号と更新データのマップ
     * @returns バッチ書き込み結果
     */
    async batchUpdateFields(updates) {
        const results = [];
        let totalUpdated = 0;
        let totalFailed = 0;
        for (const [buyerNumber, fieldUpdates] of updates) {
            const result = await this.updateFields(buyerNumber, fieldUpdates);
            results.push(result);
            if (result.success) {
                totalUpdated++;
            }
            else {
                totalFailed++;
            }
        }
        return {
            success: totalFailed === 0,
            results,
            totalUpdated,
            totalFailed
        };
    }
    /**
     * スプレッドシートの現在値を取得
     * @param buyerNumber 買主番号
     * @param dbFieldName DBフィールド名
     * @returns 現在の値（見つからない場合はnull）
     */
    async getCurrentValue(buyerNumber, dbFieldName) {
        try {
            const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
            if (!rowNumber) {
                return null;
            }
            const spreadsheetColumnName = this.columnMapper.getSpreadsheetColumnName(dbFieldName);
            if (!spreadsheetColumnName) {
                return null;
            }
            const rows = await this.sheetsClient.readRange(`${rowNumber}:${rowNumber}`);
            if (rows.length === 0) {
                return null;
            }
            return rows[0][spreadsheetColumnName] ?? null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * スプレッドシートの行全体を取得
     * @param buyerNumber 買主番号
     * @returns 行データ（見つからない場合はnull）
     */
    async getRowData(buyerNumber) {
        try {
            const rowNumber = await this.findRowByBuyerNumber(buyerNumber);
            if (!rowNumber) {
                return null;
            }
            const rows = await this.sheetsClient.readRange(`${rowNumber}:${rowNumber}`);
            if (rows.length === 0) {
                return null;
            }
            return rows[0];
        }
        catch (error) {
            return null;
        }
    }
    /**
     * 新規買主をスプレッドシートに行追加
     * @param buyerData DBに保存された買主データ
     * @returns 書き込み結果
     */
    async appendNewBuyer(buyerData) {
        try {
            // Apply second inquiry rule before mapping to spreadsheet format
            buyerData = this.applySecondInquiryRule(buyerData);
            // DBデータをスプレッドシート形式に変換
            const spreadsheetRow = this.columnMapper.mapDatabaseToSpreadsheet(buyerData);
            // スプレッドシートに行を追加
            await this.sheetsClient.appendRow(spreadsheetRow);
            return {
                success: true,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error occurred',
            };
        }
    }
}
exports.BuyerWriteService = BuyerWriteService;
