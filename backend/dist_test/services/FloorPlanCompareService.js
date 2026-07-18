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
exports.FloorPlanCompareService = void 0;
const GoogleDriveService_1 = require("./GoogleDriveService");
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const openai_1 = __importDefault(require("openai"));
class FloorPlanCompareService {
    constructor() {
        this.driveService = new GoogleDriveService_1.GoogleDriveService();
        this.openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        this.sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || '';
        this.initializeSheetsAuth();
    }
    /**
     * Google Sheets / Drive 用のサービスアカウント認証を初期化
     */
    initializeSheetsAuth() {
        try {
            let keyFile;
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                if (keyFile.private_key) {
                    keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
                }
            }
            else {
                const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
                const absolutePath = path.resolve(__dirname, '../../', keyPath);
                if (!fs.existsSync(absolutePath)) {
                    console.warn('⚠️ Service account key file not found for Sheets');
                    return;
                }
                keyFile = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
            }
            this.sheetsAuth = new googleapis_1.google.auth.GoogleAuth({
                credentials: keyFile,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive',
                ],
            });
        }
        catch (error) {
            console.error('❌ Failed to initialize Sheets auth:', error.message);
        }
    }
    /**
     * storage_url（Google DriveフォルダURL）からフォルダIDを抽出
     */
    extractFolderIdFromUrl(storageUrl) {
        const match = storageUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }
    // ============================================================
    // STEP 1: スプシをドライブに作成する（業務詳細ボタンから呼ぶ）
    // ============================================================
    /**
     * 格納先フォルダに「間取図比較チェック」スプシを作成する。
     * 既存のスプシがあればそのURLを返す（重複作成しない）。
     * ※ GAS埋め込みは行わない。比較実行は業務詳細画面のボタンから行う。
     */
    async createSpreadsheet(storageUrl, propertyNumber) {
        if (!this.sheetsAuth) {
            throw new Error('Google Sheets認証が初期化されていません');
        }
        const folderId = this.extractFolderIdFromUrl(storageUrl);
        if (!folderId) {
            throw new Error('格納先URLからフォルダIDを取得できませんでした。URLを確認してください。');
        }
        const auth = await this.sheetsAuth.getClient();
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        const drive = googleapis_1.google.drive({ version: 'v3', auth });
        const spreadsheetTitle = `${FloorPlanCompareService.SPREADSHEET_TITLE_PREFIX}${propertyNumber}`;
        // 既存スプシを検索
        // 既存スプシが見つかった場合：マスタースプシが設定されていれば削除して作り直す
        // （GASメニューを確実に含めるため）
        let existingSpreadsheetId = null;
        try {
            const searchParams = {
                q: `'${folderId}' in parents and name = '${spreadsheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            };
            if (this.sharedDriveId) {
                searchParams.corpora = 'drive';
                searchParams.driveId = this.sharedDriveId;
            }
            const existing = await drive.files.list(searchParams);
            if (existing.data.files && existing.data.files.length > 0) {
                existingSpreadsheetId = existing.data.files[0].id;
                console.log(`📊 既存スプシ発見: ${existingSpreadsheetId}`);
            }
        }
        catch (err) {
            console.warn('既存スプシ検索エラー:', err.message);
        }
        const masterSpreadsheetId = process.env.FLOOR_PLAN_MASTER_SPREADSHEET_ID;
        // 既存スプシが見つかった場合はそのまま返す（削除・作り直しはしない）
        if (existingSpreadsheetId) {
            console.log(`📊 既存スプシを返します: ${existingSpreadsheetId}`);
            return {
                spreadsheetId: existingSpreadsheetId,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existingSpreadsheetId}`,
                isNew: false,
            };
        }
        if (masterSpreadsheetId) {
            // マスタースプシをコピーして対象フォルダに配置
            console.log(`📋 マスタースプシをコピー: ${masterSpreadsheetId} → フォルダ: ${folderId}`);
            let spreadsheetId;
            const copyRes = await drive.files.copy({ fileId: masterSpreadsheetId,
                requestBody: {
                    name: spreadsheetTitle,
                    parents: [folderId],
                },
                fields: 'id',
                supportsAllDrives: true,
            });
            spreadsheetId = copyRes.data.id;
            console.log(`📊 マスタースプシコピー完了: ${spreadsheetId}`);
            // 物件番号・フォルダIDをシートに書き込む
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: '比較結果!B2:B3',
                valueInputOption: 'RAW',
                requestBody: { values: [[propertyNumber], [folderId]] },
            });
            return {
                spreadsheetId,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
                isNew: true,
            };
        }
        // マスタースプシなし → 空のスプシを直接作成
        console.log(`📊 マスタースプシ未設定のため空スプシを作成`);
        let spreadsheetId;
        const driveCreateRes = await drive.files.create({
            requestBody: {
                name: spreadsheetTitle,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                parents: [folderId],
            },
            fields: 'id',
            supportsAllDrives: true,
        });
        spreadsheetId = driveCreateRes.data.id;
        console.log(`📊 スプシ作成完了（フォルダ直接配置）: ${spreadsheetId}`);
        // シート名を「シート1」→「比較結果」に変更
        const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const firstSheetId = spreadsheetInfo.data.sheets?.[0]?.properties?.sheetId ?? 0;
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: { sheetId: firstSheetId, title: '比較結果' },
                            fields: 'title',
                        },
                    },
                ],
            },
        });
        // 初期コンテンツを書き込む
        const initialValues = [
            ['間取図比較チェックシート'],
            ['物件番号', propertyNumber],
            ['フォルダID', folderId],
            [''],
            ['▼ 使い方'],
            ['1. 掲載用図面（カラー）がドライブフォルダに格納されたことを確認する'],
            ['2. 業務詳細画面の「比較を実行」ボタンを押す'],
            ['3. しばらく待つと下に比較結果が表示される（30秒〜2分程度）'],
            [''],
            ['【比較結果】'],
            ['（まだ実行されていません）'],
        ];
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: '比較結果!A1',
            valueInputOption: 'RAW',
            requestBody: { values: initialValues },
        });
        // 書式設定
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        // タイトル行：青背景・白太字
                        repeatCell: {
                            range: { sheetId: firstSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                                    textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 1, green: 1, blue: 1 } },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)',
                        },
                    },
                    {
                        // 使い方セクション：薄黄色背景
                        repeatCell: {
                            range: { sheetId: firstSheetId, startRowIndex: 4, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 3 },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 1.0, green: 0.98, blue: 0.8 },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor)',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: { sheetId: firstSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 3 },
                        },
                    },
                ],
            },
        });
        // GASスクリプトをスプシに埋め込む（不要のため削除）
        console.log(`📊 新規スプシ作成完了: ${spreadsheetId}`);
        return {
            spreadsheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            isNew: true,
        };
    }
    // ============================================================
    // STEP 2: AI比較を実行してスプシに書き込む（業務詳細画面から呼ぶ）
    // ============================================================
    /**
     * フォルダ内のファイルを元図面・掲載用図面に分類する
     */
    async classifyFloorPlanFiles(folderId) {
        const allFiles = await this.driveService.listFiles(folderId);
        const targetMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
        ];
        const floorPlanFiles = allFiles.filter(f => targetMimeTypes.includes(f.mimeType.toLowerCase()));
        if (floorPlanFiles.length === 0) {
            throw new Error('フォルダ内にPDF・画像ファイルが見つかりませんでした');
        }
        if (floorPlanFiles.length < 2) {
            throw new Error('比較するには元図面と掲載用図面の2種類以上のファイルが必要です');
        }
        const classified = [];
        for (const file of floorPlanFiles) {
            try {
                const isOriginal = await this.classifyFileAsOriginal(file.id, file.mimeType, file.name);
                classified.push({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    isOriginal,
                });
            }
            catch (err) {
                console.warn(`⚠️ ファイル分類スキップ: ${file.name} - ${err.message}`);
            }
        }
        return classified;
    }
    /**
     * ファイルが元図面かどうかをAIで判定
     * 元図面: 白黒・手書き・シンプルなCAD
     * 掲載用: カラー・部屋に色付き・整形済み
     */
    async classifyFileAsOriginal(fileId, mimeType, fileName) {
        const imageBase64 = await this.getFileAsBase64(fileId, mimeType);
        if (!imageBase64) {
            // PDFはファイル名で推測
            const lowerName = fileName.toLowerCase();
            if (lowerName.includes('original') || lowerName.includes('元') || lowerName.includes('手書き'))
                return true;
            if (lowerName.includes('athome') || lowerName.includes('掲載') || lowerName.includes('カラー'))
                return false;
            return true;
        }
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 50,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'この画像は不動産の間取り図です。以下の基準で判定してください。\n「元図面」: 白黒、手書き、またはシンプルなCADデータ\n「掲載用図面」: カラー、部屋に色付き、整形済みのプロ仕様\n\n回答は「元図面」または「掲載用図面」の一言のみ。',
                        },
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
                        },
                    ],
                },
            ],
        });
        const answer = response.choices[0]?.message?.content?.trim() || '';
        return answer.includes('元図面');
    }
    /**
     * ファイルをBase64に変換（PDFはnullを返す）
     */
    async getFileAsBase64(fileId, mimeType) {
        try {
            if (mimeType === 'application/pdf')
                return null;
            const fileData = await this.driveService.getFile(fileId);
            if (!fileData)
                return null;
            return fileData.data.toString('base64');
        }
        catch (err) {
            console.warn(`⚠️ Base64変換失敗: ${fileId} - ${err.message}`);
            return null;
        }
    }
    /**
     * 元図面と掲載用図面をAIで比較して差異テキストを返す
     */
    async compareFloorPlans(originalFiles, publishedFiles) {
        const originalImages = [];
        for (const f of originalFiles) {
            const b64 = await this.getFileAsBase64(f.id, f.mimeType);
            if (b64)
                originalImages.push(b64);
        }
        const publishedImages = [];
        for (const f of publishedFiles) {
            const b64 = await this.getFileAsBase64(f.id, f.mimeType);
            if (b64)
                publishedImages.push(b64);
        }
        if (originalImages.length === 0 && publishedImages.length === 0) {
            return 'PDFファイルのみのため画像比較ができませんでした。ファイルを手動で確認してください。';
        }
        const contentParts = [
            {
                type: 'text',
                text: `不動産の間取り図を比較してください。

【元図面】と【掲載用図面（athome等掲載用）】を比較し、以下の項目について差異を洗い出してください。

## 確認項目
1. **部屋数** - 部屋の数が一致しているか
2. **洋室・和室の違い** - 洋室/和室の種別が正しいか
3. **各部屋の面積** - 面積表記の違い
4. **窓の数・位置** - 窓の数と配置が一致しているか
5. **扉の数・位置** - 扉（ドア）の数と配置が一致しているか
6. **収納** - 収納・WIC・押入れ・納戸の有無と位置
7. **水回り** - キッチン・浴室・トイレ・洗面の位置
8. **方位** - 方位（N方向）が一致しているか
9. **玄関位置** - 玄関の位置が一致しているか
10. **階段位置** - 階段の位置（2F建ての場合）

## 出力形式
各項目について「✅ 一致」または「⚠️ 差異あり: [内容]」で回答してください。
最後に「## 総評」として全体的な評価を記載してください。`,
            },
        ];
        if (originalImages.length > 0) {
            contentParts.push({ type: 'text', text: '## 元図面' });
            for (const img of originalImages) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'high' },
                });
            }
        }
        else {
            contentParts.push({ type: 'text', text: '## 元図面\n（PDFのため画像取得不可）' });
        }
        if (publishedImages.length > 0) {
            contentParts.push({ type: 'text', text: '## 掲載用図面（athome等掲載用）' });
            for (const img of publishedImages) {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'high' },
                });
            }
        }
        else {
            contentParts.push({ type: 'text', text: '## 掲載用図面（athome等掲載用）\n（PDFのため画像取得不可）' });
        }
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2000,
            messages: [{ role: 'user', content: contentParts }],
        });
        return response.choices[0]?.message?.content || '比較結果を取得できませんでした';
    }
    /**
     * 比較結果をスプシに書き込む（GASボタンから呼ばれるAPIで使用）
     */
    async writeCompareResultToSpreadsheet(spreadsheetId, propertyNumber, originalFiles, publishedFiles, compareResult) {
        if (!this.sheetsAuth) {
            throw new Error('Google Sheets認証が初期化されていません');
        }
        const auth = await this.sheetsAuth.getClient();
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
        const originalNames = originalFiles.map(f => f.name).join('\n') || '（なし）';
        const publishedNames = publishedFiles.map(f => f.name).join('\n') || '（なし）';
        const resultLines = compareResult.split('\n');
        const values = [
            ['間取図比較チェックシート'],
            ['物件番号', propertyNumber],
            ['実行日時', dateStr],
            [''],
            ['【元図面ファイル】'],
            [originalNames],
            [''],
            ['【掲載用図面ファイル】'],
            [publishedNames],
            [''],
            ['【比較結果】'],
            ...resultLines.map(line => [line]),
        ];
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: '比較結果!A1:Z1000',
        });
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: '比較結果!A1',
            valueInputOption: 'RAW',
            requestBody: { values },
        });
        // 書式設定
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                                    textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 1, green: 1, blue: 1 } },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 2 },
                        },
                    },
                ],
            },
        });
    }
    /**
     * GASボタンから呼ばれるメイン比較処理
     * フォルダIDとスプシIDを受け取り、比較してスプシに書き込む
     */
    async runCompare(req) {
        const { spreadsheetId, folderId, propertyNumber } = req;
        console.log(`🔍 [FloorPlanCompare] 比較開始: ${propertyNumber}, フォルダ: ${folderId}`);
        const classifiedFiles = await this.classifyFloorPlanFiles(folderId);
        const originalFiles = classifiedFiles.filter(f => f.isOriginal);
        const publishedFiles = classifiedFiles.filter(f => !f.isOriginal);
        console.log(`📄 元図面: ${originalFiles.length}件, 掲載用: ${publishedFiles.length}件`);
        if (originalFiles.length === 0) {
            throw new Error('元図面が見つかりませんでした。フォルダ内のファイルを確認してください。');
        }
        if (publishedFiles.length === 0) {
            throw new Error('掲載用図面（カラー）が見つかりませんでした。掲載用図面がフォルダに格納されているか確認してください。');
        }
        const compareResult = await this.compareFloorPlans(originalFiles, publishedFiles);
        await this.writeCompareResultToSpreadsheet(spreadsheetId, propertyNumber, originalFiles, publishedFiles, compareResult);
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        return {
            spreadsheetUrl,
            summary: compareResult.substring(0, 200) + (compareResult.length > 200 ? '...' : ''),
        };
    }
}
exports.FloorPlanCompareService = FloorPlanCompareService;
// スプシ名の定数
FloorPlanCompareService.SPREADSHEET_TITLE_PREFIX = '間取図比較チェック_';
// GASが呼ぶAPIエンドポイントのパス
FloorPlanCompareService.COMPARE_API_PATH = '/api/work-tasks/floor-plan-compare-run';
