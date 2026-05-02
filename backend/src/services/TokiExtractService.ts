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
// 謄本解析サービス
// -------------------------------------------------------

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

      // 「全部事項」を含むPDFを検索
      const tokiFile = files.find(
        (f) =>
          f.name.includes('全部事項') &&
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

    if (!isManshon) {
      // マンション以外は今後対応
      return null;
    }

    if (mediationType === '専任媒介') {
      return '専任媒介契建物（売却)';
    }
    if (mediationType === '一般媒介') {
      return '一般媒介契建物（売却)';
    }

    return null;
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
