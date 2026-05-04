import Anthropic from '@anthropic-ai/sdk';
import { GoogleDriveService } from './GoogleDriveService';
import { GoogleSheetsClient } from './GoogleSheetsClient';

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

export interface TokiExtractResult {
  // 所有者情報
  ownerAddress: string | null;       // A81
  ownerName: string | null;          // C81
  coOwners: string | null;           // B110（2番目以降の共有者情報）

  // 敷地権の目的である土地（複数対応）
  lands: Array<{
    location: string | null;         // A88以降
    lotNumber: string | null;        // C88以降
    landType: string | null;         // D88以降
    area: string | null;             // E88以降
  }>;

  // 一棟の建物の表示
  buildingName: string | null;       // A96
  buildingLocation: string | null;   // A98
  structure: string | null;          // A100
  roofType: string | null;           // C100
  floors: string | null;             // D100
  buildingArea: string | null;       // A102

  // 専有部分の建物の表示
  floorNumber: string | null;        // C96
  roomNumber: string | null;         // D96
  exclusiveArea: string | null;      // D102
  constructionDate: string | null;   // A104
}

export interface TokiWriteRequest {
  spreadsheetUrl: string;
  sheetName: string;
  extractResult: TokiExtractResult;
}

// -------------------------------------------------------
// 重説シート用の型定義（契約決済タブ）
// -------------------------------------------------------

export interface TokiKeiyakuExtractResult {
  // 謄本取得日
  acquisitionYearWareki: string | null;   // AB80: 令和年の数字のみ
  acquisitionMonth: string | null;        // AF80: 月
  acquisitionDay: string | null;          // AJ80: 日

  // 所有者情報
  ownerAddress: string | null;            // K35, V81, V94
  ownerNames: string | null;              // K36, B82, V95（代表住所と同じ住所の所有者全員、カンマ区切り）
  otherAddressOwnerCount: string | null;  // AX36: 別住所所有者数
  totalOwnerCount: string | null;         // BF36: 所有者総数
  ownerDetails: string | null;            // F54, F111: 全所有者の住所・氏名・共有持分＋「以下余白」

  // 敷地権の目的である土地（複数対応）
  lands: Array<{
    location: string | null;              // F63以降: 所在（地番除く）
    lotNumber: string | null;             // V63以降: 地番
    landType: string | null;              // AD63以降: 地目
    area: string | null;                  // AO63以降: 地積
    sikichikenType: string | null;        // AX63以降: 敷地権の種類
    sikichikenRatio: string | null;       // BE63以降: 敷地権の割合
  }>;

  // 一棟の建物の表示
  buildingName: string | null;            // K40
  buildingLocation: string | null;        // M44
  structure: string | null;              // M45: 構造部分のみ
  roofType: string | null;               // AK45: 屋根部分のみ
  floors: string | null;                 // Q46: 階数
  basementFloors: string | null;         // AC46: 地下階数（あれば）
  buildingArea: string | null;           // M47: 全階合計床面積

  // 専有部分の建物の表示
  floorNumber: string | null;            // AX40: 所在階
  roomNumber: string | null;             // BD40: 部屋番号
  exclusiveArea: string | null;          // AE52: 専有面積
  constructionDate: string | null;       // AS47: 新築日
  houseNumber: string | null;            // M48: 家屋番号
  buildingType: string | null;           // M49: 種類
  buildingStructure: string | null;      // M50: 構造（1階建除く）

  // 乙区・権利チェック
  hasMortgage: boolean;                  // K92, K109: 抵当権・根抵当権・賃借権
  hasOtherRights: boolean;               // K87: 所有権以外の権利
  rightChecks: Array<{                   // V89〜V92, V103〜V108
    cell: string;
    value: boolean;
  }>;
}

export interface TokiKeiyakuWriteRequest {
  spreadsheetUrl: string;
  sheetName: string;
  extractResult: TokiKeiyakuExtractResult;
}

// -------------------------------------------------------
// 戸建て用の型定義（媒介契約タブ）
// -------------------------------------------------------

export interface TokiKodateExtractResult {
  // 所有者情報（甲区）
  ownerAddress: string | null;       // A84（住所）
  ownerName: string | null;          // C84（氏名）
  coOwners: string | null;           // B112（2人目以降の共有者情報）

  // 土地情報（表題部：土地）複数対応
  lands: Array<{
    location: string | null;         // A91以降（所在）
    lotNumber: string | null;        // C91以降（地番）
    landType: string | null;         // D91以降（地目）
    area: string | null;             // E91以降（地積）
    areaNumeric: number | null;      // ソート用（書き込みには使わない）
  }>;

  // 私道共有チェック
  isPrivateRoadShared: boolean;      // F91（私道共有チェックボックス）

  // 主である建物の表示
  buildingLocation: string | null;   // A99（所在）
  houseNumber: string | null;        // C99（家屋番号）
  buildingType: string | null;       // D99（種類）

  // 附属建物
  annexBuildings: string | null;     // C101（附属建物の種類）

  // 構造
  structure: string | null;          // A103（構造）
  roofType: string | null;           // C103（屋根）
  floors: string | null;             // D103（階数）

  // 床面積
  floor1Area: string | null;         // C105（1階）
  floor2Area: string | null;         // D105（2階）

  // 日付
  registrationDate: string | null;   // A107（登記日）
  extensionDate: string | null;      // C107（増築日）
  renovationDate: string | null;     // D107（改築日）
}

export interface TokiKodateWriteRequest {
  spreadsheetUrl: string;
  sheetName: string;
  extractResult: TokiKodateExtractResult;
}

// -------------------------------------------------------
// 戸建て用「契約決済タブ」重説シート向けの型定義
// -------------------------------------------------------

export interface TokiKodateKeiyakuExtractResult {
  // 謄本取得日
  acquisitionYearWareki: string | null;   // AB89
  acquisitionMonth: string | null;        // AF80
  acquisitionDay: string | null;          // AJ80

  // 所有者情報
  ownerAddress: string | null;            // K36, V90, V104
  ownerNames: string | null;              // K37, V91, V105
  otherAddressOwnerCount: string | null;  // AX37
  totalOwnerCount: string | null;         // BF37
  ownerDetails: string | null;            // O85, F111

  // 土地情報（複数対応、面積降順）
  lands: Array<{
    location: string | null;              // H42, H44, H46... (2行おき)
    lotNumber: string | null;             // X42, X44, X46...
    landType: string | null;              // AG42, AG44, AG46...
    area: string | null;                  // AR42, AR44, AR46...
    areaNumeric: number | null;           // ソート用（書き込みには使わない）
  }>;

  // 共有持分チェック
  hasSharedOwnership: boolean;            // AY42

  // 主である建物の表示
  buildingLocation: string | null;        // O76
  houseNumber: string | null;             // AV76
  buildingType: string | null;            // O78
  annexBuildings: string | null;          // AZ77
  structure: string | null;              // O79
  roofType: string | null;               // AI79
  floors: string | null;                 // BC79
  floor1Area: string | null;             // R81
  floor2Area: string | null;             // AB81
  registrationDate: string | null;       // J84
  extensionDate: string | null;          // AE84
  renovationDate: string | null;         // AS84
  hasExtension: boolean;                 // Z84〜AA84
  hasRenovation: boolean;                // AN84〜AO84

  // 乙区・権利チェック
  hasOtherRights: boolean;               // P96
  hasMortgage: boolean;                  // P102, P110
  rightChecks96: string[];               // V98〜V102 に対応する権利名
  rightChecks110: string[];              // V112〜V115 に対応する権利名
}

export interface TokiKodateKeiyakuWriteRequest {
  spreadsheetUrl: string;
  sheetName: string;
  extractResult: TokiKodateKeiyakuExtractResult;
}

// -------------------------------------------------------
// 謄本解析サービス
// -------------------------------------------------------

/**
 * 面積などの数値文字列を正規化する
 * - 全角コロン「：」→ 小数点「.」変換（例：1465：68 → 1465.68）
 * - 全角数字 → 半角数字変換
 * - 単位（㎡など）や余分な空白を除去
 * - 数値として有効な文字列のみ返す（無効な場合は null）
 */
function normalizeNumericString(value: any): string | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  // 全角数字→半角
  s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // 全角コロン→小数点
  s = s.replace(/：/g, '.');
  // 単位・空白を除去
  s = s.replace(/[㎡\s　]/g, '');
  // 数値として有効か確認
  if (s === '' || isNaN(Number(s))) return null;
  return s;
}

export class TokiExtractService {
  private driveService: GoogleDriveService;

  constructor() {
    this.driveService = new GoogleDriveService();
  }

  /**
   * Google DriveフォルダURLから「全部事項」を含むPDFを検索してBase64で返す
   */
  async findTokiPdf(storageFolderUrl: string): Promise<{ base64: string; fileName: string } | null> {
    try {
      // URLからフォルダIDを抽出
      const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
      if (!folderId) {
        console.error('[TokiExtract] フォルダIDの抽出に失敗:', storageFolderUrl);
        return null;
      }

      console.log('[TokiExtract] フォルダ検索中:', folderId);

      // フォルダ内のファイル一覧を取得
      const files = await this.driveService.listFiles(folderId);

      // 「全部事項」を含むPDFを検索（「全部謄本（土地・建物）」も対象）
      const tokiFile = files.find(
        (f) =>
          (f.name.includes('全部事項') || f.name.includes('全部謄本')) &&
          (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      );

      if (!tokiFile) {
        console.warn('[TokiExtract] 「全部事項」を含むPDFが見つかりません。フォルダ内ファイル:', files.map((f) => f.name));
        return null;
      }

      console.log('[TokiExtract] 謄本PDF発見:', tokiFile.name);

      // PDFのバイナリデータを取得
      const fileData = await this.driveService.getFile(tokiFile.id);
      if (!fileData) {
        console.error('[TokiExtract] PDFデータの取得に失敗:', tokiFile.id);
        return null;
      }

      const base64 = fileData.data.toString('base64');
      return { base64, fileName: tokiFile.name };
    } catch (error: any) {
      console.error('[TokiExtract] PDF検索エラー:', error.message);
      throw error;
    }
  }

  /**
   * 契約決済タブ用：Google DriveフォルダURLから「建物_全部事項」を含むPDFを検索してBase64で返す
   */
  async findTokiPdfForKeiyaku(storageFolderUrl: string): Promise<{ base64: string; fileName: string } | null> {
    try {
      const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
      if (!folderId) {
        console.error('[TokiKeiyaku] フォルダIDの抽出に失敗:', storageFolderUrl);
        return null;
      }

      console.log('[TokiKeiyaku] フォルダ検索中:', folderId);

      const files = await this.driveService.listFiles(folderId);

      // 「建物_全部事項」を含むPDFを優先検索、なければ「全部事項」「全部謄本」を含むPDFにフォールバック
      let tokiFile = files.find(
        (f) =>
          f.name.includes('建物_全部事項') &&
          (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      );

      if (!tokiFile) {
        // フォールバック：「全部事項」または「全部謄本」を含むPDFを検索
        tokiFile = files.find(
          (f) =>
            (f.name.includes('全部事項') || f.name.includes('全部謄本')) &&
            (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        );
      }

      if (!tokiFile) {
        console.warn('[TokiKeiyaku] 「建物_全部事項」を含むPDFが見つかりません。フォルダ内ファイル:', files.map((f) => f.name));
        return null;
      }

      console.log('[TokiKeiyaku] 謄本PDF発見:', tokiFile.name);

      const fileData = await this.driveService.getFile(tokiFile.id);
      if (!fileData) {
        console.error('[TokiKeiyaku] PDFデータの取得に失敗:', tokiFile.id);
        return null;
      }

      const base64 = fileData.data.toString('base64');
      return { base64, fileName: tokiFile.name };
    } catch (error: any) {
      console.error('[TokiKeiyaku] PDF検索エラー:', error.message);
      throw error;
    }
  }

  /**
   * Claude APIを使って謄本PDFから情報を抽出する
   */
  async extractFromPdf(pdfBase64: string): Promise<TokiExtractResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY が設定されていません');
    }

    const client = new Anthropic({ apiKey });

    const prompt = `あなたは不動産登記簿謄本の専門家です。
添付された登記簿謄本（全部事項証明書）のPDFを読み取り、以下の情報をJSONで返してください。

【重要ルール】
- 全角スペース・半角スペース・改行の揺れを吸収して読み取ること
- 下線が引かれている情報は抹消事項として除外すること（抹消された登記は無視する）
- 抽出できない場合は null を返すこと
- 面積・地積の「：」は小数点「.」に変換すること（例：１６１５：６７ → 1615.67）
- 全角数字は半角数字に変換すること
- 和暦の日付は西暦に変換すること（例：平成21年2月26日 → 2009-02-26）
- 同じ項目が複数行ある場合は原則1行目を取得すること
- 推測せず、読み取れない場合は必ず null にすること

【抽出項目】

■ 所有者情報（権利部（甲区）（所有権に関する事項）から取得）
- 「登記の目的」が「所有権保存」または「所有権移転」の行を対象とする
- 移転が複数回ある場合は最新（最後）の所有者を取得する
- 下線あり（抹消）の行は除外する
- 「共有者」と書かれている場合は1番目の共有者の情報のみ owner_address・owner_name に入れる
- 2番目以降の共有者は co_owners にまとめて出力する（氏名・住所・持分を改行区切りで）
- 共有者がいない場合は co_owners は null

■ 敷地権の目的である土地（表題部（敷地権の目的である土地の表示）から取得）
- 「② 所在及び地番」欄から所在（地番を除いた部分）と地番を分けて取得する
  例：大分市中島東三丁目６４７５番１ → location: "大分市中島東三丁目", lot_number: "6475番1"
- 土地が複数行ある場合はlandsの配列に順番に格納する

■ 一棟の建物の表示（表題部（一棟の建物の表示）から取得）
- building_name: 「建物の名称」欄の値
- building_location: 「所在」欄の値
- structure: 「① 構造」欄から建物構造部分のみ（例：鉄骨鉄筋コンクリート造陸屋根14階建 → "鉄骨鉄筋コンクリート造"）
  対象：木造、土蔵造、石造、れんが造、コンクリートブロック造、鉄骨造、鉄筋コンクリート造、鉄骨鉄筋コンクリート造、木骨石造、木骨煉瓦造、軽量鉄骨造
- roof_type: 「① 構造」欄から屋根部分のみ（例：鉄骨鉄筋コンクリート造陸屋根14階建 → "陸屋根"）
  対象：瓦ぶき、スレートぶき、亜鉛メッキ鋼板ぶき、草ぶき、陸屋根、セメント瓦ぶき、アルミニュームぶき、板ぶき、杉皮ぶき、石板ぶき、銅板ぶき、ルーフィングぶき、ビニール板ぶき、合金メッキ鋼板ぶき
- floors: 「① 構造」欄から「〇階建」の数字のみ（例：14階建 → "14"）
- building_area: 「② 床面積 ㎡」欄に記載されている全階の面積を合計した値（「：」→「.」変換、全角→半角変換してから合計する）。例：1階202.05 + 2階20.43 + 3階〜13階580.64×11 + 14階591.76 = 7201.28 のように全階分を足し合わせること

■ 専有部分の建物の表示（表題部（専有部分の建物の表示）から取得）
- floor_number: 「③ 床面積 ㎡」欄の「〇階部分」から数字のみ（例：１０階部分 → "10"）
- room_number: まず「建物の名称」欄を確認し、数字のみなら半角で取得。数字以外が含まれる場合は「家屋番号」欄の末尾の連続した数字を取得（例：中島東三丁目 ６４７５番１の１００１ → "1001"）
- exclusive_area: 「③ 床面積 ㎡」欄の面積のみ（「：」→「.」変換、全角→半角変換）（例：１０階部分 ９８：９７ → "98.97"）
- construction_date: 「原因及びその日付〔登記の日付〕」欄の1行目の日付のみ（和暦→西暦変換）（例：平成21年2月26日新築 → "2009-02-26"）

【出力形式】
必ず以下のJSON形式のみで応答してください（説明文・コードブロック記号は不要）：

{
  "owner_address": null,
  "owner_name": null,
  "co_owners": null,
  "lands": [
    {
      "location": null,
      "lot_number": null,
      "land_type": null,
      "area": null
    }
  ],
  "building_name": null,
  "building_location": null,
  "structure": null,
  "roof_type": null,
  "floors": null,
  "building_area": null,
  "floor_number": null,
  "room_number": null,
  "exclusive_area": null,
  "construction_date": null
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            } as any,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    console.log('[TokiExtract] Claude response (first 500):', responseText.substring(0, 500));

    // JSONを抽出（コードブロックあり・なし両対応）
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (!jsonStr) {
      throw new Error('Claude APIからJSONを取得できませんでした');
    }

    let raw: any;
    try {
      raw = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`JSONパースエラー: ${jsonStr.substring(0, 200)}`);
    }

    // 型変換して返す
    return {
      ownerAddress: raw.owner_address ?? null,
      ownerName: raw.owner_name ?? null,
      coOwners: raw.co_owners ?? null,
      lands: Array.isArray(raw.lands)
        ? raw.lands.map((l: any) => ({
            location: l.location ?? null,
            lotNumber: l.lot_number ?? null,
            landType: l.land_type ?? null,
            area: l.area ?? null,
          }))
        : [],
      buildingName: raw.building_name ?? null,
      buildingLocation: raw.building_location ?? null,
      structure: raw.structure ?? null,
      roofType: raw.roof_type ?? null,
      floors: raw.floors ?? null,
      buildingArea: raw.building_area ?? null,
      floorNumber: raw.floor_number ?? null,
      roomNumber: raw.room_number ?? null,
      exclusiveArea: raw.exclusive_area ?? null,
      constructionDate: raw.construction_date ?? null,
    };
  }

  /**
   * 抽出結果をスプレッドシートの指定セルに書き込む
   */
  async writeToSpreadsheet(req: TokiWriteRequest): Promise<void> {
    const { spreadsheetUrl, sheetName, extractResult } = req;

    // スプレッドシートIDを抽出
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error(`スプレッドシートIDの抽出に失敗しました: ${spreadsheetUrl}`);
    }

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName,
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    // 書き込むセルのリストを構築
    const writes: Array<{ cell: string; value: string }> = [];

    const add = (cell: string, value: string | null) => {
      if (value !== null && value !== undefined) {
        writes.push({ cell, value: String(value) });
      }
    };

    // 所有者情報
    add('A81', extractResult.ownerAddress);
    add('C81', extractResult.ownerName);
    add('B110', extractResult.coOwners);

    // 敷地権の目的である土地（複数行対応：88行目から下方向）
    extractResult.lands.forEach((land, index) => {
      const row = 88 + index;
      add(`A${row}`, land.location);
      add(`C${row}`, land.lotNumber);
      add(`D${row}`, land.landType);
      add(`E${row}`, land.area);
    });

    // 一棟の建物の表示
    add('A96', extractResult.buildingName);
    add('A98', extractResult.buildingLocation);
    add('A100', extractResult.structure);
    add('C100', extractResult.roofType);
    add('D100', extractResult.floors);
    add('A102', extractResult.buildingArea);

    // 専有部分の建物の表示
    add('C96', extractResult.floorNumber);
    add('D96', extractResult.roomNumber);
    add('D102', extractResult.exclusiveArea);
    add('A104', extractResult.constructionDate);

    console.log(`[TokiExtract] スプレッドシートへの書き込み開始: ${writes.length}セル`);

    // 1セルずつ書き込む（batchUpdateはシート名指定が必要なため個別書き込み）
    for (const w of writes) {
      await sheetsClient.writeRawCell(w.cell, w.value);
      console.log(`[TokiExtract] 書き込み完了: ${w.cell} = ${w.value}`);
    }

    console.log('[TokiExtract] スプレッドシートへの書き込み完了');
  }

  /**
   * 媒介形態と種別からシート名を決定する
   */
  getSheetName(mediationType: string, propertyType: string): string | null {
    const isManshon =
      propertyType === 'マ' || propertyType === 'マンション';
    const isKodate =
      propertyType === '戸' || propertyType === '戸建' || propertyType === '戸建て';

    if (isManshon) {
      // 媒介形態に関わらず常に専任媒介シートを使用
      return '専任媒介契建物（売却)';
    }

    if (isKodate) {
      // 戸建て用シート（マンションと同じシート名）
      return '専任媒介契建物（売却)';
    }

    return null;
  }

  /**
   * 戸建て用：謄本PDFから媒介契約シート向けの情報を抽出する
   */
  async extractFromPdfForKodate(pdfBase64: string): Promise<TokiKodateExtractResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY が設定されていません');
    }

    const client = new Anthropic({ apiKey });

    const prompt = `あなたは不動産登記簿謄本の専門家です。
添付された登記簿謄本（全部事項証明書）のPDFを読み取り、以下の情報をJSONで返してください。

【共通ルール】
- 全角スペース・半角スペース・改行の揺れを吸収して読み取ること
- 下線が引かれている情報は抹消事項として除外すること（抹消された登記は無視する）
- 抽出できない場合は null を返すこと
- 面積・地積の「：」は小数点「.」に変換すること（例：１６１５：６７ → 1615.67）
- 全角数字は半角数字に変換すること
- 和暦の日付は西暦に変換すること（例：平成21年2月26日 → 2009-02-26）
- 推測せず、読み取れない場合は必ず null にすること
- 複数行ある場合は上から順に配列に格納すること

【所有者情報（権利部（甲区）（所有権に関する事項）から取得）】
- 「登記の目的」が「所有権保存」または「所有権移転」の行を対象とする
- 移転が複数回ある場合は最新（最後）の所有者を取得する
- 下線あり（抹消）の行は除外する
- 「権利者その他の事項」欄から住所・氏名を取得する
- 「共有者」と書かれている場合は1番目の共有者の情報のみ owner_address・owner_name に入れる
- 2番目以降の共有者は co_owners にまとめて出力する（氏名・住所・持分を改行区切りで）
- 共有者がいない場合は co_owners は null

【土地情報（表題部（土地の表示）から取得）】
- 「① 所在」欄から所在を取得 → location
- 「① 地番」欄から地番を取得 → lot_number
- 「② 地目」欄から地目を取得 → land_type
- 「④ 地積 ㎡」欄から地積を取得（「：」→「.」変換） → area
- 下線あり（抹消）の行は除外する
- 土地が複数行ある場合はlandsの配列に順番に格納する

【私道共有チェック】
以下の条件をすべて満たす場合のみ is_private_road_shared を true にする：
- 甲区に所有者が複数存在する
- 各所有者に持分割合（例：1/2, 1/3）が記載されている
※ 協同担保目録などは対象外

【主である建物の表示（表題部（主である建物の表示）から取得）】
- building_location: 「所在」欄の値
- house_number: 「家屋番号」欄の値
- building_type: 「① 種類」欄の値

【附属建物（表題部（附属建物）から取得）】
- 「原因及びその日付」欄から附属建物に関する記載をすべて抽出する
- 各建物の種類（例：車庫、物置）を取得する
- 複数ある場合は改行区切りで連結する
- annex_buildings: 附属建物の種類（改行区切り）

【構造（表題部（主である建物の表示）の「② 構造」から取得）】
- structure: 構造部分のみ（例：鉄骨鉄筋コンクリート造陸屋根14階建 → "鉄骨鉄筋コンクリート造"）
  対象：木造、土蔵造、石造、れんが造、コンクリートブロック造、鉄骨造、鉄筋コンクリート造、鉄骨鉄筋コンクリート造、木骨石造、木骨煉瓦造、軽量鉄骨造
- roof_type: 屋根部分のみ（例：鉄骨鉄筋コンクリート造陸屋根14階建 → "陸屋根"）
  対象：瓦ぶき、スレートぶき、亜鉛メッキ鋼板ぶき、草ぶき、陸屋根、セメント瓦ぶき、アルミニュームぶき、板ぶき、杉皮ぶき、石板ぶき、銅板ぶき、ルーフィングぶき、ビニール板ぶき、合金メッキ鋼板ぶき
- floors: 「〇階建」の数字のみ（例：14階建 → "14"）

【床面積（表題部（主である建物の表示）の「③ 床面積 ㎡」から取得）】
- floor1_area: 1階の床面積（「：」→「.」変換）
- floor2_area: 2階の床面積（「：」→「.」変換）。2階がない場合は null

【日付（表題部（主である建物の表示）の「原因及びその日付」から取得）】
- registration_date: 1行目の日付（和暦→西暦変換）（例：平成21年2月26日新築 → "2009-02-26"）
- extension_date: 「増築」が含まれる行の日付（和暦→西暦変換）。なければ null
- renovation_date: 「改築」が含まれる行の日付（和暦→西暦変換）。なければ null

【出力形式】
必ず以下のJSON形式のみで応答してください（説明文・コードブロック記号は不要）：

{
  "owner_address": null,
  "owner_name": null,
  "co_owners": null,
  "lands": [
    {
      "location": null,
      "lot_number": null,
      "land_type": null,
      "area": null
    }
  ],
  "is_private_road_shared": false,
  "building_location": null,
  "house_number": null,
  "building_type": null,
  "annex_buildings": null,
  "structure": null,
  "roof_type": null,
  "floors": null,
  "floor1_area": null,
  "floor2_area": null,
  "registration_date": null,
  "extension_date": null,
  "renovation_date": null
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            } as any,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    console.log('[TokiKodate] Claude response (first 500):', responseText.substring(0, 500));

    // JSONを抽出（コードブロックあり・なし両対応）
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (!jsonStr) {
      throw new Error('Claude APIからJSONを取得できませんでした');
    }

    let raw: any;
    try {
      raw = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`JSONパースエラー: ${jsonStr.substring(0, 200)}`);
    }

    return {
      ownerAddress: raw.owner_address ?? null,
      ownerName: raw.owner_name ?? null,
      coOwners: raw.co_owners ?? null,
      lands: Array.isArray(raw.lands)
        ? raw.lands.map((l: any) => ({
            location: l.location ?? null,
            lotNumber: l.lot_number ?? null,
            landType: l.land_type ?? null,
            area: l.area ?? null,
          }))
        : [],
      isPrivateRoadShared: raw.is_private_road_shared === true,
      buildingLocation: raw.building_location ?? null,
      houseNumber: raw.house_number ?? null,
      buildingType: raw.building_type ?? null,
      annexBuildings: raw.annex_buildings ?? null,
      structure: raw.structure ?? null,
      roofType: raw.roof_type ?? null,
      floors: raw.floors ?? null,
      floor1Area: raw.floor1_area ?? null,
      floor2Area: raw.floor2_area ?? null,
      registrationDate: raw.registration_date ?? null,
      extensionDate: raw.extension_date ?? null,
      renovationDate: raw.renovation_date ?? null,
    };
  }

  /**
   * 戸建て用：抽出結果をスプレッドシートの指定セルに書き込む
   */
  async writeToSpreadsheetForKodate(req: TokiKodateWriteRequest): Promise<void> {
    const { spreadsheetUrl, sheetName, extractResult } = req;

    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error(`スプレッドシートIDの抽出に失敗しました: ${spreadsheetUrl}`);
    }

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName,
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    const writes: Array<{ cell: string; value: string }> = [];

    const add = (cell: string, value: string | null | boolean) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'boolean') {
          writes.push({ cell, value: value ? 'TRUE' : 'FALSE' });
        } else {
          writes.push({ cell, value: String(value) });
        }
      }
    };

    // 所有者情報（甲区）
    add('A84', extractResult.ownerAddress);
    add('C84', extractResult.ownerName);
    add('B112', extractResult.coOwners);

    // 土地情報（複数行対応：91行目から下方向）
    extractResult.lands.forEach((land, index) => {
      const row = 91 + index;
      add(`A${row}`, land.location);
      // 地番：全角数字・全角スペースを半角に統一
      const normalizedLotNumber = land.lotNumber
        ? land.lotNumber
            .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, ' ')
            .trim()
        : null;
      add(`C${row}`, normalizedLotNumber);
      add(`D${row}`, land.landType);
      add(`E${row}`, land.area);
    });

    // 私道共有チェック：ノータッチ（F91〜F95は書き込み不要）

    // 主である建物の表示
    add('A99', extractResult.buildingLocation);
    add('C99', extractResult.houseNumber);
    add('D99', extractResult.buildingType);

    // 構造
    add('A103', extractResult.structure);
    add('C103', extractResult.roofType);
    add('D103', extractResult.floors);

    // 床面積
    add('C105', extractResult.floor1Area);
    add('D105', extractResult.floor2Area);

    // 日付
    add('A107', extractResult.registrationDate);
    add('C107', extractResult.extensionDate);
    add('D107', extractResult.renovationDate);

    console.log(`[TokiKodate] スプレッドシートへの書き込み開始: ${writes.length}セル`);

    for (const w of writes) {
      await sheetsClient.writeRawCell(w.cell, w.value);
      console.log(`[TokiKodate] 書き込み完了: ${w.cell} = ${w.value}`);
    }

    console.log('[TokiKodate] スプレッドシートへの書き込み完了');
  }

  /**
   * 契約決済タブ用：謄本PDFから重説シート向けの情報を抽出する
   */
  async extractFromPdfForKeiyaku(pdfBase64: string): Promise<TokiKeiyakuExtractResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY が設定されていません');
    }

    const client = new Anthropic({ apiKey });

    const prompt = `あなたは不動産登記簿謄本の専門家です。
添付された登記簿謄本（全部事項証明書）のPDFを読み取り、以下の情報をJSONで返してください。

【共通ルール】
- 全角スペース・半角スペース・改行の揺れを吸収して読み取ること
- 下線が引かれている情報は抹消事項として除外すること（抹消された登記は無視する）
- 抽出できない場合は null を返すこと
- 全角数字は半角数字に変換すること
- 面積・地積の「：」は小数点「.」に変換すること（例：１６１５：６７ → 1615.67）
- 和暦の日付は西暦に変換すること
- 推測せず、読み取れない場合は必ず null にすること

【謄本取得日】
謄本の一番左上に記載されている日付（例：2026/05/01）から以下を取得：
- acquisition_year_wareki: 西暦年を令和年に変換し、年の数字のみ（例：2026年→令和8年→"8"）
  ※令和元年=2019年。令和N年 = 西暦年 - 2018
- acquisition_month: 月の数字のみ（例：5）
- acquisition_day: 日の数字のみ（例：1）

【所有者情報の共通ロジック】
対象：「権利部（甲区）（所有権に関する事項）」
条件：
- 「登記の目的」が「所有権保存」または「所有権移転」の行を対象
- 移転を繰り返している場合は現在の所有者を判定
- 「権利者その他の事項」欄から住所・氏名・共有持分を抽出
- 下線付きの抹消事項は除外
- 「共有者」と書かれている場合は共有者全員を所有者として扱う

出力ルール：
- owner_address: 一番上の所有者の住所（代表住所）
- owner_names: 代表住所と同じ住所の所有者名を全員「,」で連結
- other_address_owner_count: 所有者総数 − 代表住所と同じ住所の所有者数（数字のみ）
- total_owner_count: 有効な現在所有者の総数（数字のみ）
- owner_details: 現在の所有者が複数いる場合、全員について「住所\n氏名\n共有持分」を出力し、最後に空行を入れて「以下余白」と記載。1人の場合も同様。

【敷地権の目的である土地の表示】
対象：「表題部（敷地権の目的である土地の表示）」
- lands配列に各土地を格納：
  - location: 「② 所在及び地番」欄から地番を除いた所在のみ（例：大分市舞鶴町一丁目３４５６番２ → "大分市舞鶴町一丁目"）
  - lot_number: 「② 所在及び地番」欄から地番のみ（例：大分市舞鶴町一丁目３４５６番２ → "3456番2"）
  - land_type: 「③ 地目」欄の値
  - area: 「④ 地積 ㎡」欄の値（「：」→「.」変換）
  - sikichiken_type: 「2 敷地権の種類」の値
  - sikichiken_ratio: 「3 敷地権の割合」の値

【一棟の建物の表示】
対象：「表題部（一棟の建物の表示）」
- building_name: 「建物の名称」欄の値
- building_location: 「所在」欄の値
- structure: 「① 構造」欄から建物構造部分のみ（例：鉄骨鉄筋コンクリート造陸屋根14階建 → "鉄骨鉄筋コンクリート造"）
  対象：木造、軽量鉄骨造、鉄骨造、鉄筋コンクリート造、鉄骨鉄筋コンクリート造、鉄筋鉄骨コンクリート造、コンクリートブロック造
- roof_type: 「① 構造」欄から屋根部分のみ（例：陸屋根、瓦葺、スレート葺、亜鉛メッキ鋼板葺、合金メッキ鋼板葺、金属板葺、セメント瓦葺）
- floors: 「① 構造」欄から「〇階建」の数字のみ（例：14階建 → "14"）
- basement_floors: 「① 構造」欄に「地下〇階」がある場合、地下階数の数字のみ（なければ null）
- building_area: 「② 床面積 ㎡」欄の全階の面積を合計した値（「：」→「.」変換後に合計）

【専有部分の建物の表示】
対象：「表題部（専有部分の建物の表示）」
- floor_number: 「③ 床面積 ㎡」欄の「〇階部分」から数字のみ（例：１０階部分 → "10"）
- room_number: 「建物の名称」欄が数字のみなら半角で取得。数字以外が含まれる場合は「家屋番号」欄の末尾の連続した数字を取得（例：中島東三丁目 ６４７５番１の１００１ → "1001"）
- exclusive_area: 「③ 床面積 ㎡」欄の1行目の面積（「：」→「.」変換）
- construction_date: 「原因及びその日付〔登記の日付〕」欄の1行目の日付（和暦→西暦変換）
- house_number: 「家屋番号」欄の値
- building_type: 「1 種類」の下のセルの値
- building_structure: 「2 構造」の下のセルの値（「1階建」は除外）

【乙区・権利チェック】
対象：「権利部（乙区）（所有権以外の権利に関する事項）」
- has_mortgage: 乙区に「抵当権設定」「根抵当権設定」「賃借権」が残っている場合 true（抹消済みは除外）
- has_other_rights: 乙区に何らかの権利が残っている場合 true（抹消済みは除外）
- remaining_rights: 乙区に残っている権利名の配列（抹消済みは除外）

【出力形式】
必ず以下のJSON形式のみで応答してください（説明文・コードブロック記号は不要）：

{
  "acquisition_year_wareki": null,
  "acquisition_month": null,
  "acquisition_day": null,
  "owner_address": null,
  "owner_names": null,
  "other_address_owner_count": null,
  "total_owner_count": null,
  "owner_details": null,
  "lands": [
    {
      "location": null,
      "lot_number": null,
      "land_type": null,
      "area": null,
      "sikichiken_type": null,
      "sikichiken_ratio": null
    }
  ],
  "building_name": null,
  "building_location": null,
  "structure": null,
  "roof_type": null,
  "floors": null,
  "basement_floors": null,
  "building_area": null,
  "floor_number": null,
  "room_number": null,
  "exclusive_area": null,
  "construction_date": null,
  "house_number": null,
  "building_type": null,
  "building_structure": null,
  "has_mortgage": false,
  "has_other_rights": false,
  "remaining_rights": []
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            } as any,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    console.log('[TokiKeiyaku] Claude response (first 500):', responseText.substring(0, 500));

    // JSONを抽出（コードブロックあり・なし両対応）
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (!jsonStr) {
      throw new Error('Claude APIからJSONを取得できませんでした');
    }

    let raw: any;
    try {
      raw = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`JSONパースエラー: ${jsonStr.substring(0, 200)}`);
    }

    // 乙区の権利チェック（V89〜V92, V103〜V108）
    // X89〜X92, X103〜X108 に記載されている権利名と照合
    // ここでは remaining_rights 配列を返し、フロントエンドで照合する
    const remainingRights: string[] = Array.isArray(raw.remaining_rights) ? raw.remaining_rights : [];

    return {
      acquisitionYearWareki: raw.acquisition_year_wareki ? String(raw.acquisition_year_wareki) : null,
      acquisitionMonth: raw.acquisition_month ? String(raw.acquisition_month) : null,
      acquisitionDay: raw.acquisition_day ? String(raw.acquisition_day) : null,
      ownerAddress: raw.owner_address ?? null,
      ownerNames: raw.owner_names ?? null,
      otherAddressOwnerCount: raw.other_address_owner_count ? String(raw.other_address_owner_count) : null,
      totalOwnerCount: raw.total_owner_count ? String(raw.total_owner_count) : null,
      ownerDetails: raw.owner_details ?? null,
      lands: Array.isArray(raw.lands)
        ? raw.lands.map((l: any) => ({
            location: l.location ?? null,
            lotNumber: l.lot_number ?? null,
            landType: l.land_type ?? null,
            area: normalizeNumericString(l.area),
            sikichikenType: l.sikichiken_type ?? null,
            sikichikenRatio: l.sikichiken_ratio ?? null,
          }))
        : [],
      buildingName: raw.building_name ?? null,
      buildingLocation: raw.building_location ?? null,
      structure: raw.structure ?? null,
      roofType: raw.roof_type ?? null,
      floors: raw.floors ?? null,
      basementFloors: raw.basement_floors ?? null,
      buildingArea: normalizeNumericString(raw.building_area),
      floorNumber: raw.floor_number ?? null,
      roomNumber: raw.room_number ?? null,
      exclusiveArea: normalizeNumericString(raw.exclusive_area),
      constructionDate: raw.construction_date ?? null,
      houseNumber: raw.house_number ?? null,
      buildingType: raw.building_type ?? null,
      buildingStructure: raw.building_structure ?? null,
      hasMortgage: raw.has_mortgage === true,
      hasOtherRights: raw.has_other_rights === true,
      rightChecks: remainingRights.map((rightName: string) => ({
        cell: rightName,
        value: true,
      })),
    };
  }

  /**
   * 契約決済タブ用：抽出結果を「重説」シートの指定セルに書き込む
   */
  async writeToSpreadsheetForKeiyaku(req: TokiKeiyakuWriteRequest): Promise<void> {
    const { spreadsheetUrl, sheetName, extractResult } = req;

    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      throw new Error(`スプレッドシートIDの抽出に失敗しました: ${spreadsheetUrl}`);
    }

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName,
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    const writes: Array<{ cell: string; value: string | boolean }> = [];

    const add = (cell: string, value: string | null | boolean) => {
      if (value !== null && value !== undefined) {
        writes.push({ cell, value: typeof value === 'boolean' ? value : String(value) });
      }
    };

    // nullでも空文字で上書きする（既存値を消す必要がある場合に使用）
    const addForce = (cell: string, value: string | null | boolean) => {
      if (typeof value === 'boolean') {
        writes.push({ cell, value: value ? 'TRUE' : 'FALSE' });
      } else {
        writes.push({ cell, value: value !== null && value !== undefined ? String(value) : '' });
      }
    };

    // 謄本取得日
    add('AB80', extractResult.acquisitionYearWareki);
    add('AF80', extractResult.acquisitionMonth);
    add('AJ80', extractResult.acquisitionDay);

    // 所有者情報
    add('K35', extractResult.ownerAddress);
    add('K36', extractResult.ownerNames);
    add('AX36', extractResult.otherAddressOwnerCount);
    add('BF36', extractResult.totalOwnerCount);

    // F54: 既存の「余白」を削除してから所有者詳細を書き込む
    if (extractResult.ownerDetails !== null) {
      add('F54', extractResult.ownerDetails);
    }

    // V81, B82（所有者情報の別セル）
    add('V81', extractResult.ownerAddress);
    add('B82', extractResult.ownerNames);

    // V94, V95
    add('V94', extractResult.ownerAddress);
    add('V95', extractResult.ownerNames);

    // F111（F54と同じ内容）
    if (extractResult.ownerDetails !== null) {
      add('F111', extractResult.ownerDetails);
    }

    // 敷地権の目的である土地（複数行対応：63行目から2行おき）
    // スプレッドシートは各土地行が2行結合セルのため、63, 65, 67... と2行おきに書き込む
    // nullでも空文字で上書き（既存値を消す必要があるため addForce を使用）
    extractResult.lands.forEach((land, index) => {
      const row = 63 + index * 2;
      addForce(`F${row}`, land.location);
      addForce(`V${row}`, land.lotNumber);
      addForce(`AD${row}`, land.landType);
      addForce(`AO${row}`, land.area);
      addForce(`AX${row}`, land.sikichikenType);
      addForce(`BE${row}`, land.sikichikenRatio);
    });

    // 一棟の建物の表示
    add('K40', extractResult.buildingName);
    add('M44', extractResult.buildingLocation);
    add('M45', extractResult.structure);
    add('AK45', extractResult.roofType);
    add('Q46', extractResult.floors);
    add('AC46', extractResult.basementFloors);
    add('M47', extractResult.buildingArea);

    // 専有部分の建物の表示
    add('AX40', extractResult.floorNumber);
    add('BD40', extractResult.roomNumber);
    add('AE52', extractResult.exclusiveArea);
    add('AS47', extractResult.constructionDate);
    add('M48', extractResult.houseNumber);
    add('AS48', extractResult.buildingName); // K40と同じ値
    add('M49', extractResult.buildingType);
    add('M50', extractResult.buildingStructure);

    // 乙区・権利チェック
    add('K92', extractResult.hasMortgage);
    add('K87', extractResult.hasOtherRights);
    add('K109', extractResult.hasMortgage);

    console.log(`[TokiKeiyaku] スプレッドシートへの書き込み開始: ${writes.length}セル`);

    for (const w of writes) {
      if (typeof w.value === 'boolean') {
        await sheetsClient.writeRawCell(w.cell, w.value ? 'TRUE' : 'FALSE');
      } else {
        await sheetsClient.writeRawCell(w.cell, w.value as string);
      }
      console.log(`[TokiKeiyaku] 書き込み完了: ${w.cell} = ${w.value}`);
    }

    console.log('[TokiKeiyaku] スプレッドシートへの書き込み完了');
  }

  // -------------------------------------------------------
  // 戸建て用「契約決済タブ」重説シート向けメソッド
  // -------------------------------------------------------

  /**
   * 戸建て用：Google DriveフォルダURLから謄本PDFを複数検索してBase64で返す
   * 「全部事項」または「全部謄本」を含むPDFをすべて取得する
   */
  /**
   * 戸建て用（媒介契約タブ）：PDF一覧のみ返す（fileId付き・高速）
   * ダウンロード・解析はしない
   */
  async listTokiPdfsForKodate(storageFolderUrl: string): Promise<Array<{
    fileId: string;
    fileName: string;
    pdfType: 'land' | 'building' | 'unknown';
  }>> {
    const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
    if (!folderId) return [];

    const files = await this.driveService.listFiles(folderId);
    const pdfFiles = files.filter(
      (f) => f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    const landFiles = pdfFiles.filter((f) => f.name.includes('土地_全部事項'));
    const buildingFile = pdfFiles.find((f) => f.name.includes('建物_全部事項')) ?? null;

    const result: Array<{ fileId: string; fileName: string; pdfType: 'land' | 'building' | 'unknown' }> = [];

    if (landFiles.length === 0 && buildingFile === null) {
      // フォールバック：「全部事項」「全部謄本」を含むPDFを1件
      const fallback = pdfFiles.find((f) => f.name.includes('全部事項') || f.name.includes('全部謄本'));
      if (fallback) result.push({ fileId: fallback.id, fileName: fallback.name, pdfType: 'unknown' });
    } else {
      for (const f of landFiles) result.push({ fileId: f.id, fileName: f.name, pdfType: 'land' });
      if (buildingFile) result.push({ fileId: buildingFile.id, fileName: buildingFile.name, pdfType: 'building' });
    }

    return result;
  }

  /**
   * 戸建て用（媒介契約タブ）：fileIdを受け取り1枚だけ解析して返す
   */
  async extractSingleTokiPdfForKodate(fileId: string, fileName: string): Promise<TokiKodateExtractResult> {
    const fileData = await this.driveService.getFile(fileId);
    if (!fileData) throw new Error(`PDFの取得に失敗しました: ${fileName}`);
    const base64 = fileData.data.toString('base64');
    return this.extractFromPdfForKodate(base64);
  }

  /**
   * 戸建て用（媒介契約タブ）：Google DriveフォルダURLから謄本PDFを複数取得する
   * - 「土地_全部事項」を含むPDFをすべて取得（土地謄本）
   * - 「建物_全部事項」を含むPDFを1件取得（建物謄本）
   * - どちらも見つからない場合は「全部事項」「全部謄本」を含むPDFにフォールバック
   */
  async findTokiPdfsForKodate(storageFolderUrl: string): Promise<{
    landPdfs: Array<{ base64: string; fileName: string }>;
    buildingPdf: { base64: string; fileName: string } | null;
  }> {
    try {
      const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
      if (!folderId) {
        console.error('[TokiKodate] フォルダIDの抽出に失敗:', storageFolderUrl);
        return { landPdfs: [], buildingPdf: null };
      }

      console.log('[TokiKodate] フォルダ検索中:', folderId);
      const files = await this.driveService.listFiles(folderId);

      const pdfFiles = files.filter(
        (f) =>
          (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      );

      // 「土地_全部事項」を含むPDFをすべて取得
      const landFiles = pdfFiles.filter((f) => f.name.includes('土地_全部事項'));

      // 「建物_全部事項」を含むPDFを1件取得
      const buildingFile = pdfFiles.find((f) => f.name.includes('建物_全部事項')) ?? null;

      // フォールバック：土地も建物も見つからない場合は「全部事項」「全部謄本」を含むPDFを1件だけ取得
      // （旧来の命名規則のファイルは1枚として扱う）
      const fallbackFile =
        landFiles.length === 0 && buildingFile === null
          ? (pdfFiles.find((f) => f.name.includes('全部事項') || f.name.includes('全部謄本')) ?? null)
          : null;

      console.log(
        `[TokiKodate] 土地謄本: ${landFiles.length}件, 建物謄本: ${buildingFile ? 1 : 0}件, フォールバック: ${fallbackFile ? fallbackFile.name : 'なし'}`
      );

      // 土地PDFを取得
      const landPdfs: Array<{ base64: string; fileName: string }> = [];
      for (const f of landFiles) {
        const fileData = await this.driveService.getFile(f.id);
        if (fileData) {
          landPdfs.push({ base64: fileData.data.toString('base64'), fileName: f.name });
        }
      }

      // 建物PDFを取得
      let buildingPdf: { base64: string; fileName: string } | null = null;
      if (buildingFile) {
        const fileData = await this.driveService.getFile(buildingFile.id);
        if (fileData) {
          buildingPdf = { base64: fileData.data.toString('base64'), fileName: buildingFile.name };
        }
      }

      // フォールバック：土地も建物も見つからない場合は1枚だけ土地PDFとして扱う
      if (landPdfs.length === 0 && buildingPdf === null && fallbackFile) {
        const fileData = await this.driveService.getFile(fallbackFile.id);
        if (fileData) {
          landPdfs.push({ base64: fileData.data.toString('base64'), fileName: fallbackFile.name });
        }
      }

      return { landPdfs, buildingPdf };
    } catch (error: any) {
      console.error('[TokiKodate] PDF検索エラー:', error.message);
      throw error;
    }
  }

  /**
   * 戸建て用（媒介契約タブ）：複数の謄本PDFを統合して抽出結果を返す
   * - 土地謄本（複数）：土地情報を統合し、面積の多い順にソート
   *   同じ所有者の場合は名前を1つにまとめる
   * - 建物謄本（1件）：建物情報を取得
   * - 建物謄本がない場合は土地謄本1枚目から建物情報を取得
   */
  async extractFromPdfsForKodate(
    landPdfs: Array<{ base64: string; fileName: string }>,
    buildingPdf: { base64: string; fileName: string } | null
  ): Promise<{ mergedResult: TokiKodateExtractResult; fileNames: string[] }> {
    if (landPdfs.length === 0 && buildingPdf === null) {
      throw new Error('謄本PDFが見つかりませんでした');
    }

    const fileNames: string[] = [];

    // 土地謄本と建物謄本を並列処理（API呼び出しを同時実行して高速化）
    console.log(`[TokiKodate] 並列解析開始: 土地${landPdfs.length}件, 建物${buildingPdf ? 1 : 0}件`);

    const [landResults, buildingResult] = await Promise.all([
      // 土地謄本：複数を並列処理
      Promise.all(
        landPdfs.map(async (pdf) => {
          console.log(`[TokiKodate] 土地謄本解析中: ${pdf.fileName}`);
          return this.extractFromPdfForKodate(pdf.base64);
        })
      ),
      // 建物謄本：1件処理
      buildingPdf
        ? (async () => {
            console.log(`[TokiKodate] 建物謄本解析中: ${buildingPdf.fileName}`);
            return this.extractFromPdfForKodate(buildingPdf.base64);
          })()
        : Promise.resolve(null),
    ]);

    landPdfs.forEach((pdf) => fileNames.push(pdf.fileName));
    if (buildingPdf) fileNames.push(buildingPdf.fileName);

    // 土地情報を全土地謄本から収集
    const allLands: TokiKodateExtractResult['lands'] = [];
    for (const r of landResults) {
      allLands.push(...r.lands);
    }
    // 土地謄本がない場合は建物謄本の土地情報を使用
    if (allLands.length === 0 && buildingResult) {
      allLands.push(...buildingResult.lands);
    }

    // 土地を面積の多い順にソート（areaNumericがnullのものは末尾）
    allLands.sort((a, b) => {
      if (a.areaNumeric === null && b.areaNumeric === null) return 0;
      if (a.areaNumeric === null) return 1;
      if (b.areaNumeric === null) return -1;
      return b.areaNumeric - a.areaNumeric;
    });

    // 所有者情報：建物謄本があれば建物謄本から、なければ土地謄本1枚目から
    const ownerSource = buildingResult ?? (landResults.length > 0 ? landResults[0] : null);
    if (!ownerSource) throw new Error('謄本PDFが見つかりませんでした');

    // 建物情報：建物謄本があれば建物謄本から、なければ土地謄本1枚目から（通常nullになる）
    const buildingSource = buildingResult ?? (landResults.length > 0 ? landResults[0] : ownerSource);

    // 所有者情報の統合：同じ所有者の場合は名前を1つにまとめる
    let mergedCoOwners = ownerSource.coOwners;

    if (buildingResult && landResults.length > 0) {
      // 土地謄本の所有者が建物謄本と異なる場合のみ追記
      const differentOwners: string[] = [];
      for (const r of landResults) {
        if (r.ownerName && r.ownerName !== buildingResult.ownerName) {
          const ownerInfo = `${r.ownerName}（${r.ownerAddress ?? '住所不明'}）`;
          if (!differentOwners.includes(ownerInfo)) {
            differentOwners.push(ownerInfo);
          }
        }
        if (r.coOwners && r.coOwners !== buildingResult.coOwners) {
          if (!mergedCoOwners) {
            mergedCoOwners = r.coOwners;
          } else if (!mergedCoOwners.includes(r.coOwners)) {
            mergedCoOwners = mergedCoOwners + '\n' + r.coOwners;
          }
        }
      }
      if (differentOwners.length > 0) {
        const additionalInfo = differentOwners.join('\n');
        if (!mergedCoOwners) {
          mergedCoOwners = additionalInfo;
        } else {
          mergedCoOwners = mergedCoOwners + '\n' + additionalInfo;
        }
      }
    }

    const mergedResult: TokiKodateExtractResult = {
      ownerAddress: ownerSource.ownerAddress,
      ownerName: ownerSource.ownerName,
      coOwners: mergedCoOwners,
      lands: allLands,
      isPrivateRoadShared: landResults.some((r) => r.isPrivateRoadShared) || (buildingResult?.isPrivateRoadShared ?? false),
      buildingLocation: buildingSource.buildingLocation,
      houseNumber: buildingSource.houseNumber,
      buildingType: buildingSource.buildingType,
      annexBuildings: buildingSource.annexBuildings,
      structure: buildingSource.structure,
      roofType: buildingSource.roofType,
      floors: buildingSource.floors,
      floor1Area: buildingSource.floor1Area,
      floor2Area: buildingSource.floor2Area,
      registrationDate: buildingSource.registrationDate,
      extensionDate: buildingSource.extensionDate,
      renovationDate: buildingSource.renovationDate,
    };

    return { mergedResult, fileNames };
  }

  async findTokiPdfsForKodateKeiyaku(storageFolderUrl: string): Promise<Array<{ base64: string; fileName: string }>> {
    try {
      const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
      if (!folderId) {
        console.error('[TokiKodateKeiyaku] フォルダIDの抽出に失敗:', storageFolderUrl);
        return [];
      }

      console.log('[TokiKodateKeiyaku] フォルダ検索中:', folderId);
      const files = await this.driveService.listFiles(folderId);

      // 「全部事項」または「全部謄本」を含むPDFをすべて取得
      const tokiFiles = files.filter(
        (f) =>
          (f.name.includes('全部事項') || f.name.includes('全部謄本')) &&
          (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      );

      if (tokiFiles.length === 0) {
        console.warn('[TokiKodateKeiyaku] 謄本PDFが見つかりません。フォルダ内ファイル:', files.map((f) => f.name));
        return [];
      }

      console.log(`[TokiKodateKeiyaku] 謄本PDF発見: ${tokiFiles.length}件`, tokiFiles.map((f) => f.name));

      const results: Array<{ base64: string; fileName: string }> = [];
      for (const tokiFile of tokiFiles) {
        const fileData = await this.driveService.getFile(tokiFile.id);
        if (fileData) {
          results.push({ base64: fileData.data.toString('base64'), fileName: tokiFile.name });
        }
      }
      return results;
    } catch (error: any) {
      console.error('[TokiKodateKeiyaku] PDF検索エラー:', error.message);
      throw error;
    }
  }

  /**
   * 戸建て用：謄本PDFから重説シート向けの情報を抽出する（1枚分）
   */
  async extractFromPdfForKodateKeiyaku(pdfBase64: string): Promise<TokiKodateKeiyakuExtractResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

    const client = new Anthropic({ apiKey });

    const prompt = `あなたは不動産登記簿謄本の専門家です。
添付された登記簿謄本（全部事項証明書）のPDFを読み取り、以下の情報をJSONで返してください。

【共通ルール】
- 全角スペース・半角スペース・改行の揺れを吸収して読み取ること
- 下線が引かれている情報は抹消事項として除外すること
- 抽出できない場合は null を返すこと
- 全角数字は半角数字に変換すること
- 面積・地積の「：」は小数点「.」に変換すること（例：１６１５：６７ → 1615.67）
- 和暦の日付は西暦に変換すること
- 推測せず、読み取れない場合は必ず null にすること
- 共同担保目録は所有者判定・共有判定・乙区権利残存判定の根拠にしないこと

【謄本取得日】
謄本の一番左上にある日付（例：2026/05/01）から取得：
- acquisition_year_wareki: 西暦年を令和年に変換し年の数字のみ（令和N年 = 西暦年 - 2018）
- acquisition_month: 月の数字のみ
- acquisition_day: 日の数字のみ

【所有者情報（権利部（甲区）（所有権に関する事項）から取得）】
条件：
- 「登記の目的」が「所有権保存」または「所有権移転」の行を対象
- 移転を繰り返している場合は現在の所有者を判定
- 下線付きの抹消事項は除外
- 「共有者」と書かれている場合は共有者全員を所有者として扱う

出力ルール：
- owner_address: 一番上の所有者の住所（代表住所）
- owner_names: 代表住所と同じ住所の所有者名を全員「,」で連結
- other_address_owner_count: 所有者総数 − 代表住所と同じ住所の所有者数（数字のみ）
- total_owner_count: 有効な現在所有者の総数（数字のみ）
- owner_details: 現在の所有者全員について「住所\\n氏名\\n共有持分」を出力し、最後に空行を入れて「以下余白」と記載

【共有持分チェック】
甲区の現在所有者情報のみを根拠に判定：
- 現所有者が複数名いる かつ 各所有者に持分割合（例：1/2, 1/3）が明示されている場合 has_shared_ownership = true
- 共同担保目録は判断根拠にしないこと

【土地の表示（表題部（土地の表示）から取得）】
- location: 「① 所在」欄の値
- lot_number: 「① 地番」欄の値（下線付き抹消は除外）
- land_type: 「② 地目」欄の値（下線付き抹消は除外）
- area: 「④ 地積 ㎡」欄の値（「：」→「.」変換）
- area_numeric: area を数値に変換した値（ソート用）
- 土地が複数行ある場合はlandsの配列に格納

【主である建物の表示（表題部（主である建物の表示）から取得）】
- building_location: 「所在」欄の値
- house_number: 「家屋番号」欄の値
- building_type: 「① 種類」欄の値
- annex_buildings: 附属建物の種類（複数ある場合は改行区切り）
- structure: 「② 構造」欄から構造部分のみ（例：木造、鉄骨造、鉄筋コンクリート造、鉄骨鉄筋コンクリート造、軽量鉄骨造）
- roof_type: 「② 構造」欄から屋根部分のみ（例：陸屋根、瓦葺、スレート葺、亜鉛メッキ鋼板葺、合金メッキ鋼板葺、金属板葺、セメント瓦葺）
- floors: 「② 構造」欄から「〇階建」の数字のみ
- floor1_area: 「③ 床面積 ㎡」の1階の値（「：」→「.」変換）
- floor2_area: 「③ 床面積 ㎡」の2階の値（「：」→「.」変換）。なければ null
- registration_date: 「原因及びその日付」欄の1行目の日付（和暦→西暦）
- extension_date: 「増築」が含まれる行の日付（和暦→西暦）。なければ null
- has_extension: extension_date が存在する場合 true
- renovation_date: 「改築」が含まれる行の日付（和暦→西暦）。なければ null
- has_renovation: renovation_date が存在する場合 true

【乙区・権利チェック（権利部（乙区）（所有権以外の権利に関する事項）から取得）】
- has_other_rights: 乙区に何らかの権利が残っている場合 true（抹消済みは除外）
- has_mortgage: 乙区に「抵当権設定」「根抵当権設定」「賃借権」が残っている場合 true（抹消済みは除外）
- remaining_rights: 乙区に残っている権利名の配列（抹消済みは除外）

【出力形式】
必ず以下のJSON形式のみで応答してください（説明文・コードブロック記号は不要）：

{
  "acquisition_year_wareki": null,
  "acquisition_month": null,
  "acquisition_day": null,
  "owner_address": null,
  "owner_names": null,
  "other_address_owner_count": null,
  "total_owner_count": null,
  "owner_details": null,
  "has_shared_ownership": false,
  "lands": [
    {
      "location": null,
      "lot_number": null,
      "land_type": null,
      "area": null,
      "area_numeric": null
    }
  ],
  "building_location": null,
  "house_number": null,
  "building_type": null,
  "annex_buildings": null,
  "structure": null,
  "roof_type": null,
  "floors": null,
  "floor1_area": null,
  "floor2_area": null,
  "registration_date": null,
  "extension_date": null,
  "has_extension": false,
  "renovation_date": null,
  "has_renovation": false,
  "has_other_rights": false,
  "has_mortgage": false,
  "remaining_rights": []
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as any,
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    console.log('[TokiKodateKeiyaku] Claude response (first 500):', responseText.substring(0, 500));

    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;
    if (!jsonStr) throw new Error('Claude APIからJSONを取得できませんでした');

    let raw: any;
    try { raw = JSON.parse(jsonStr); } catch (e) { throw new Error(`JSONパースエラー: ${jsonStr.substring(0, 200)}`); }

    const remainingRights: string[] = Array.isArray(raw.remaining_rights) ? raw.remaining_rights : [];

    return {
      acquisitionYearWareki: raw.acquisition_year_wareki ? String(raw.acquisition_year_wareki) : null,
      acquisitionMonth: raw.acquisition_month ? String(raw.acquisition_month) : null,
      acquisitionDay: raw.acquisition_day ? String(raw.acquisition_day) : null,
      ownerAddress: raw.owner_address ?? null,
      ownerNames: raw.owner_names ?? null,
      otherAddressOwnerCount: raw.other_address_owner_count ? String(raw.other_address_owner_count) : null,
      totalOwnerCount: raw.total_owner_count ? String(raw.total_owner_count) : null,
      ownerDetails: raw.owner_details ?? null,
      hasSharedOwnership: raw.has_shared_ownership === true,
      lands: Array.isArray(raw.lands)
        ? raw.lands.map((l: any) => ({
            location: l.location ?? null,
            lotNumber: l.lot_number ?? null,
            landType: l.land_type ?? null,
            area: normalizeNumericString(l.area),
            areaNumeric: l.area_numeric !== null && l.area_numeric !== undefined ? Number(l.area_numeric) : null,
          }))
        : [],
      buildingLocation: raw.building_location ?? null,
      houseNumber: raw.house_number ?? null,
      buildingType: raw.building_type ?? null,
      annexBuildings: raw.annex_buildings ?? null,
      structure: raw.structure ?? null,
      roofType: raw.roof_type ?? null,
      floors: raw.floors ?? null,
      floor1Area: normalizeNumericString(raw.floor1_area),
      floor2Area: normalizeNumericString(raw.floor2_area),
      registrationDate: raw.registration_date ?? null,
      extensionDate: raw.extension_date ?? null,
      hasExtension: raw.has_extension === true,
      renovationDate: raw.renovation_date ?? null,
      hasRenovation: raw.has_renovation === true,
      hasOtherRights: raw.has_other_rights === true,
      hasMortgage: raw.has_mortgage === true,
      rightChecks96: remainingRights,
      rightChecks110: remainingRights,
    };
  }

  /**
   * 戸建て用（契約決済タブ）：PDF一覧のみ返す（fileId付き・高速）
   */
  async listTokiPdfsForKodateKeiyaku(storageFolderUrl: string): Promise<Array<{ fileId: string; fileName: string }>> {
    const folderId = this.extractFolderIdFromUrl(storageFolderUrl);
    if (!folderId) return [];

    const files = await this.driveService.listFiles(folderId);
    const tokiFiles = files.filter(
      (f) =>
        (f.name.includes('全部事項') || f.name.includes('全部謄本')) &&
        (f.mimeType === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    );

    return tokiFiles.map((f) => ({ fileId: f.id, fileName: f.name }));
  }

  /**
   * 戸建て用（契約決済タブ）：fileIdを受け取り1枚だけ解析して返す
   */
  async extractSingleTokiPdfForKodateKeiyaku(fileId: string, fileName: string): Promise<TokiKodateKeiyakuExtractResult> {
    const fileData = await this.driveService.getFile(fileId);
    if (!fileData) throw new Error(`PDFの取得に失敗しました: ${fileName}`);
    const base64 = fileData.data.toString('base64');
    return this.extractFromPdfForKodateKeiyaku(base64);
  }

  /**
   * 戸建て用：複数謄本PDFを読み取り、土地を面積降順にマージして返す
   */
  async extractFromPdfsForKodateKeiyaku(
    pdfs: Array<{ base64: string; fileName: string }>
  ): Promise<{ mergedResult: TokiKodateKeiyakuExtractResult; fileNames: string[] }> {
    if (pdfs.length === 0) throw new Error('謄本PDFが見つかりませんでした');

    // 1枚目を基準として使用（所有者情報・建物情報は1枚目から取得）
    const firstResult = await this.extractFromPdfForKodateKeiyaku(pdfs[0].base64);
    const fileNames = [pdfs[0].fileName];

    // 2枚目以降の土地情報をマージ
    for (let i = 1; i < pdfs.length; i++) {
      console.log(`[TokiKodateKeiyaku] ${i + 1}枚目解析中: ${pdfs[i].fileName}`);
      const result = await this.extractFromPdfForKodateKeiyaku(pdfs[i].base64);
      firstResult.lands.push(...result.lands);
      fileNames.push(pdfs[i].fileName);
    }

    // 土地を面積降順にソート（areaNumericがnullのものは末尾）
    firstResult.lands.sort((a, b) => {
      if (a.areaNumeric === null && b.areaNumeric === null) return 0;
      if (a.areaNumeric === null) return 1;
      if (b.areaNumeric === null) return -1;
      return b.areaNumeric - a.areaNumeric;
    });

    return { mergedResult: firstResult, fileNames };
  }

  /**
   * 戸建て用：抽出結果を「重説」シートの指定セルに書き込む
   */
  async writeToSpreadsheetForKodateKeiyaku(req: TokiKodateKeiyakuWriteRequest): Promise<void> {
    const { spreadsheetUrl, sheetName, extractResult } = req;

    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) throw new Error(`スプレッドシートIDの抽出に失敗しました: ${spreadsheetUrl}`);

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    const writes: Array<{ cell: string; value: string | boolean }> = [];

    const add = (cell: string, value: string | null | boolean) => {
      if (value !== null && value !== undefined) {
        writes.push({ cell, value: typeof value === 'boolean' ? value : String(value) });
      }
    };

    // nullでも空文字で上書き（既存値を消す必要がある場合）
    const addForce = (cell: string, value: string | null | boolean) => {
      if (typeof value === 'boolean') {
        writes.push({ cell, value });
      } else {
        writes.push({ cell, value: value !== null && value !== undefined ? String(value) : '' });
      }
    };

    // 謄本取得日
    add('AB89', extractResult.acquisitionYearWareki);
    add('AF80', extractResult.acquisitionMonth);
    add('AJ80', extractResult.acquisitionDay);

    // 所有者情報
    add('K36', extractResult.ownerAddress);
    add('K37', extractResult.ownerNames);
    add('AX37', extractResult.otherAddressOwnerCount);
    add('BF37', extractResult.totalOwnerCount);
    if (extractResult.ownerDetails !== null) {
      add('O85', extractResult.ownerDetails);
      add('F111', extractResult.ownerDetails);
    }
    add('V90', extractResult.ownerAddress);
    add('V91', extractResult.ownerNames);
    add('V104', extractResult.ownerAddress);
    add('V105', extractResult.ownerNames);

    // 共有持分チェック
    add('AY42', extractResult.hasSharedOwnership);

    // 土地情報（複数行対応：H42から2行おき）
    // スプレッドシートは各土地行が2行結合セルのため H42,H44,H46... と2行おき
    extractResult.lands.forEach((land, index) => {
      const row = 42 + index * 2;
      addForce(`H${row}`, land.location);
      addForce(`X${row}`, land.lotNumber);
      addForce(`AG${row}`, land.landType);
      addForce(`AR${row}`, land.area);
    });

    // 主である建物の表示
    add('O76', extractResult.buildingLocation);
    add('AV76', extractResult.houseNumber);
    add('O78', extractResult.buildingType);
    add('AZ77', extractResult.annexBuildings);
    add('O79', extractResult.structure);
    add('AI79', extractResult.roofType);
    add('BC79', extractResult.floors);
    add('R81', extractResult.floor1Area);
    add('AB81', extractResult.floor2Area);
    add('J84', extractResult.registrationDate);
    add('AE84', extractResult.extensionDate);
    add('AS84', extractResult.renovationDate);
    if (extractResult.hasExtension) {
      add('Z84', true);
      add('AA84', true);
    }
    if (extractResult.hasRenovation) {
      add('AN84', true);
      add('AO84', true);
    }

    // 乙区・権利チェック
    add('P96', extractResult.hasOtherRights);
    add('P102', extractResult.hasMortgage);
    add('P110', extractResult.hasMortgage);

    // V98〜V102: P102=trueの場合のみ残存権利をチェック
    if (extractResult.hasMortgage && extractResult.rightChecks96.length > 0) {
      const cells96 = ['V98', 'V99', 'V100', 'V101', 'V102'];
      cells96.forEach((cell) => add(cell, true));
    }
    // V112〜V115: P110=trueの場合のみ
    if (extractResult.hasMortgage && extractResult.rightChecks110.length > 0) {
      const cells110 = ['V112', 'V113', 'V114', 'V115'];
      cells110.forEach((cell) => add(cell, true));
    }

    console.log(`[TokiKodateKeiyaku] スプレッドシートへの書き込み開始: ${writes.length}セル`);

    for (const w of writes) {
      if (typeof w.value === 'boolean') {
        await sheetsClient.writeRawCell(w.cell, w.value ? 'TRUE' : 'FALSE');
      } else {
        await sheetsClient.writeRawCell(w.cell, w.value as string);
      }
      console.log(`[TokiKodateKeiyaku] 書き込み完了: ${w.cell} = ${w.value}`);
    }

    console.log('[TokiKodateKeiyaku] スプレッドシートへの書き込み完了');
  }

  // -------------------------------------------------------
  // プライベートヘルパー
  // -------------------------------------------------------

  private extractFolderIdFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private extractSpreadsheetId(url: string): string | null {
    try {
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
