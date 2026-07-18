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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = exports.decryptFields = exports.encryptFields = exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// 環境変数から暗号化キーを取得
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        // 暗号化キーが設定されていない場合はnullを返す（暗号化なしモード）
        console.warn('⚠️ ENCRYPTION_KEY is not set, encryption/decryption will be skipped');
        return null;
    }
    if (key.length !== KEY_LENGTH) {
        throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters`);
    }
    return Buffer.from(key, 'utf-8');
};
/**
 * データを暗号化
 * @param text 暗号化するテキスト
 * @returns 暗号化されたデータ（Base64エンコード）
 */
const encrypt = (text) => {
    if (!text) {
        return '';
    }
    try {
        const key = getEncryptionKey();
        // 暗号化キーがない場合は平文を返す
        if (!key) {
            return text;
        }
        const iv = crypto_1.default.randomBytes(IV_LENGTH);
        const salt = crypto_1.default.randomBytes(SALT_LENGTH);
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        // iv + salt + tag + encrypted を結合してBase64エンコード
        const result = Buffer.concat([iv, salt, tag, Buffer.from(encrypted, 'hex')]);
        return result.toString('base64');
    }
    catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
};
exports.encrypt = encrypt;
/**
 * データを復号化
 * @param encryptedData 暗号化されたデータ（Base64エンコード）または平文
 * @returns 復号化されたテキスト
 */
const decrypt = (encryptedData) => {
    if (!encryptedData) {
        return '';
    }
    try {
        const key = getEncryptionKey();
        // 暗号化キーがない場合は平文として返す
        if (!key) {
            return encryptedData;
        }
        const buffer = Buffer.from(encryptedData, 'base64');
        // 暗号化されたデータの最小長をチェック（IV + SALT + TAG = 96バイト）
        const minEncryptedLength = IV_LENGTH + SALT_LENGTH + TAG_LENGTH;
        if (buffer.length < minEncryptedLength) {
            // データが短すぎる場合は平文として扱う
            console.warn('Data appears to be plaintext, returning as-is');
            return encryptedData;
        }
        // iv, salt, tag, encrypted を分離
        const iv = buffer.subarray(0, IV_LENGTH);
        // salt は将来の拡張用に保存されているが、現在は使用していない
        // const salt = buffer.subarray(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
        const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
        const encrypted = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        // 復号化に失敗した場合は平文として扱う
        console.warn('Decryption failed, treating as plaintext:', error);
        return encryptedData;
    }
};
exports.decrypt = decrypt;
/**
 * 複数のフィールドを暗号化
 * @param data オブジェクト
 * @param fields 暗号化するフィールド名の配列
 * @returns 暗号化されたオブジェクト
 */
const encryptFields = (data, fields) => {
    const result = { ...data };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = (0, exports.encrypt)(result[field]);
        }
    }
    return result;
};
exports.encryptFields = encryptFields;
/**
 * 複数のフィールドを復号化
 * @param data オブジェクト
 * @param fields 復号化するフィールド名の配列
 * @returns 復号化されたオブジェクト
 */
const decryptFields = (data, fields) => {
    const result = { ...data };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = (0, exports.decrypt)(result[field]);
        }
    }
    return result;
};
exports.decryptFields = decryptFields;
/**
 * パスワードをハッシュ化（bcrypt使用）
 * @param password プレーンテキストのパスワード
 * @returns ハッシュ化されたパスワード
 */
const hashPassword = async (password) => {
    const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
};
exports.hashPassword = hashPassword;
/**
 * パスワードを検証
 * @param password プレーンテキストのパスワード
 * @param hash ハッシュ化されたパスワード
 * @returns 一致する場合true
 */
const verifyPassword = async (password, hash) => {
    const bcrypt = await Promise.resolve().then(() => __importStar(require('bcrypt')));
    return bcrypt.compare(password, hash);
};
exports.verifyPassword = verifyPassword;
