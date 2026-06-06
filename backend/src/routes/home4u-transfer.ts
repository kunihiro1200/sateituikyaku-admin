// HOME4U査定依頼メール転記ルート
// 【変更ルール】このファイルはHOME4U専用。イエウール/アットホーム修正時は絶対に触らない。

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SpreadsheetSyncService } from '../services/SpreadsheetSyncService';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

/**
 * SpreadsheetSyncServiceを初期化して返す（Vercelサーバーレス対応）
 */
async function createSpreadsheetSyncService(): Promise<SpreadsheetSyncService | null> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await sheetsClient.authenticate();
    return new SpreadsheetSyncService(sheetsClient, supabase);
  } catch (err) {
    console.error('⚠️ [SpreadsheetSync] Failed to initialize SpreadsheetSyncService:', err);
    return null;
  }
}

/**
 * POST /api/sellers/home4u-transfer
 * HOME4Uメール本文を受け取り、DB即時転記 + DB→スプシ即時同期を行う
 * 本文に「HOME4Uログアウト」が含まれる場合のみ処理
 * CRON_SECRET認証（mail_notify.pyから呼び出される）
 */
router.post('/home4u-transfer', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { body: mailBody } = req.body;
  if (!mailBody || typeof mailBody !== 'string') {
    return res.status(400).json({ success: false, error: 'mailBody is required' });
  }

  // HOME4Uログアウトが含まれない場合はスキップ
  if (!mailBody.includes('HOME4Uログアウト')) {
    return res.json({ success: true, skipped: true, message: 'HOME4Uログアウトが含まれないためスキップ' });
  }

  try {
    console.log('[home4u-transfer] HOME4Uメール本文解析開始');

    // ============================================================
    // フォーマット判定・正規化
    // HOME4Uのメールには2種類のフォーマットが存在する:
    //
    // 【旧フォーマット】■ラベル形式（2026年6月以前の標準フォーマット）
    //   ■お名前　　　　　　　: 寺師　忠博
    //   ■電話番号　　　　　　: 09013411489
    //
    // 【新フォーマット】スペース区切り形式（2026年6月以降に確認された新フォーマット）
    //   査定ナンバー SA2606-XXXXXXX
    //   姓 寺師 名 忠博
    //   電話番号 09013411489
    //   物件都道府県 福岡県 物件市区町村 福岡市東区 ...
    //
    // 新フォーマットは「査定ナンバー」「姓 X 名 Y」のパターンで判定し、
    // ■形式に正規化してから既存のパース処理に渡す。
    // ============================================================
    let preprocessedBody = mailBody;

    // 新フォーマット判定：「査定ナンバー」かつ「姓 」パターンが含まれる
    const isNewFormat = /査定ナンバー\s+SA\d+/.test(mailBody) && /姓\s+\S/.test(mailBody);

    if (isNewFormat) {
      // 新フォーマット → ■形式に変換する
      console.log('[home4u-transfer] 新フォーマット（スペース区切り）を検出。■形式に正規化します');

      // まず全体を行に分割（改行あり・なし両対応）
      // 新フォーマットはスペース区切りで1行に詰まっている場合もある
      // 「査定ナンバー」「査定依頼日付」「査定依頼時刻」などのキーワード前で改行を挿入
      const newFormatKeywords = [
        '査定ナンバー', '査定依頼日付', '査定依頼時刻',
        '物件種別', '物件都道府県', '物件市区町村', '物件町字', '物件丁目番地号',
        '物件建物名', '物件号室', '専有延べ床面積', '土地面積', '間取り',
        '階数', '戸数', '築年', '現況', '賃料', '名義',
        '物件の名義人本人',
        '姓', 'カナ姓', '年齢', '電話番号2', 'メールアドレス',
        '査定依頼者郵便番号', '査定依頼者住所', '査定依頼者建物名号室',
        '不動産会社への要望', '査定の理由', 'ご希望', '売却の希望時期',
        '査定方法', 'ご要望ご質問',
      ];
      // キーワードの前に改行を挿入（スペース区切りを行区切りに変換）
      let normalized = mailBody;
      for (const kw of newFormatKeywords) {
        // キーワードが行頭にない場合、前に改行を挿入
        normalized = normalized.replace(new RegExp('(?<!\\n)' + kw + '(?=\\s+\\S)', 'g'), '\n' + kw);
      }
      // 「電話番号 XXXXXXX」の前にも改行（「電話番号2」より先にマッチしないよう注意）
      normalized = normalized.replace(/(?<!\n)電話番号(?!2)(?=\s+\d)/g, '\n電話番号');
      // 「名 X」の前に改行（「物件の名義人本人」の後の「姓 X 名 Y」対応）
      normalized = normalized.replace(/(?<=姓\s+\S+)\s+名\s+/g, '\n名 ');

      // 行ごとに ■形式に変換
      const lines = normalized.split('\n');
      const convertedLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) { convertedLines.push(''); continue; }

        // 新フォーマットの各パターンを ■形式に変換
        // 「査定ナンバー SA2606-XXXXXXX」→「■査定ナンバー　　　　　: SA2606-XXXXXXX」
        const m_sateiNo = line.match(/^査定ナンバー\s+(.+)/);
        if (m_sateiNo) { convertedLines.push('■査定ナンバー　　　　　: ' + m_sateiNo[1].trim()); continue; }

        // 「査定依頼日付 2026/06/02 査定依頼時刻 18:02:37」→「■ご依頼日　　　　　　　: 2026/06/02 18:02:37」
        const m_date = line.match(/^査定依頼日付\s+(\d{4}\/\d{2}\/\d{2})/);
        if (m_date) {
          const timeMatch = line.match(/査定依頼時刻\s+(\d{2}:\d{2}:\d{2})/);
          const timeStr = timeMatch ? ' ' + timeMatch[1] : '';
          convertedLines.push('■ご依頼日　　　　　　　: ' + m_date[1] + timeStr);
          continue;
        }

        // 「物件種別 一戸建て」→「■物件種別　　　　　　　: 一戸建て」
        const m_type = line.match(/^物件種別\s+(.+)/);
        if (m_type) { convertedLines.push('■物件種別　　　　　　　: ' + m_type[1].trim()); continue; }

        // 「物件都道府県 福岡県 物件市区町村 福岡市東区 物件町字 西戸崎 物件丁目番地号 2丁目4-17」
        // → 「■物件所在地　　　　　　: 福岡県福岡市東区西戸崎2丁目4-17」に結合
        const m_pref = line.match(/^物件都道府県\s+(\S+)/);
        if (m_pref) {
          const pref = m_pref[1];
          const city = (line.match(/物件市区町村\s+(\S+)/) || [])[1] || '';
          const town = (line.match(/物件町字\s+(\S+)/) || [])[1] || '';
          const block = (line.match(/物件丁目番地号\s+(\S+)/) || [])[1] || '';
          const bldg = (line.match(/物件建物名\s+(\S+)/) || [])[1] || '';
          const roomNo = (line.match(/物件号室\s+(\S+)/) || [])[1] || '';
          const addr = [pref, city, town, block, bldg !== '物件建物名' ? bldg : '', roomNo !== '物件号室' ? roomNo : ''].join('').replace(/\s+/g, '');
          convertedLines.push('■物件所在地　　　　　　: ' + addr);
          continue;
        }
        // 物件詳細キーワード単独行はスキップ（上のm_prefで既に処理済み）
        if (/^(物件建物名|物件号室|物件市区町村|物件町字|物件丁目番地号)\s/.test(line)) continue;

        // 「専有延べ床面積 198 平米」→「■建物（専有）面積　　　: 198 平米」
        const m_bldgArea = line.match(/^専有延べ床面積\s+(\S+)/);
        if (m_bldgArea) { convertedLines.push('■建物（専有）面積　　　: ' + m_bldgArea[1] + ' 平米'); continue; }

        // 「土地面積 116 平米」→「■土地面積　　　　　　　: 116 平米」
        const m_landArea = line.match(/^土地面積\s+(\S+)/);
        if (m_landArea) { convertedLines.push('■土地面積　　　　　　　: ' + m_landArea[1] + ' 平米'); continue; }

        // 「間取り 3LK/3LDK」→「■間取り　　　　　　　　: 3LK/3LDK」
        const m_layout = line.match(/^間取り\s+(.+)/);
        if (m_layout) { convertedLines.push('■間取り　　　　　　　　: ' + m_layout[1].trim()); continue; }

        // 「築年 2005 年」→「■築年（西暦）　　　　　: 2005 年」
        const m_year = line.match(/^築年\s+(\d+)/);
        if (m_year) { convertedLines.push('■築年（西暦）　　　　　: ' + m_year[1] + ' 年'); continue; }

        // 「現況 居住中」→「■現況　　　　　　　　　: 居住中」
        const m_status = line.match(/^現況\s+(.+)/);
        if (m_status) { convertedLines.push('■現況　　　　　　　　　: ' + m_status[1].trim()); continue; }

        // 「名義 物件の名義人本人」→ スキップ（不要）
        if (/^名義\s+/.test(line)) continue;

        // 「姓 寺師」→ 次行の「名 忠博」と組み合わせて「■お名前　　　　　　　: 寺師 忠博」
        const m_sei = line.match(/^姓\s+(\S+)/);
        if (m_sei) {
          // 同一行に「名 X」がある場合（スペースで並んでいる場合）
          const m_mei_inline = line.match(/名\s+(\S+)/);
          if (m_mei_inline) {
            convertedLines.push('■お名前　　　　　　　: ' + m_sei[1] + '　' + m_mei_inline[1]);
          } else {
            // 次行で「名 X」を探す（行分割済み想定）
            convertedLines.push('■お名前　　　　　　　: ' + m_sei[1] + '　__MEI_PLACEHOLDER__');
          }
          continue;
        }
        // 「名 忠博」→ 直前行のプレースホルダーを置換
        const m_mei = line.match(/^名\s+(\S+)/);
        if (m_mei) {
          // 直前行にプレースホルダーがあれば置換
          if (convertedLines.length > 0 && convertedLines[convertedLines.length - 1].includes('__MEI_PLACEHOLDER__')) {
            convertedLines[convertedLines.length - 1] = convertedLines[convertedLines.length - 1].replace('__MEI_PLACEHOLDER__', m_mei[1]);
          }
          continue;
        }

        // 「カナ姓 テラシ カナ名 タダヒロ」→「■フリガナ　　　　　　　: テラシ タダヒロ」
        const m_kana = line.match(/^カナ姓\s+(\S+)/);
        if (m_kana) {
          const kanaName = (line.match(/カナ名\s+(\S+)/) || [])[1] || '';
          convertedLines.push('■フリガナ　　　　　　　: ' + m_kana[1] + (kanaName ? '　' + kanaName : '')); continue;
        }

        // 「年齢 58」→「■年齢　　　　　　　　　: 58 歳」
        const m_age = line.match(/^年齢\s+(\d+)/);
        if (m_age) { convertedLines.push('■年齢　　　　　　　　　: ' + m_age[1] + ' 歳'); continue; }

        // 「電話番号 09013411489」→「■電話番号　　　　　　　: 09013411489」
        const m_tel = line.match(/^電話番号(?!2)\s+(\d+)/);
        if (m_tel) { convertedLines.push('■電話番号　　　　　　　: ' + m_tel[1]); continue; }

        // 「電話番号2 XXXXXXX」→「■第二電話番号（任意）　: XXXXXXX」
        const m_tel2 = line.match(/^電話番号2\s+(\S+)/);
        if (m_tel2) { convertedLines.push('■第二電話番号（任意）　: ' + m_tel2[1]); continue; }

        // 「メールアドレス xxx@xxx.com」→「■E-mail　　　　　　　　: xxx@xxx.com」
        const m_email = line.match(/^メールアドレス\s+(\S+)/);
        if (m_email) { convertedLines.push('■E-mail　　　　　　　　: ' + m_email[1]); continue; }

        // 「査定依頼者住所 福岡県...」→「■ご住所　　　　　　　　: / 　　　　　　　　　　　　: 福岡県...」形式に変換
        const m_addr = line.match(/^査定依頼者住所\s+(.+)/);
        if (m_addr) {
          convertedLines.push('■ご住所　　　　　　　　:');
          convertedLines.push('　　　　　　　　　　　　: ' + m_addr[1].trim());
          continue;
        }

        // 「査定の理由 住み替え／...」→「■査定の理由　　　　　　: 住み替え／...」
        const m_reason = line.match(/^査定の理由\s+(.+)/);
        if (m_reason) { convertedLines.push('■査定の理由　　　　　　: ' + m_reason[1].trim()); continue; }

        // 「売却の希望時期 条件があえばいつでも良い」→「■売却の希望時期　　　　: 条件があえばいつでも良い」
        const m_timing = line.match(/^売却の希望時期\s+(.+)/);
        if (m_timing) { convertedLines.push('■売却の希望時期　　　　: ' + m_timing[1].trim()); continue; }

        // 「査定方法 机上査定（簡易査定）」→「■査定方法　　　　　　　: 机上査定（簡易査定）」
        const m_method = line.match(/^査定方法\s+(.+)/);
        if (m_method) { convertedLines.push('■査定方法　　　　　　　: ' + m_method[1].trim()); continue; }

        // その他の行はそのまま保持
        convertedLines.push(rawLine);
      }

      preprocessedBody = convertedLines.join('\n');
      console.log('[home4u-transfer] 新フォーマット正規化完了');

    } else {
      // 旧フォーマット（■形式）: 改行が少ない場合の前処理
      const hasEnoughNewlines = (mailBody.match(/\n/g) || []).length >= 10;
      if (!hasEnoughNewlines) {
        // ■の前に改行を挿入
        preprocessedBody = mailBody.replace(/■/g, '\n■');
        // 「HOME4Uログアウト」の後にも改行を挿入
        preprocessedBody = preprocessedBody.replace(/HOME4Uログアウト/g, 'HOME4Uログアウト\n');
        // 「査定依頼 株式会社」の前にも改行を挿入
        preprocessedBody = preprocessedBody.replace(/査定依頼 株式会社/g, '\n査定依頼 株式会社');
        // 区切り線の前後に改行を挿入
        preprocessedBody = preprocessedBody.replace(/-{10,}/g, '\n-----------------------------------------------------------------\n');
        console.log('[home4u-transfer] 改行不足テキストを前処理しました');
      }
    }

    // 改行で統一し、行頭の引用符（> ）のみ除去（行中の > は残す）
    const cleanedBody = preprocessedBody
      .replace(/\r\n|\n\r|\n|\r/g, '\n')
      .replace(/^>\s*/gm, '');  // 行頭の > を除去（multiline mode）

    const extractData2 = (text: string, keyword: string): string => {
      // [^\n\r]* で0文字以上にマッチ（空欄の場合も正しく空文字を返す）
      const regex = new RegExp(keyword + '\\s*[：:]\\s*([^\\n\\r]*)');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    const extractData = (text: string, from: string, to: string): string => {
      const fromIndex = text.indexOf(from);
      if (fromIndex === -1) return '';
      const start = fromIndex + from.length;
      const toIndex = text.indexOf(to, start);
      return text.substring(start, toIndex === -1 ? text.length : toIndex).trim();
    };

    const extractNumeric = (str: string): string => {
      if (!str) return '';
      const m = str.match(/(\d+(?:\.\d+)?)/);
      return m ? m[1] : '';
    };

    // メモ抽出：「HOME4Uログアウト」と「査定依頼」の間にある文字列をそのまま取得
    // 例:
    //   HOME4Uログアウト
    //   林5/26　不通・留守×
    //   査定依頼 株式会社威風...
    //   → "林5/26　不通・留守×" を返す
    const extractMemo = (text: string): string => {
      // 行頭の引用符（> ）を除去
      const cleaned = text.replace(/^[>\s]*/gm, '');
      // 「HOME4Uログアウト」以降を取得
      const afterLogout = cleaned.split('HOME4Uログアウト')[1];
      if (!afterLogout) return '';
      // 「査定依頼」が現れる手前までを取得
      const beforeSateiIrai = afterLogout.split(/査定依頼/)[0];
      // 空白・改行を整理して返す
      return beforeSateiIrai.trim();
    };
    const memo = extractMemo(cleanedBody);
    console.log(`[home4u-transfer] memo抽出結果: "${memo}"`);
    // HOME4Uログアウト周辺の行をデバッグ出力（コメント取得問題の診断用）
    const debugLines = cleanedBody.split('\n');
    const debugIdx = debugLines.findIndex(l => l.trim() === 'HOME4Uログアウト' || l.trim().startsWith('HOME4Uログアウト'));
    if (debugIdx !== -1) {
      const surrounding = debugLines.slice(Math.max(0, debugIdx - 1), debugIdx + 6);
      console.log(`[home4u-transfer] HOME4Uログアウト周辺行: ${JSON.stringify(surrounding)}`);
    }
    console.log(`[home4u-transfer] 本文先頭300文字: ${cleanedBody.substring(0, 300).replace(/\n/g, '\\n')}`);

    // 依頼日時（曜日部分を除去して解析）
    const inquiryMatch = cleanedBody.match(/■ご依頼日\s*[:：]\s*([^\n\r]+)/);
    const inquiryDateTimeRaw = inquiryMatch ? inquiryMatch[1].trim() : '';
    // 「2026/05/17 (日) 20:10:11」→「2026/05/17 20:10:11」に変換
    const inquiryDateTime = inquiryDateTimeRaw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    // PostgreSQL TIMESTAMP型用にISO形式へ変換（「2026/05/30 06:07:14」→「2026-05-30T06:07:14」）
    const inquiryDateTimeISO = inquiryDateTime
      ? inquiryDateTime.replace(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2}:\d{2})$/, '$1-$2-$3T$4')
      : null;
    const inquiryDateObj = inquiryDateTime ? new Date(inquiryDateTime.replace(/\//g, '-')) : new Date();

    // 物件種別
    const propertyTypeRaw = extractData2(cleanedBody, '■物件種別');
    let displayPropertyType = propertyTypeRaw;
    if (propertyTypeRaw.includes('一戸建て')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';

    // 物件情報
    const landArea = extractData2(cleanedBody, '■土地面積').replace(/[^\d.]/g, '');
    const buildingArea = extractData2(cleanedBody, '■建物（専有）面積').replace(/[^\d.]/g, '');
    const layout = extractData2(cleanedBody, '■間取り');
    const builtYear = extractData2(cleanedBody, '■築年（西暦）').replace(/[^\d]/g, '');
    const currentStatusRaw = extractData2(cleanedBody, '■現況');
    const convertStatus = (s: string) => {
      if (!s) return '';
      if (s.includes('居住中')) return '居';
      if (s.includes('空き')) return '空';
      if (s.includes('賃貸')) return '賃';
      return '他';
    };
    const propertyStatus = convertStatus(currentStatusRaw);

    // 物件住所（大分県を除去）
    let propertyAddress = extractData2(cleanedBody, '■物件所在地').replace(/^大分県/, '').trim();

    // ユーザ情報
    const furigana = extractData2(cleanedBody, '■フリガナ');
    const name = extractData2(cleanedBody, '■お名前');
    const age = extractData2(cleanedBody, '■年齢');
    const tel = extractData2(cleanedBody, '■電話番号').replace(/-/g, '');
    const secondTel = extractData2(cleanedBody, '■第二電話番号（任意）');
    const email = extractData2(cleanedBody, '■E-mail');
    const assessmentReason = extractData2(cleanedBody, '■査定の理由');
    const desiredSaleTime = extractData2(cleanedBody, '■売却の希望時期');
    const assessmentMethod = extractData2(cleanedBody, '■査定方法');
    const requests = extractData(cleanedBody, '■要望・質問（自由記入）:', '-----------------------------------------------------------------').trim();

    // 住所（■ご住所の後の行）
    const addrSection = extractData(cleanedBody, '■ご住所', '■電話番号').trim();
    const addrLines = addrSection.split('\n').map(l => l.replace(/^[：:]\s*/, '').trim()).filter(l => l);
    const address = addrLines.join(' ').trim();

    if (!name || !tel) {
      return res.status(400).json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // ============================================================
    // 重複チェック（同一電話番号 かつ 同一反響日時の場合のみスキップ）
    // HOME4Uは1つの査定依頼を複数社に同時配信するため、
    // 同じ電話番号+同じ反響日時のメールが短時間に複数届く。
    // 過去に同じ人から別の時期に依頼が来た場合は新規登録する
    // ============================================================
    {
      const { decrypt: decryptForCheck } = await import('../utils/encryption');
      const supabaseForCheck = (await import('../config/supabase')).default;

      const { data: allSellers, error: fetchError } = await supabaseForCheck
        .from('sellers')
        .select('id, seller_number, phone_number, inquiry_detailed_datetime, created_at')
        .is('deleted_at', null);

      if (!fetchError && allSellers) {
        for (const existing of allSellers) {
          if (!existing.phone_number) continue;
          try {
            const decryptedPhone = decryptForCheck(existing.phone_number);
            if (decryptedPhone === tel) {
              // 電話番号が一致しても、反響日時が異なれば別依頼として登録する
              const existingDatetime = existing.inquiry_detailed_datetime;

              // 比較1: 反響日時が同一（タイムゾーン差を吸収するためstartsWith使用）
              const isSameDatetime = existingDatetime && inquiryDateTimeISO
                ? existingDatetime === inquiryDateTimeISO || existingDatetime.startsWith(inquiryDateTimeISO)
                : !existingDatetime && !inquiryDateTimeISO;

              // 比較2: 同じ電話番号で直近10分以内に登録されたレコードがある場合もスキップ
              // （HOME4Uは同じ案件を複数社に配信するため、短時間に同内容のメールが複数届く）
              const createdAt = existing.created_at ? new Date(existing.created_at) : null;
              const now = new Date();
              const isRecentDuplicate = createdAt && (now.getTime() - createdAt.getTime()) < 10 * 60 * 1000; // 10分以内

              if (isSameDatetime || isRecentDuplicate) {
                const reason = isSameDatetime ? '反響日時一致' : '直近10分以内に同一電話番号で登録済み';
                console.log(`[home4u-transfer] ⏭ 重複スキップ: ${reason} (既存: ${existing.seller_number})`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ: ${reason} - 既存売主 ${existing.seller_number}`,
                  duplicateSeller: existing.seller_number,
                });
              } else {
                console.log(`[home4u-transfer] ℹ️ 同一電話番号 ${existing.seller_number} だが反響日時が異なるため新規登録します`);
              }
            }
          } catch {
            // 復号失敗はスキップ
          }
        }
      }
    }

    // コメント作成
    const commentParts: string[] = [];
    if (furigana) commentParts.push(`フリガナ: ${furigana}`);
    if (age) commentParts.push(`年齢: ${age}`);
    if (assessmentReason) commentParts.push(`査定理由: ${assessmentReason}`);
    if (desiredSaleTime) commentParts.push(`売却希望時期: ${desiredSaleTime}`);
    if (requests) commentParts.push(`要望: ${requests}`);
    if (assessmentMethod) commentParts.push(`査定方法: ${assessmentMethod}`);
    if (secondTel) commentParts.push(`第２電話: ${secondTel}`);
    const comments = `${memo}\n【以下自動転記（HOME4U）】\n${commentParts.join('\n')}`;
    console.log(`[home4u-transfer] comments作成完了: "${comments.substring(0, 100)}"`);

    // 売主番号採番（連番スプシから）
    const isFukuoka = propertyAddress.includes('福岡');
    const prefix = isFukuoka ? 'FI' : 'AA';
    const serialCell = isFukuoka ? 'I2' : 'C2';

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const serialSheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await serialSheetsClient.authenticate();
    // 現在値を読んで+1した値を書き込む（重複時はリトライ）
    let sellerNumber = '';
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      const serialValues = await serialSheetsClient.readRawRange(serialCell);
      const currentNum = parseInt(String(serialValues?.[0]?.[0] || '0'), 10);
      const newNum = currentNum + 1;
      sellerNumber = `${prefix}${newNum}`;
      await serialSheetsClient.updateRawCell('連番', serialCell, newNum);

      // 既に同じ番号がDBに存在するか確認
      const supabaseCheck = (await import('../config/supabase')).default;
      const { data: existing } = await supabaseCheck
        .from('sellers')
        .select('id')
        .eq('seller_number', sellerNumber)
        .maybeSingle();

      if (!existing) break; // 重複なし → 採番成功
      console.log(`[home4u-transfer] ⚠️ ${sellerNumber} は既に存在。リトライ ${retryCount + 1}/${maxRetries}`);
      retryCount++;
    }
    console.log(`[home4u-transfer] 売主番号採番: ${sellerNumber}`);

    // ============================================================
    // INSERT直前に再度重複チェック（非同期スレッドの競合防止）
    // trigger_home4u_transferが並行して呼ばれた場合、最初の重複チェック時には
    // まだDBに登録されていないため両方が通過してしまう。INSERT直前に再チェックすることで防ぐ。
    // ============================================================
    {
      const { decrypt: decryptForFinal } = await import('../utils/encryption');
      const supabaseFinal = (await import('../config/supabase')).default;
      const { data: finalCheck } = await supabaseFinal
        .from('sellers')
        .select('id, seller_number, phone_number, inquiry_detailed_datetime')
        .is('deleted_at', null);
      if (finalCheck) {
        for (const existing of finalCheck) {
          if (!existing.phone_number) continue;
          try {
            const decryptedPhone = decryptForFinal(existing.phone_number);
            if (decryptedPhone === tel) {
              const existingDatetime = existing.inquiry_detailed_datetime;
              const isSameDatetime = existingDatetime && inquiryDateTimeISO
                ? existingDatetime === inquiryDateTimeISO || existingDatetime.startsWith(inquiryDateTimeISO.replace(' ', 'T'))
                : !existingDatetime && !inquiryDateTimeISO;
              if (isSameDatetime) {
                console.log(`[home4u-transfer] ⏭ INSERT直前再チェックで重複スキップ: ${existing.seller_number}`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ（INSERT直前）: ${existing.seller_number} と一致`,
                  duplicateSeller: existing.seller_number,
                });
              }
            }
          } catch {
            // 復号失敗はスキップ
          }
        }
      }
    }

    // DB INSERT
    const { encrypt } = await import('../utils/encryption');
    const supabase = (await import('../config/supabase')).default;

    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const mm = String(jstToday.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstToday.getUTCDate()).padStart(2, '0');
    const nextCallDate = `${jstToday.getUTCFullYear()}-${mm}-${dd}`;
    const inquiryDateISO = inquiryDateObj instanceof Date && !isNaN(inquiryDateObj.getTime())
      ? inquiryDateObj.toISOString().split('T')[0]
      : nextCallDate;
    const inquiryYear = inquiryDateObj instanceof Date && !isNaN(inquiryDateObj.getTime())
      ? inquiryDateObj.getFullYear()
      : jstToday.getUTCFullYear();

    const insertData: Record<string, any> = {
      seller_number: sellerNumber,
      name: encrypt(name),
      address: address ? encrypt(address) : null,
      phone_number: encrypt(tel),
      email: email ? encrypt(email) : null,
      property_address: propertyAddress,
      property_type: displayPropertyType,
      inquiry_site: 'H',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: inquiryDateTimeISO ? inquiryDateTimeISO : null,
      floor_plan: layout || null,
      build_year: builtYear ? parseInt(builtYear) : null,
      current_status: propertyStatus || null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
      valuation_reason: assessmentReason || null,
      is_unreachable: false,
      duplicate_confirmed: false,
    };

    const { data: seller, error: insertError } = await supabase
      .from('sellers')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !seller) {
      console.error('[home4u-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[home4u-transfer] DB INSERT成功: ${sellerNumber}`);

    // propertiesテーブル用のproperty_type変換（マ→マンション等）
    const propertyTypeForDB = displayPropertyType === 'マ' ? 'マンション'
      : displayPropertyType === '戸' ? '戸建て'
      : displayPropertyType === '土' ? '土地'
      : displayPropertyType || null;

    // propertiesテーブルにも登録
    await supabase.from('properties').insert({
      seller_id: seller.id,
      property_address: propertyAddress,
      property_type: propertyTypeForDB,
      floor_plan: layout || null,
      construction_year: builtYear ? parseInt(builtYear) : null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
    });

    // DB INSERT完了後すぐにレスポンスを返す（スプシ同期はバックグラウンドで実行）
    res.json({
      success: true,
      sellerNumber,
      sellerId: seller.id,
      message: `${sellerNumber} をDBに登録しました`,
    });

    // ① サイドバーカウントを最優先で即時更新（未着手カテゴリーへの反映）
    import('../services/SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseForCounts = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      const updateService = new SellerSidebarCountsUpdateService(supabaseForCounts);
      updateService.updateSellerSidebarCounts().catch((e: any) =>
        console.error('⚠️ [home4u-transfer] SidebarCounts update error:', e)
      );
    });

    // ② DB→スプシ同期（バックグラウンド実行 - サイドバー更新の後）
    createSpreadsheetSyncService().then(syncService => {
      if (!syncService) return;
      syncService.syncToSpreadsheet(seller.id)
        .then(syncResult => {
          if (syncResult.success) {
            console.log(`[home4u-transfer] スプシ同期成功: ${sellerNumber}`);
          } else {
            console.warn(`[home4u-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
          }
        })
        .catch((syncErr: any) => {
          console.warn(`[home4u-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
        });
    }).catch((syncErr: any) => {
      console.warn(`[home4u-transfer] スプシ同期初期化エラー（DB登録は成功）: ${syncErr.message}`);
    });

  } catch (error: any) {
    console.error('[home4u-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
