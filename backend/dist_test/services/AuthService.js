"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const redis_1 = __importDefault(require("../config/redis"));
const BaseRepository_1 = require("../repositories/BaseRepository");
const types_1 = require("../types");
class AuthService extends BaseRepository_1.BaseRepository {
    constructor() {
        super();
        this.SESSION_PREFIX = 'session:';
        this.JWT_SECRET = process.env.SESSION_SECRET || 'default-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    }
    /**
     * Google OAuth認証後の処理
     * @param googleProfile Googleプロフィール情報
     * @returns 認証結果
     */
    async loginWithGoogle(googleProfile) {
        // 既存の社員を検索（google_idまたはemailで）
        const { data: existingEmployees, error: searchError } = await this.supabase
            .from('employees')
            .select('*')
            .or(`google_id.eq.${googleProfile.id},email.eq.${googleProfile.email}`)
            .limit(1);
        if (searchError) {
            throw new Error(`Failed to search employee: ${searchError.message}`);
        }
        let employee;
        // 初回ログインの場合、社員アカウントを作成
        if (!existingEmployees || existingEmployees.length === 0) {
            employee = await this.createEmployee(googleProfile);
        }
        else {
            employee = existingEmployees[0];
            // googleIdが未設定の場合は更新
            if (!employee.googleId && googleProfile.id) {
                const { error: updateError } = await this.supabase
                    .from('employees')
                    .update({ google_id: googleProfile.id })
                    .eq('id', employee.id);
                if (updateError) {
                    console.error('Failed to update google_id:', updateError);
                }
                else {
                    employee.googleId = googleProfile.id;
                }
            }
            // 最終ログイン日時を更新
            const { error: updateError } = await this.supabase
                .from('employees')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', employee.id);
            if (updateError) {
                console.error('Failed to update last login:', updateError);
            }
            employee.lastLoginAt = new Date();
        }
        // セッショントークンとリフレッシュトークンを生成
        const sessionToken = this.generateSessionToken(employee);
        const refreshToken = (0, uuid_1.v4)();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後
        // Redisにセッション情報を保存
        await this.saveSession(sessionToken, employee, refreshToken);
        return {
            employee,
            sessionToken,
            refreshToken,
            expiresAt,
        };
    }
    /**
     * 社員アカウントを作成
     * @param googleProfile Googleプロフィール情報
     * @returns 作成された社員情報
     */
    async createEmployee(googleProfile) {
        const { data, error } = await this.supabase
            .from('employees')
            .insert({
            google_id: googleProfile.id,
            email: googleProfile.email,
            name: googleProfile.name,
            role: types_1.EmployeeRole.AGENT,
            is_active: true,
            last_login_at: new Date().toISOString(),
        })
            .select()
            .single();
        if (error || !data) {
            throw new Error(`Failed to create employee: ${error?.message || 'Unknown error'}`);
        }
        return data;
    }
    /**
     * セッショントークンを生成
     * @param employee 社員情報
     * @returns JWTトークン
     */
    generateSessionToken(employee) {
        return jsonwebtoken_1.default.sign({
            employeeId: employee.id,
            email: employee.email,
            role: employee.role,
        }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    }
    /**
     * セッション情報をRedisに保存
     * @param sessionToken セッショントークン
     * @param employee 社員情報
     * @param refreshToken リフレッシュトークン
     */
    async saveSession(sessionToken, employee, refreshToken) {
        const sessionData = {
            employeeId: employee.id,
            email: employee.email,
            role: employee.role,
            refreshToken,
        };
        // 24時間のTTLでRedisに保存
        await redis_1.default.setEx(`${this.SESSION_PREFIX}${sessionToken}`, 24 * 60 * 60, JSON.stringify(sessionData));
    }
    /**
     * セッションを検証
     * @param sessionToken セッショントークン
     * @returns 社員情報
     */
    async validateSession(sessionToken) {
        try {
            // JWTトークンを検証
            const decoded = jsonwebtoken_1.default.verify(sessionToken, this.JWT_SECRET);
            // Redisからセッション情報を取得
            const sessionData = await redis_1.default.get(`${this.SESSION_PREFIX}${sessionToken}`);
            if (!sessionData) {
                throw new Error('Session not found or expired');
            }
            // データベースから最新の社員情報を取得
            const { data, error } = await this.supabase
                .from('employees')
                .select('*')
                .eq('id', decoded.employeeId)
                .eq('is_active', true)
                .single();
            if (error || !data) {
                throw new Error('Employee not found or inactive');
            }
            return data;
        }
        catch (error) {
            throw new Error('Invalid or expired session');
        }
    }
    /**
     * ログアウト
     * @param sessionToken セッショントークン
     */
    async logout(sessionToken) {
        // Redisからセッション情報を削除
        await redis_1.default.del(`${this.SESSION_PREFIX}${sessionToken}`);
    }
    /**
     * トークンをリフレッシュ
     * @param refreshToken リフレッシュトークン
     * @returns 新しい認証結果
     */
    async refreshToken(refreshToken) {
        // すべてのセッションを検索してリフレッシュトークンが一致するものを探す
        const keys = await redis_1.default.keys(`${this.SESSION_PREFIX}*`);
        for (const key of keys) {
            const sessionData = await redis_1.default.get(key);
            if (sessionData) {
                const data = JSON.parse(sessionData);
                if (data.refreshToken === refreshToken) {
                    // 社員情報を取得
                    const { data: employeeData, error } = await this.supabase
                        .from('employees')
                        .select('*')
                        .eq('id', data.employeeId)
                        .single();
                    if (error || !employeeData) {
                        throw new Error('Employee not found');
                    }
                    const employee = employeeData;
                    // 古いセッションを削除
                    await redis_1.default.del(key);
                    // 新しいセッションを作成
                    const newSessionToken = this.generateSessionToken(employee);
                    const newRefreshToken = (0, uuid_1.v4)();
                    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await this.saveSession(newSessionToken, employee, newRefreshToken);
                    return {
                        employee,
                        sessionToken: newSessionToken,
                        refreshToken: newRefreshToken,
                        expiresAt,
                    };
                }
            }
        }
        throw new Error('Invalid refresh token');
    }
}
exports.AuthService = AuthService;
