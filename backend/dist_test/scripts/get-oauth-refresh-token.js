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
const googleapis_1 = require("googleapis");
const readline = __importStar(require("readline"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// .envファイルのパスを明示的に指定
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
/**
 * OAuth 2.0リフレッシュトークン取得スクリプト
 *
 * 使用方法:
 * 1. Google Cloud ConsoleでOAuth 2.0クライアントIDを作成
 * 2. CLIENT_IDとCLIENT_SECRETを設定
 * 3. このスクリプトを実行: npx ts-node src/scripts/get-oauth-refresh-token.ts
 * 4. ブラウザで認証URLを開く
 * 5. 認証後、リダイレクトURLからcodeパラメータをコピー
 * 6. コードを入力してリフレッシュトークンを取得
 */
// Google Cloud Consoleから取得した認証情報を設定
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/api/google/callback';
const oauth2Client = new googleapis_1.google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
// 認証URLを生成
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // リフレッシュトークンを取得するために必要
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent', // 毎回同意画面を表示（リフレッシュトークン取得のため）
});
console.log('='.repeat(80));
console.log('Google Sheets OAuth 2.0 リフレッシュトークン取得');
console.log('='.repeat(80));
console.log();
console.log('手順:');
console.log('1. 以下のURLをブラウザで開いてください:');
console.log();
console.log(authUrl);
console.log();
console.log('2. Googleアカウントでログインし、アクセスを許可してください');
console.log('3. リダイレクト後のURLから "code" パラメータの値をコピーしてください');
console.log('   例: http://localhost:3000/api/google/callback?code=XXXXX');
console.log('   → XXXXX の部分をコピー');
console.log();
console.log('='.repeat(80));
console.log();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.question('認証コードを入力してください: ', async (code) => {
    try {
        // 認証コードをトークンに交換
        const { tokens } = await oauth2Client.getToken(code);
        console.log();
        console.log('='.repeat(80));
        console.log('✅ リフレッシュトークンの取得に成功しました！');
        console.log('='.repeat(80));
        console.log();
        console.log('以下の情報を backend/.env ファイルに追加してください:');
        console.log();
        console.log('# Google Sheets OAuth 2.0 Configuration');
        console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log();
        console.log('='.repeat(80));
        console.log();
        console.log('注意: リフレッシュトークンは一度しか表示されません。');
        console.log('      安全な場所に保管してください。');
        console.log();
    }
    catch (error) {
        console.error();
        console.error('❌ エラーが発生しました:', error.message);
        console.error();
        console.error('トラブルシューティング:');
        console.error('- 認証コードが正しいか確認してください');
        console.error('- 認証コードは一度しか使用できません（再度認証URLを開いてください）');
        console.error('- CLIENT_IDとCLIENT_SECRETが正しいか確認してください');
        console.error();
    }
    finally {
        rl.close();
    }
});
