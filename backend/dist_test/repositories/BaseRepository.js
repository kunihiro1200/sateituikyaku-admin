"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const supabase_1 = __importDefault(require("../config/supabase"));
class BaseRepository {
    constructor() {
        this.supabase = supabase_1.default;
    }
    /**
     * テーブルからデータを取得
     */
    table(tableName) {
        return this.supabase.from(tableName);
    }
    /**
     * 生SQLクエリを実行（必要な場合のみ）
     */
    async rpc(functionName, params) {
        const { data, error } = await this.supabase.rpc(functionName, params);
        if (error) {
            console.error('RPC error:', error);
            throw error;
        }
        return data;
    }
    /**
     * 生SQLクエリを実行して複数行を取得
     */
    async query(sql, params) {
        const { data, error } = await this.supabase.rpc('execute_sql', {
            query: sql,
            params: params || []
        });
        if (error) {
            console.error('Query error:', error);
            throw error;
        }
        return (data || []);
    }
    /**
     * 生SQLクエリを実行して1行を取得
     */
    async queryOne(sql, params) {
        const results = await this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }
}
exports.BaseRepository = BaseRepository;
