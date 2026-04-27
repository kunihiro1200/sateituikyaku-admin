import { EmailService } from './EmailService.supabase';

// ============================================================
// インターフェース定義
// ============================================================

/** メール送信ルールの定義 */
export interface EmailRule {
  /** トリガーフィールド名（DBカラム名） */
  triggerField: string;
  /** 宛先メールアドレス */
  to: string;
  /** CCメールアドレス */
  cc?: string;
  /** 件名テンプレート（{変数名}形式） */
  subjectTemplate: string;
  /** 本文テンプレート（{変数名}形式、テキストまたはHTML） */
  bodyTemplate: string;
  /** HTML形式かどうか（デフォルト: false） */
  isHtml?: boolean;
}

/** テンプレート変数のカラムマッピング */
export interface TemplateVariableMapping {
  [templateVar: string]: string; // テンプレート変数名 → DBカラム名
}

// ============================================================
// テンプレート変数マッピング定数
// ============================================================

/**
 * テンプレート変数（{変数名}）とDBカラム名のマッピング
 * Requirements: 4.2
 */
export const TEMPLATE_VARIABLE_MAP: TemplateVariableMapping = {
  '{物件番号}': 'property_number',
  '{物件所在}': 'property_address',
  '{コメント（間取図関係）}': 'floor_plan_comment',
  '{道路寸法}': 'road_dimensions',
  '{間取図完了予定}': 'floor_plan_due_date',
  '{格納先URL}': 'storage_url',
  '{間取図確認OK/修正コメント}': 'floor_plan_ok_comment',
  '{コメント（サイト登録）}': 'site_registration_comment',
  '{サイト登録依頼日}': '__today_jst__',
  '{サイト登録依頼者}': 'site_registration_requester',
  '{サイト登録納期予定日}': 'site_registration_due_date',
  '{パノラマ}': 'panorama',
  '{スプシURL}': 'spreadsheet_url',
  '{サイト登録確認OKコメント}': 'site_registration_ok_comment',
};

// ============================================================
// メール送信ルール配列（全6ルール）
// ============================================================

/** 間取図・区画図依頼メールの本文テンプレート（テキスト形式） */
const FLOOR_PLAN_REQUEST_BODY = [
  '阿曽様',
  'お世話になっております。',
  '間取図OR区画図作成お願いします。',
  '物件番号：{物件番号}',
  '物件所在地：{物件所在}',
  '',
  'コメント：{コメント（間取図関係）}',
  '{道路寸法行}',
  '当社の希望納期：{間取図完了予定}',
  '格納先：{格納先URL}',
  '納期が難しかったり、ご不明点等がございましたら、こちらに返信していただければと思います。',
  '㈱いふう',
  'TEL:097-533-2022',
  'MAIL:tenant@ifoo-oita.com',
].join('\n');

/** 間取図確認OKメールの本文テンプレート（テキスト形式） */
const FLOOR_PLAN_OK_BODY = [
  '阿曽様',
  'お世話になっております。',
  '間取図OR区画図作成ありがとうございます。{間取図確認OK/修正コメント}',
  '物件番号：{物件番号}',
  '物件所在地：{物件所在}',
  'ご不明点等がございましたら、こちらに返信していただければと思います。',
  '㈱いふう',
  'TEL:097-533-2022',
  'MAIL:tenant@ifoo-oita.com',
].join('\n');

/** サイト登録依頼メールの本文テンプレート（HTML形式） */
const SITE_REGISTRATION_REQUEST_BODY =
  '<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, \'Noto Sans JP\', sans-serif;font-size:14px;line-height:1.4;">' +
  '浅沼様<br>お世話になっております。<br>サイト登録関係お願いします。<br>' +
  '物件番号：{物件番号}<br>' +
  'コメント：{コメント（サイト登録）}<br>' +
  '{メール配信コメント}' +
  '物件所在地：{物件所在}<br>' +
  '当社依頼日：{サイト登録依頼日} {サイト登録依頼者}<br>' +
  '当社の希望納期：{サイト登録納期予定日}<br>' +
  '{パノラマ行}' +
  '間取図格納時期：{間取図完了予定}<br>' +
  '詳細：<a href="{スプシURL}">スプレッドシート</a><br>' +
  '格納先：<a href="{格納先URL}">格納先フォルダ</a><br>' +
  'ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>' +
  '㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com' +
  '</body></html>';

/** サイト登録確認OKメールの本文テンプレート（HTML形式） */
const SITE_REGISTRATION_OK_BODY =
  '<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, \'Noto Sans JP\', sans-serif;font-size:14px;line-height:1.4;">' +
  '浅沼様<br>お世話になっております。<br>サイト登録ありがとうございました。OKでした。<br>' +
  '{サイト登録確認OKコメント}<br>' +
  '物件番号：{物件番号}<br>' +
  '物件所在地：{物件所在}<br>' +
  '詳細：<a href="{スプシURL}">スプレッドシート</a><br>' +
  'ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>' +
  '㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com' +
  '</body></html>';

/** 間取図格納済み連絡メールの本文テンプレート（HTML形式） */
const FLOOR_PLAN_STORED_BODY =
  '<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, \'Noto Sans JP\', sans-serif;font-size:14px;line-height:1.4;">' +
  '浅沼様<br>お世話になっております。<br>間取図格納済みです。<br>' +
  '{格納先URL}<br>' +
  '物件番号：{物件番号}<br>' +
  '物件所在地：{物件所在}<br>' +
  '当社依頼日：{サイト登録依頼日} {サイト登録依頼者}<br>' +
  '当社の希望納期：{サイト登録納期予定日}<br>' +
  '{パノラマ行}' +
  '詳細：<a href="{スプシURL}">スプレッドシート</a><br>' +
  'ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>' +
  '㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com' +
  '</body></html>';

/**
 * メール送信ルール配列（全6ルール）
 * Requirements: 5.1, 5.2, 5.3
 */
export const EMAIL_RULES: EmailRule[] = [
  // ルール1: CWの方へ依頼メール（間取り、区画図）【テスト中: 本来の宛先 freetask.e72@gmail.com】
  {
    triggerField: 'cw_request_email_floor_plan',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: '間取図作成関係お願いいたします！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: FLOOR_PLAN_REQUEST_BODY,
    isHtml: false,
  },
  // ルール2: CWの方へ依頼メール（2階以上）【テスト中: 本来の宛先 freetask.e72@gmail.com】
  {
    triggerField: 'cw_request_email_2f_above',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: '間取図作成関係お願いいたします！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: FLOOR_PLAN_REQUEST_BODY,
    isHtml: false,
  },
  // ルール3: 間取図確認OK送信【テスト中: 本来の宛先 freetask.e72@gmail.com】
  {
    triggerField: 'floor_plan_ok_sent',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: '図面ありがとうございます！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: FLOOR_PLAN_OK_BODY,
    isHtml: false,
  },
  // ルール4: CWの方へ依頼メール（サイト登録）【テスト中: 本来の宛先 shiraishi8biz@gmail.com】
  {
    triggerField: 'cw_request_email_site',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: 'サイト登録関係お願いいたします！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: SITE_REGISTRATION_REQUEST_BODY,
    isHtml: true,
  },
  // ルール5: サイト登録確認OK送信【テスト中: 本来の宛先 shiraishi8biz@gmail.com】
  {
    triggerField: 'site_registration_ok_sent',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: 'サイト登録ありがとうございます！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: SITE_REGISTRATION_OK_BODY,
    isHtml: true,
  },
  // ルール6: 間取図格納済み連絡メール【テスト中: 本来の宛先 shiraishi8biz@gmail.com】
  {
    triggerField: 'floor_plan_stored_notification',
    to: 'tomoko.kunihiro@ifoo-oita.com',
    cc: undefined,
    subjectTemplate: '間取図格納済みです！{物件番号}{物件所在}（㈱いふう）',
    bodyTemplate: FLOOR_PLAN_STORED_BODY,
    isHtml: true,
  },
  // ルール7: 山本マネージャーへの契約書確認完了メール
  {
    triggerField: 'manager_confirmation_done',
    to: 'yuuko.yamamoto@ifoo-oita.com',
    subjectTemplate: '{物件住所}/{担当名}の契約書関係の確認ありがとうございました！',
    bodyTemplate: '__manager_confirmation_body__',
    isHtml: false,
  },
];

// ============================================================
// WorkTaskEmailNotificationService クラス
// ============================================================

/**
 * 業務リストの特定フィールド変更を検知して自動メールを送信するサービス
 * Requirements: 5.1, 5.2, 5.3
 */
export class WorkTaskEmailNotificationService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * テンプレート変数を解決する（純粋関数）
   * {変数名} 形式のプレースホルダーをDBカラム値に置換する。
   * null・空文字の場合は空文字に置換する（エラーにしない）。
   * Requirements: 4.1, 4.2, 4.4
   */
  resolveTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [templateVar, columnName] of Object.entries(TEMPLATE_VARIABLE_MAP)) {
      let value: string;
      if (columnName === '__today_jst__') {
        // 送信当日のJST日付（YYYY-MM-DD）
        value = this.formatDateToJST(new Date().toISOString()).split(' ')[0];
      } else if (columnName === 'floor_plan_due_date' || columnName === 'site_registration_due_date') {
        const rawDate = data[columnName];
        // ISO形式（T含む）はJST変換、スラッシュ/ハイフン形式はそのまま表示
        if (rawDate && String(rawDate).includes('T')) {
          value = this.formatDateToJST(rawDate);
        } else {
          value = rawDate == null ? '' : String(rawDate);
        }
      } else {
        const rawValue = data[columnName];
        value = rawValue == null ? '' : String(rawValue);
      }
      result = result.split(templateVar).join(value);
    }

    // {メール配信コメント} を動的に解決
    const emailDist: string = data['email_distribution'] ?? '';
    let emailDistComment = '';
    if (emailDist.includes('即') && emailDist.includes('不要')) {
      emailDistComment =
        '公開前配信メールは不要です。確認前に公開お願い致します。公開方法→' +
        'https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing<br>';
    } else if (emailDist === '新着配信、即公開（期日関係無）') {
      emailDistComment =
        '公開前配信メールを「新着配信」に変更して、同時に公開もお願い致します。公開方法→' +
        'https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing<br>';
    }
    result = result.split('{メール配信コメント}').join(emailDistComment);

    // {パノラマ行} を動的に解決（空なら非表示、値があれば「パノラマ：あり」）
    const panoramaValue: string = data['panorama'] ?? '';
    const panoramaLine = panoramaValue.trim() !== '' ? 'パノラマ：あり<br>' : '';
    result = result.split('{パノラマ行}').join(panoramaLine);

    // {道路寸法行} を動的に解決（種別=「土」かつ値がある場合のみ表示）
    const roadDimValue: string = data['road_dimensions'] ?? '';
    const propertyTypeValue: string = data['property_type'] ?? '';
    const isLandType = propertyTypeValue.trim() === '土';
    const roadDimLine = (isLandType && roadDimValue.trim() !== '') ? roadDimValue : '';
    result = result.split('{道路寸法行}').join(roadDimLine);

    // __manager_confirmation_body__ を動的に解決（山本マネージャー確認メール本文）
    if (result.includes('__manager_confirmation_body__')) {
      const address: string = data['property_address'] ?? '';
      const assignee: string = data['sales_assignee'] ?? '';
      const bindingRaw: string = data['binding_scheduled_date'] ?? '';
      let bindingFormatted = bindingRaw;
      if (bindingRaw && bindingRaw.includes('-')) {
        try {
          const d = new Date(bindingRaw);
          if (!isNaN(d.getTime())) {
            bindingFormatted = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
          }
        } catch { /* ignore */ }
      }
      const revisionExists: string = data['contract_revision_exists'] ?? '';
      const revisionContent: string = data['contract_revision_content'] ?? '';
      let body = `${address}/${assignee}の契約書関係の確認ありがとうございました。製本予定は${bindingFormatted}となっております。`;
      if (revisionExists === 'あり') {
        body += `契約書等の修正は、${revisionExists}でした。内容は${revisionContent}です。`;
      }
      result = body;
    }

    return result;
  }

  /**
   * ISO 8601 形式の日時文字列を YYYY-MM-DD HH:mm 形式（JST UTC+9）に変換する（純粋関数）
   * null・undefined の場合は空文字を返す。
   * Requirements: 4.3
   */
  formatDateToJST(isoString: string | null | undefined): string {
    if (!isoString) return '';
    try {
      const str = String(isoString).trim();
      // タイムゾーン情報なし（Z や + を含まない）の場合はすでにJST（ローカル入力値）として扱う
      // 例: "2026-04-27T12:00" → "2026-04-27 12:00" としてそのまま返す
      if (str.includes('T') && !str.includes('Z') && !str.includes('+') && !str.includes('-', 10)) {
        const parts = str.split('T');
        const datePart = parts[0]; // YYYY-MM-DD
        const timePart = parts[1] ? parts[1].substring(0, 5) : '00:00'; // HH:mm
        return `${datePart} ${timePart}`;
      }
      const date = new Date(str);
      if (isNaN(date.getTime())) return '';
      // UTC+9 に変換
      const jstOffset = 9 * 60; // 分
      const jstTime = new Date(date.getTime() + jstOffset * 60 * 1000);
      const yyyy = jstTime.getUTCFullYear();
      const mm = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(jstTime.getUTCDate()).padStart(2, '0');
      const hh = String(jstTime.getUTCHours()).padStart(2, '0');
      const min = String(jstTime.getUTCMinutes()).padStart(2, '0');
      // DATE型からTIMESTAMPTZに変換された値はUTC 00:00:00 → JST 09:00になるため 12:00 にフォールバック
      // （フロントエンドの formatDateTimeForInput と同じ補正）
      if (jstTime.getUTCHours() === 9 && jstTime.getUTCMinutes() === 0 && jstTime.getUTCSeconds() === 0
          && date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
        return `${yyyy}-${mm}-${dd} 12:00`;
      }
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch {
      return '';
    }
  }

  /**
   * トリガーフィールドの変更を検知してメールを送信する
   * Requirements: 1.1〜1.9, 7.1, 7.2
   */
  async processEmailNotifications(
    propertyNumber: string,
    beforeData: Record<string, any>,
    afterData: Record<string, any>
  ): Promise<void> {
    for (const rule of EMAIL_RULES) {
      const beforeValue = beforeData[rule.triggerField];
      const afterValue = afterData[rule.triggerField];

      // 変更がない場合はスキップ（null/undefined は空文字として比較）
      const normalizedBefore = beforeValue ?? '';
      const normalizedAfter = afterValue ?? '';
      if (normalizedBefore === normalizedAfter) {
        continue;
      }

      try {
        const subject = this.resolveTemplate(rule.subjectTemplate, afterData);
        const body = this.resolveTemplate(rule.bodyTemplate, afterData);

        // テキスト形式の場合は改行を <br> に変換して HTML として送信
        const htmlBody = rule.isHtml ? body : body.replace(/\n/g, '<br>');

        await this.emailService.sendEmailWithCcAndAttachments({
          to: rule.to,
          cc: rule.cc,
          subject,
          body: htmlBody,
          from: 'tenant@ifoo-oita.com',
          isHtml: true,
        });

        console.log('[WorkTaskEmail] メール送信成功:', {
          propertyNumber,
          to: rule.to,
          triggerField: rule.triggerField,
        });
      } catch (error: any) {
        console.error('[WorkTaskEmail] メール送信失敗:', {
          propertyNumber,
          to: rule.to,
          triggerField: rule.triggerField,
          error: error.message,
        });
        // 1件失敗しても他の処理を継続する
      }
    }
  }
}
