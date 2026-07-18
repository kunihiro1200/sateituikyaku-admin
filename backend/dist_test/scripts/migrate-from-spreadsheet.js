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
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
const ColumnMapper_1 = require("../services/ColumnMapper");
const MigrationService_1 = require("../services/MigrationService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv_1.default.config();
/**
 * スプレッドシートからSupabaseへのデータ移行スクリプト
 *
 * 使用方法:
 * npx ts-node src/scripts/migrate-from-spreadsheet.ts [options]
 *
 * オプション:
 * --dry-run: 実際には挿入せず、処理のシミュレーションのみ行う
 * --batch-size=N: バッチサイズを指定（デフォルト: 100）
 * --skip-duplicates: 重複データをスキップ（デフォルト: true）
 */
async function main() {
    // コマンドライン引数を解析
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;
    const skipDuplicates = !args.includes('--no-skip-duplicates');
    console.log('📋 スプレッドシート → Supabase データ移行');
    console.log('='.repeat(60));
    console.log('');
    // 環境変数の確認
    const requiredEnvVars = [
        'GOOGLE_SHEETS_SPREADSHEET_ID',
        'GOOGLE_SHEETS_SHEET_NAME',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
    ];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        console.error('❌ 以下の環境変数が設定されていません:');
        missingVars.forEach(v => console.error(`   - ${v}`));
        console.error('\nbackend/.env ファイルを確認してください\n');
        process.exit(1);
    }
    // 認証方式の確認
    const hasServiceAccountFile = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    const hasServiceAccountEnv = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    const hasOAuth = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
    if (!hasServiceAccountFile && !hasServiceAccountEnv && !hasOAuth) {
        console.error('❌ 認証情報が設定されていません');
        console.error('   以下のいずれかを設定してください:');
        console.error('   - GOOGLE_SERVICE_ACCOUNT_KEY_PATH (JSONファイルのパス)');
        console.error('   - GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
        console.error('   - GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN\n');
        process.exit(1);
    }
    try {
        // Google Sheets クライアントを初期化
        console.log('🔧 Google Sheets クライアントを初期化中...');
        const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME,
            // Service Account JSON file (最優先)
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
            // Service Account credentials (環境変数)
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
            // OAuth 2.0 credentials (フォールバック)
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
        });
        await sheetsClient.authenticate();
        console.log('✅ 認証成功\n');
        // カラムマッパーを初期化
        const columnMapper = new ColumnMapper_1.ColumnMapper();
        // 移行サービスを初期化
        const migrationService = new MigrationService_1.MigrationService(sheetsClient, columnMapper, process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        // 移行を実行
        const result = await migrationService.migrateFromSpreadsheet({
            batchSize,
            skipDuplicates,
            dryRun,
        });
        // レポートを生成
        const report = migrationService.generateReport(result);
        console.log('\n' + report);
        // レポートをファイルに保存
        const reportDir = path.join(__dirname, '../../migration-reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportDir, `migration-${timestamp}.txt`);
        fs.writeFileSync(reportPath, report);
        console.log(`\n📄 レポートを保存しました: ${reportPath}\n`);
        // 終了コード
        if (result.failureCount > 0) {
            console.log('⚠️  一部のデータの移行に失敗しました');
            process.exit(1);
        }
        else {
            console.log('✅ すべてのデータの移行に成功しました');
            process.exit(0);
        }
    }
    catch (error) {
        console.error('\n❌ 移行中にエラーが発生しました:');
        console.error(error.message);
        if (error.stack) {
            console.error('\nスタックトレース:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}
// スクリプトを実行
main();
