import { GoogleDriveService } from './GoogleDriveService';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

export interface FloorPlanFile {
  id: string;
  name: string;
  mimeType: string;
  isOriginal: boolean; // true=元図面, false=掲載用図面
}

export interface CreateSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  isNew: boolean;
}

export interface CompareResult {
  spreadsheetUrl: string;
  summary: string;
}

// GASからバックエンドAPIを呼ぶ際に使用するCRON_SECRET認証
// スプシIDとフォルダIDをAPIに渡す
export interface CompareRequest {
  spreadsheetId: string;
  folderId: string;
  propertyNumber: string;
}

export class FloorPlanCompareService {
  private driveService: GoogleDriveService;
  private openai: OpenAI;
  private sheetsAuth: any;
  private sharedDriveId: string;

  // スプシ名の定数
  static readonly SPREADSHEET_TITLE_PREFIX = '間取図比較チェック_';
  // GASが呼ぶAPIエンドポイントのパス
  static readonly COMPARE_API_PATH = '/api/work-tasks/floor-plan-compare-run';

  constructor() {
    this.driveService = new GoogleDriveService();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID || '';
    this.initializeSheetsAuth();
  }

  /**
   * Google Sheets / Drive 用のサービスアカウント認証を初期化
   */
  private initializeSheetsAuth() {
    try {
      let keyFile: any;

      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        if (keyFile.private_key) {
          keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
        }
      } else {
        const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
        const absolutePath = path.resolve(__dirname, '../../', keyPath);
        if (!fs.existsSync(absolutePath)) {
          console.warn('⚠️ Service account key file not found for Sheets');
          return;
        }
        keyFile = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      }

      this.sheetsAuth = new google.auth.GoogleAuth({
        credentials: keyFile,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ],
      });
    } catch (error: any) {
      console.error('❌ Failed to initialize Sheets auth:', error.message);
    }
  }

  /**
   * storage_url（Google DriveフォルダURL）からフォルダIDを抽出
   */
  extractFolderIdFromUrl(storageUrl: string): string | null {
    const match = storageUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // ============================================================
  // STEP 1: スプシをドライブに作成する（業務詳細ボタンから呼ぶ）
  // ============================================================

  /**
   * 格納先フォルダに「間取図比較チェック」スプシを作成する。
   * 既存のスプシがあればそのURLを返す（重複作成しない）。
   * スプシにはGASボタンを埋め込み、押すとバックエンドAPIを呼んで比較を実行する。
   */
  async createSpreadsheet(storageUrl: string, propertyNumber: string): Promise<CreateSpreadsheetResult> {
    if (!this.sheetsAuth) {
      throw new Error('Google Sheets認証が初期化されていません');
    }

    const folderId = this.extractFolderIdFromUrl(storageUrl);
    if (!folderId) {
      throw new Error('格納先URLからフォルダIDを取得できませんでした。URLを確認してください。');
    }

    const auth = await this.sheetsAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const spreadsheetTitle = `${FloorPlanCompareService.SPREADSHEET_TITLE_PREFIX}${propertyNumber}`;

    // 既存スプシを検索（重複作成防止）
    let spreadsheetId: string | null = null;
    try {
      const searchParams: any = {
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
        spreadsheetId = existing.data.files[0].id!;
        console.log(`📊 既存スプシ発見: ${spreadsheetId}`);
        return {
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          isNew: false,
        };
      }
    } catch (err: any) {
      console.warn('既存スプシ検索エラー:', err.message);
    }

    // 新規スプシ作成
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: spreadsheetTitle },
        sheets: [{ properties: { title: '比較結果', sheetId: 0 } }],
      },
    });
    spreadsheetId = created.data.spreadsheetId!;

    // 対象フォルダに移動（マイドライブから）
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: 'root',
      supportsAllDrives: true,
      fields: 'id, parents',
    });

    // 初期コンテンツを書き込む
    const backendUrl = process.env.BACKEND_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://sateituikyaku-admin-backend.vercel.app';

    const gasCode = this.buildGasCode(spreadsheetId, folderId, propertyNumber, backendUrl);

    const initialValues: any[][] = [
      ['間取図比較チェックシート'],
      ['物件番号', propertyNumber],
      ['フォルダID', folderId],
      [''],
      ['▼ 使い方'],
      ['1. 掲載用図面（カラー）がドライブフォルダに格納されたことを確認する'],
      ['2. 上のメニュー「間取図比較」→「▶ 比較を実行する」をクリックする'],
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
            // 使い方セクション：薄黄色背景
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 4, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 3 },
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
              dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 3 },
            },
          },
        ],
      },
    });

    // GASスクリプトをスプシに埋め込む
    await this.attachGasScript(spreadsheetId, gasCode, auth);

    console.log(`📊 新規スプシ作成完了: ${spreadsheetId}`);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      isNew: true,
    };
  }

  /**
   * スプシに埋め込むGASコードを生成する
   * GASはバックエンドAPIを呼んで比較を実行する
   */
  private buildGasCode(
    spreadsheetId: string,
    folderId: string,
    propertyNumber: string,
    backendUrl: string
  ): string {
    const apiUrl = `${backendUrl}/api/work-tasks/floor-plan-compare-run`;
    const cronSecret = process.env.CRON_SECRET || '';

    return `
// 間取図比較チェック GAS
// このスクリプトはバックエンドAPIを呼んでAI比較を実行します

var SPREADSHEET_ID = "${spreadsheetId}";
var FOLDER_ID = "${folderId}";
var PROPERTY_NUMBER = "${propertyNumber}";
var API_URL = "${apiUrl}";
var API_SECRET = "${cronSecret}";

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('間取図比較')
    .addItem('▶ 比較を実行する', 'runCompare')
    .addToUi();
}

function runCompare() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '間取図比較を実行しますか？',
    'フォルダ内の元図面と掲載用図面をAIで比較します。\\n30秒〜2分程度かかります。',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('比較結果');
  if (!sheet) {
    ui.alert('エラー', '「比較結果」シートが見つかりません', ui.ButtonSet.OK);
    return;
  }

  // 実行中メッセージを表示
  sheet.getRange('A11').setValue('⏳ AI分析中です... しばらくお待ちください');

  try {
    var payload = JSON.stringify({
      spreadsheetId: SPREADSHEET_ID,
      folderId: FOLDER_ID,
      propertyNumber: PROPERTY_NUMBER
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      headers: { 'Authorization': 'Bearer ' + API_SECRET },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(API_URL, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (statusCode !== 200) {
      sheet.getRange('A11').setValue('❌ エラーが発生しました: ' + responseText);
      ui.alert('エラー', 'API呼び出しに失敗しました。\\n' + responseText, ui.ButtonSet.OK);
      return;
    }

    var data = JSON.parse(responseText);
    if (data.success) {
      ui.alert('完了', '比較が完了しました。シートを確認してください。', ui.ButtonSet.OK);
    } else {
      sheet.getRange('A11').setValue('❌ エラー: ' + (data.error || '不明なエラー'));
      ui.alert('エラー', data.error || '不明なエラーが発生しました', ui.ButtonSet.OK);
    }
  } catch (e) {
    sheet.getRange('A11').setValue('❌ 通信エラー: ' + e.toString());
    ui.alert('エラー', '通信エラーが発生しました: ' + e.toString(), ui.ButtonSet.OK);
  }
}
`.trim();
  }

  /**
   * Google Apps Script APIを使ってスプシにGASを埋め込む
   */
  private async attachGasScript(spreadsheetId: string, gasCode: string, auth: any): Promise<void> {
    try {
      const script = google.script({ version: 'v1', auth });

      // 既存プロジェクトを検索（スプシにバインドされたプロジェクト）
      // Apps Script APIでスプシにバインドされたプロジェクトを作成
      const project = await script.projects.create({
        requestBody: {
          title: '間取図比較チェック',
          parentId: spreadsheetId,
        },
      });

      const scriptId = project.data.scriptId!;

      // GASコードをアップロード
      await script.projects.updateContent({
        scriptId,
        requestBody: {
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: gasCode,
            },
            {
              name: 'appsscript',
              type: 'JSON',
              source: JSON.stringify({
                timeZone: 'Asia/Tokyo',
                dependencies: {},
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
                oauthScopes: [
                  'https://www.googleapis.com/auth/spreadsheets',
                  'https://www.googleapis.com/auth/script.external_request',
                ],
              }),
            },
          ],
        },
      });

      console.log(`✅ GASスクリプト埋め込み完了: ${scriptId}`);
    } catch (err: any) {
      // GAS埋め込みに失敗してもスプシ自体は作成済みなので警告のみ
      console.warn(`⚠️ GASスクリプト埋め込み失敗（手動でGASを設定してください）: ${err.message}`);
    }
  }

  // ============================================================
  // STEP 2: AI比較を実行してスプシに書き込む（GASボタンから呼ぶ）
  // ============================================================

  /**
   * フォルダ内のファイルを元図面・掲載用図面に分類する
   */
  async classifyFloorPlanFiles(folderId: string): Promise<FloorPlanFile[]> {
    const allFiles = await this.driveService.listFiles(folderId);

    const targetMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];

    const floorPlanFiles = allFiles.filter(f =>
      targetMimeTypes.includes(f.mimeType.toLowerCase())
    );

    if (floorPlanFiles.length === 0) {
      throw new Error('フォルダ内にPDF・画像ファイルが見つかりませんでした');
    }
    if (floorPlanFiles.length < 2) {
      throw new Error('比較するには元図面と掲載用図面の2種類以上のファイルが必要です');
    }

    const classified: FloorPlanFile[] = [];

    for (const file of floorPlanFiles) {
      try {
        const isOriginal = await this.classifyFileAsOriginal(file.id, file.mimeType, file.name);
        classified.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          isOriginal,
        });
      } catch (err: any) {
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
  private async classifyFileAsOriginal(fileId: string, mimeType: string, fileName: string): Promise<boolean> {
    const imageBase64 = await this.getFileAsBase64(fileId, mimeType);
    if (!imageBase64) {
      // PDFはファイル名で推測
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes('original') || lowerName.includes('元') || lowerName.includes('手書き')) return true;
      if (lowerName.includes('athome') || lowerName.includes('掲載') || lowerName.includes('カラー')) return false;
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
  private async getFileAsBase64(fileId: string, mimeType: string): Promise<string | null> {
    try {
      if (mimeType === 'application/pdf') return null;
      const fileData = await this.driveService.getFile(fileId);
      if (!fileData) return null;
      return fileData.data.toString('base64');
    } catch (err: any) {
      console.warn(`⚠️ Base64変換失敗: ${fileId} - ${err.message}`);
      return null;
    }
  }

  /**
   * 元図面と掲載用図面をAIで比較して差異テキストを返す
   */
  async compareFloorPlans(
    originalFiles: FloorPlanFile[],
    publishedFiles: FloorPlanFile[]
  ): Promise<string> {
    const originalImages: string[] = [];
    for (const f of originalFiles) {
      const b64 = await this.getFileAsBase64(f.id, f.mimeType);
      if (b64) originalImages.push(b64);
    }

    const publishedImages: string[] = [];
    for (const f of publishedFiles) {
      const b64 = await this.getFileAsBase64(f.id, f.mimeType);
      if (b64) publishedImages.push(b64);
    }

    if (originalImages.length === 0 && publishedImages.length === 0) {
      return 'PDFファイルのみのため画像比較ができませんでした。ファイルを手動で確認してください。';
    }

    const contentParts: any[] = [
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
    } else {
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
    } else {
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
  async writeCompareResultToSpreadsheet(
    spreadsheetId: string,
    propertyNumber: string,
    originalFiles: FloorPlanFile[],
    publishedFiles: FloorPlanFile[],
    compareResult: string
  ): Promise<void> {
    if (!this.sheetsAuth) {
      throw new Error('Google Sheets認証が初期化されていません');
    }

    const auth = await this.sheetsAuth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

    const originalNames = originalFiles.map(f => f.name).join('\n') || '（なし）';
    const publishedNames = publishedFiles.map(f => f.name).join('\n') || '（なし）';
    const resultLines = compareResult.split('\n');

    const values: any[][] = [
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
  async runCompare(req: CompareRequest): Promise<CompareResult> {
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

    await this.writeCompareResultToSpreadsheet(
      spreadsheetId,
      propertyNumber,
      originalFiles,
      publishedFiles,
      compareResult
    );

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return {
      spreadsheetUrl,
      summary: compareResult.substring(0, 200) + (compareResult.length > 200 ? '...' : ''),
    };
  }
}
