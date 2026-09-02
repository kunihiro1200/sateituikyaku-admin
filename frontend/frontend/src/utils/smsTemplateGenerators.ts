import { Seller, PropertyInfo, Employee } from '../types';
import { getEmployeeName, extractLastName } from './employeeUtils';
import { formatNetProceedsSection } from './netProceedsCalculator';

/**
 * 1. 初回不通時キャンセル案内
 * サイト別に異なるキャンセル案内を生成
 */
export const generateInitialCancellationGuidance = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const site = seller.site || seller.inquirySite || '';
  const name = seller.name || '';
  const propertyAddress = property?.address || seller.propertyAddress || '';
  
  let message = '';
  
  if (site === 'ウ') {
    // イエウール専用
    message = `${name}様[改行][改行]この度はイエウールより${propertyAddress}の査定依頼をいただきましてありがとうございます。[改行][改行]面積の件で確認させていただきたく、何時頃のお電話だとご都合が良いか教えていただけますでしょうか？　当社は水曜定休で平日と土日営業しており10時～18時となっております。[改行][改行]またご連絡させていただきます。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else if (site === 'L' || site === 'Y') {
    // ライフルホームズ、Yahoo
    message = `${name}様[改行][改行]この度は${propertyAddress}の査定依頼をいただきましてありがとうございます。[改行][改行]面積の件で確認させていただきたく、何時頃のお電話だとご都合が良いか教えていただけますでしょうか？　当社は水曜定休で平日と土日営業しており10時～18時となっております。[改行][改行]またご連絡させていただきます。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else if (site === 'す') {
    // すまいステップ
    message = `${name}様[改行][改行]この度は${propertyAddress}の査定依頼をいただきましてありがとうございます。[改行][改行]面積の件で確認させていただきたく、何時頃のお電話だとご都合が良いか教えていただけますでしょうか？　当社は水曜定休で平日と土日営業しており10時～18時となっております。[改行][改行]またご連絡させていただきます。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else if (site === 'H') {
    // HOME4U
    message = `${name}様[改行][改行]この度は${propertyAddress}の査定依頼をいただきましてありがとうございます。[改行][改行]面積の件で確認させていただきたく、何時頃のお電話だとご都合が良いか教えていただけますでしょうか？　当社は水曜定休で平日と土日営業しており10時～18時となっております。[改行][改行]またご連絡させていただきます。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else {
    // その他のサイト（基本メッセージ）
    message = `${name}様[改行][改行]この度は${propertyAddress}の査定依頼をいただきましてありがとうございます。[改行][改行]面積の件で確認させていただきたく、何時頃のお電話だとご都合が良いか教えていただけますでしょうか？　当社は水曜定休で平日と土日営業しており10時～18時となっております。[改行][改行]またご連絡させていただきます。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  }
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 2. キャンセル案内
 * サイト別のキャンセル手続き案内を生成
 */
export const generateCancellationGuidance = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const site = seller.site || seller.inquirySite || '';
  const name = seller.name || '';
  const propertyAddress = property?.address || seller.propertyAddress || '';
  
  let message = '';
  
  if (site === 'ウ') {
    // イエウール
    message = `${name}様[改行]不動産一括査定サイトにご登録いただいておりますのでこの後も複数社から電話や訪問が続く可能性があるため、一旦キャンセルされることをオススメ致します。（依頼日より3日以内の申請でキャンセルOK）[改行][改行]キャンセルされる場合は、下記イエウール本社へメールにて以下の内容をお送りください。[改行][改行]（＊注意点としまして[改行]査定額しりたかっただけ→キャンセルNG[改行]査定不要→キャンセルOK）[改行][改行]【送信先】ieul-support@speee.jp[改行]【件名】査定依頼のキャンセルについて[改行]【本文】↓そのまま本文コピペしてください[改行]査定依頼をキャンセルしたいです。査定不要です[改行]物件住所：${propertyAddress}[改行]お名前：${name}[改行][改行]ご不明な点がございましたら、お気軽にお問い合わせください。[改行][改行]㈱いふう[改行]<<当社住所>>`;
  } else if (site === 'す') {
    // すまいステップ
    message = `${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${propertyAddress}の査定依頼についてご連絡させていただきました。[改行][改行]もし査定のご依頼をキャンセルされる場合は、下記のGoogleフォームよりお手続きください。[改行]https://forms.gle/iu3rLdPJ784WJxJW7[改行][改行]最後のキャンセル理由は[改行]「間違ったので」とだけ入力していただければOKです。「査定知りたかった」と書いてしまうとキャンセルできなくなりますのでご注意ください。[改行][改行]ご不明な点がございましたら、お気軽にお問い合わせください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else if (site === 'L') {
    // ライフルホームズ
    message = `${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${propertyAddress}の査定依頼についてご連絡させていただきました。[改行][改行]もし査定のご依頼をキャンセルされる場合は、このメッセージに返信する形で「キャンセル希望」とお知らせください。24時間以内にキャンセル手続きをさせていただきます。[改行][改行]ご不明な点がございましたら、お気軽にお問い合わせください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  } else {
    // その他のサイト
    message = `${name}様[改行][改行]お世話になっております。[改行][改行]${propertyAddress}の査定依頼について、キャンセル案内不要です。`;
  }
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 3. 査定Sメール
 * 査定結果を3段階の価格帯で通知
 */
export const generateValuationSMS = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const name = seller.name || '';
  const propertyAddress = property?.address || seller.propertyAddress || '';
  
  // 査定額を万円単位に変換
  const amount1 = seller.valuationAmount1 
    ? Math.round(seller.valuationAmount1 / 10000) 
    : 0;
  const amount2 = seller.valuationAmount2 
    ? Math.round(seller.valuationAmount2 / 10000) 
    : 0;
  const amount3 = seller.valuationAmount3 
    ? Math.round(seller.valuationAmount3 / 10000) 
    : 0;
  
  let message = `${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${propertyAddress}の査定をさせていただきました。[改行][改行]【査定結果】[改行]`;
  
  if (amount1 > 0 && amount2 > 0 && amount3 > 0) {
    message += `①${amount1}万円～${amount2}万円（相場価格）[改行]②${amount2}万円～${amount3}万円（チャレンジ価格）[改行][改行]`;
  } else {
    message += `査定額：未設定[改行][改行]`;
  }
  
  // 築年不明の場合の注記
  if (!property?.buildYear || property.buildYear <= 0) {
    message += `※新築年が不明のため、築35年で算出しております。相違がある場合はお申し付けくださいませ。[改行][改行]`;
  }
  
  message += `当社のお客様で${propertyAddress}周辺の物件を探されている方がいらっしゃいます。[改行][改行]詳しいお話をさせていただきたく、訪問査定のご予約を承っております。[改行]下記リンクよりご都合の良い日時をお選びください。[改行]http://bit.ly/44U9pjl[改行][改行]ご不明な点がございましたら、お気軽にお問い合わせください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 査定Sメール（手残り）
 * 最高査定額から最低査定額まで200万円刻みで、仲介手数料と印紙代を
 * 差し引いた概算手残り額を通知する。
 */
export const generateNetProceedsValuationSMS = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const name = seller.name || '';
  const propertyAddress = property?.address || seller.propertyAddress || '';
  const netProceedsSection = formatNetProceedsSection([
    seller.valuationAmount1,
    seller.valuationAmount2,
    seller.valuationAmount3,
  ], '[改行]');

  let message = `${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${propertyAddress}の査定をさせていただきました。[改行][改行]${netProceedsSection}[改行][改行]当社のお客様で${propertyAddress}周辺の物件を探されている方がいらっしゃいます。[改行][改行]詳しいお話をさせていただきたく、訪問査定のご予約を承っております。[改行]下記リンクよりご都合の良い日時をお選びください。[改行]http://bit.ly/44U9pjl[改行][改行]ご不明な点がございましたら、お気軽にお問い合わせください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022`;

  message = replacePlaceholders(message, seller);
  return message;
};

/**
 * 4. 訪問事前通知メール
 * 訪問予定日の前日に送信（木曜日の場合は明後日表記）
 */
export const generateVisitReminderSMS = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const name = seller.name || '';
  
  // visitDate + visitTime から日時を構築（優先）、なければ appointmentDate を使用
  let appointmentDate: Date | null = null;
  if (seller.visitDate) {
    const dateStr = seller.visitDate instanceof Date
      ? seller.visitDate.toISOString().split('T')[0]
      : String(seller.visitDate).split('T')[0];
    const timeStr = seller.visitTime ? String(seller.visitTime).substring(0, 5) : '00:00';
    appointmentDate = new Date(`${dateStr}T${timeStr}`);
  } else if (seller.appointmentDate) {
    appointmentDate = new Date(seller.appointmentDate);
  }
  
  if (!appointmentDate || isNaN(appointmentDate.getTime())) {
    return `${name}様[改行][改行]訪問予定日時が設定されていません。`;
  }
  
  // 曜日を取得
  const dayOfWeek = appointmentDate.toLocaleDateString('ja-JP', { weekday: 'long' });
  const isThursday = dayOfWeek === '木曜日';
  const dayText = isThursday ? '明後日' : '明日';
  
  // 日付と時刻をフォーマット
  const dateText = appointmentDate.toLocaleDateString('ja-JP', { 
    month: 'long', 
    day: 'numeric' 
  }).replace('月', '月').replace('日', '日');
  
  const timeText = appointmentDate.toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
  
  let message = `【訪問、打合せのご連絡　☆返信不可☆】[改行]${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${dayText}${dateText}${timeText}に訪問査定にお伺いさせていただきます。[改行][改行]ご不明点や、お時間の変更等ございましたら、下記までご連絡ください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]TEL: 097-533-2022[改行]Email: tenant@ifoo-oita.com[改行]営業時間: 10:00～18:00（水曜定休）[改行][改行]※このメッセージは返信できません。ご連絡は上記の電話番号またはメールアドレスまでお願いいたします。`;
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 5. 訪問後御礼メール
 * 訪問査定後の御礼メッセージ（担当者名を含む）
 */
export const generatePostVisitThankYouSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  employees?: Employee[]
): string => {
  const name = seller.name || '';
  
  // フィールド優先順位: visitAssignee > assignedTo
  const assigneeIdentifier = seller.visitAssignee || seller.assignedTo || '';
  
  // getEmployeeName関数を使用して担当者名を解決
  const assigneeName = getEmployeeName(assigneeIdentifier, employees);
  
  let message = `${name}様[改行][改行]本日は、訪問査定のために貴重な時間を割いていただき、誠にありがとうございました。[改行][改行]いくつかの不動産会社のお話を聞かれて、どこと契約を結ぶかお考えだと思います。[改行][改行]弊社としましては、${name}様の大切な不動産の売却のお手伝いをいふうスタッフ一同で精一杯努めてまいりたいと思っております。[改行][改行]ご検討いただく中で、ご不明な点や弊社で何かお手伝いできることがございましたら、どうぞお気軽にお申し付けくださいませ。[改行][改行]今後ともよろしくお願い致します。`;
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 6. 除外前・長期客Sメール
 * 長期間連絡が取れていない顧客への確認メッセージ
 */
export const generateLongTermCustomerSMS = (
  seller: Seller,
  property: PropertyInfo | null
): string => {
  const name = seller.name || '';
  const propertyAddress = property?.address || seller.propertyAddress || '';
  
  let message = `${name}様[改行][改行]お世話になっております。大分市舞鶴町にございます不動産会社のいふうです。[改行][改行]${propertyAddress}の売却について、その後ご検討状況はいかがでしょうか。[改行][改行]当社のお客様で${propertyAddress}周辺の物件を探されている方がいらっしゃいます。[改行][改行]もしご売却をお考えでしたら、訪問査定のご予約を承っております。[改行]下記リンクよりご都合の良い日時をお選びください。[改行]http://bit.ly/44U9pjl[改行][改行]今後のご連絡が不要な場合は、お手数ですがその旨お知らせください。[改行][改行]㈱いふう[改行]<<当社住所>>[改行]実績: bit.ly/3J61wzG[改行]TEL: 097-533-2022`;
  
  // プレースホルダー置換
  message = replacePlaceholders(message, seller);
  
  return message;
};

/**
 * 7. 当社が電話したというリマインドメール
 * 電話後のフォローアップメッセージ
 * @param staffLastName 送信者の名字（例: 「国広」）。省略時は会社名のみ表示
 */
export const generateCallReminderSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  
  // <<担当者名字>> プレースホルダーを使用してテンプレートを生成
  // replacePlaceholders内でFI判定に基づき「くじら不動産の〇〇です」or「株式会社いふうの〇〇です」に置換される
  let message = `${name}様[改行][改行]お世話になっております。先ほどお電話でお話させていただきましてありがとうございました。<<担当者名字あいさつ>>[改行]なるべく${name}様のご要望に沿った形で計画的ご提案できればと考えておりますので、宜しくお願い申し上げます。[改行]ご不明点等がございましたら、こちらのメールに返信いただければと思います。宜しくお願い申し上げます。[改行][改行]<<当社住所>>[改行]株式会社いふう[改行]売買実績はこちら：bit.ly/3J61wzG[改行]097-533-2022`;
  
  // プレースホルダー置換（staffLastNameを追加で渡す）
  message = replacePlaceholders(message, seller, staffLastName);
  
  return message;
};

/**
 * 8-extra. 未訪問他決の理由伺い
 * 訪問前に他社決定した顧客への理由確認メッセージ
 * FI: 署名はくじら不動産、非FI: 株式会社いふう
 * @param staffLastName ログインユーザーの名字（アカウント名として使用）
 */
export const generateUnvisitedOtherDecisionSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // FI判定で署名の会社名を決定（replacePlaceholders は呼ばずに直接組み立てる）
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const hasFI = sellerNumber.includes('FI');
  const companyName = hasFI ? 'くじら不動産' : '株式会社いふう';

  // [改行] は convertLineBreaks で \n に変換される
  const message = [
    `${name}様`,
    `ご丁寧にご連絡いただきありがとうございます。`,
    `他社様にご依頼されたとのこと、承知いたしました。`,
    `今回は弊社では直接お話を伺う機会をつくれず、お力になれなかったことを残念に思っております。`,
    `最後にお願いがあるのですが、他社様に決められた一番の決め手を教えていただけないでしょうか？`,
    `査定額やご提案内容、担当者の対応、訪問までの流れなど、率直にお聞かせいただけると大変ありがたいです。`,
    `今後のご売却が良い形で進むことを願っております。`,
    ``,
    `${companyName}　${accountName}`,
  ].join('[改行]');

  return message;
};

/**
 * 不通・査定後の状況確認メール
 * 査定後に連絡が取れない売主への状況確認メッセージ
 * 売主番号にAAが含まれる場合は「㈱いふう」、それ以外（FI等）は「株式会社くじら不動産」
 * @param staffLastName ログインユーザーの名字（アカウント名として使用）
 */
export const generateUnreachableAfterValuationCheckSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // 売主番号にAAが含まれる場合は㈱いふう、それ以外は株式会社くじら不動産
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const companyName = sellerNumber.includes('AA') ? '㈱いふう' : '株式会社くじら不動産';

  // [改行] は convertLineBreaks で \n に変換される
  const message = [
    `${name}様`,
    `${companyName}の${accountName}です。`,
    `先日は不動産の査定をご依頼いただき、ありがとうございました。`,
    `査定について一度お話できればと思い、お電話いたしました。`,
    ``,
    `①売却を検討中`,
    `②まだ時期は未定`,
    `③売却予定なし`,
    `差し支えなければ、現在のご状況を番号だけでもご返信いただけますと幸いです。`,
    `③の場合は、以降こちらからのご連絡は控えさせていただきます。`,
    `よろしくお願いいたします。`,
  ].join('[改行]');

  return message;
};

/**
 * プレースホルダーを売主情報に基づいて置き換える
 * 
 * サポートされているプレースホルダー:
 * - `<<当社住所>>`: 売主番号に「FI」が含まれる場合は福岡支店の住所、それ以外は大分本社の住所（両方とも「住所：」プレフィックスなし）
 * - `<<売買実績ｖ>>` または `<<売買実績v>>`: 売主番号に「FI」が含まれる場合は空文字列、それ以外は売買実績URL
 * 
 * 条件分岐ロジック:
 * - 売主番号に「FI」が含まれるかを判定（大文字・小文字を区別しない）
 * - 売主番号がnull、undefined、または空文字列の場合はデフォルト値を使用
 * 
 * @param message - プレースホルダーを含むメッセージ文字列
 * @param seller - 売主オブジェクト（sellerNumberフィールドを含む）
 * @returns プレースホルダーが置き換えられたメッセージ文字列
 * 
 * @example
 * ```typescript
 * const seller = { sellerNumber: 'FI12345', name: '山田太郎' };
 * const message = '<<当社住所>>です。<<売買実績ｖ>>';
 * const result = replacePlaceholders(message, seller);
 * // 結果: '福岡市中央区舞鶴３丁目１－１０です。'
 * ```
 * 
 * @example
 * ```typescript
 * const seller = { sellerNumber: 'AA13501', name: '佐藤花子' };
 * const message = '<<当社住所>>です。<<売買実績ｖ>>';
 * const result = replacePlaceholders(message, seller);
 * // 結果: '大分市舞鶴町1-3-30STビル１Fです。売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map'
 * ```
 */
export const replacePlaceholders = (
  message: string,
  seller: Seller,
  staffLastName?: string
): string => {
  try {
    // 売主オブジェクトのnullチェック
    if (!seller) {
      console.error('[replacePlaceholders] Seller object is null, using default values');
      return replaceWithDefaults(message);
    }
    
    // 売主番号の取得
    const sellerNumber = seller.sellerNumber;
    
    // 売主番号のundefined/空文字列チェック
    if (!sellerNumber || sellerNumber.trim() === '') {
      console.warn('[replacePlaceholders] Seller number is empty, using default values');
      return replaceWithDefaults(message);
    }
    
    // 条件分岐処理（大文字・小文字を区別しない）
    const hasFI = sellerNumber.toUpperCase().includes('FI');
    
    // プレースホルダー置換
    let result = message;

    // <<担当者名字あいさつ>>の置換
    // FI: 「くじら不動産の〇〇です」 / 非FI: 「株式会社いふうの〇〇です」
    // staffLastNameが空の場合はシンプルな会社名表記にフォールバック
    // ⚠️ フルネームが渡ってきても名字だけに丸める（国広智子 → 国広、裏天真 → 裏）
    const staffLastNameOnly = extractLastName(staffLastName);
    if (hasFI) {
      const greeting = staffLastNameOnly
        ? `くじら不動産の${staffLastNameOnly}です`
        : 'くじら不動産です';
      result = result.replace(/<<担当者名字あいさつ>>/g, greeting);
    } else {
      const greeting = staffLastNameOnly
        ? `株式会社いふうの${staffLastNameOnly}です`
        : '株式会社いふうです';
      result = result.replace(/<<担当者名字あいさつ>>/g, greeting);
    }    
    // <<当社住所>>の置換
    if (hasFI) {
      result = result.replace(/<<当社住所>>/g, '福岡市中央区舞鶴３丁目１－１０');
    } else {
      result = result.replace(/<<当社住所>>/g, '大分市舞鶴町1-3-30STビル１F');
    }
    
    // <<売買実績ｖ>>の置換（全角「ｖ」と半角「v」の両方に対応）
    if (hasFI) {
      result = result.replace(/<<売買実績ｖ>>/g, '');
      result = result.replace(/<<売買実績v>>/g, '');
    } else {
      result = result.replace(/<<売買実績ｖ>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
      result = result.replace(/<<売買実績v>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
    }

    // 新規追加: ハードコードされた「大分市舞鶴町にございます」の変換
    if (hasFI) {
      result = result.replace(/大分市舞鶴町にございます/g, '福岡市中央区舞鶴にございます');
    }

    // FI・非FI問わずFAX行を常に削除
    // [改行]FAX: 形式（半角コロン+スペース）
    result = result.replace(/\[改行\]FAX: [^\[^\n]*/g, '');
    // [改行]FAX：形式（全角コロン）
    result = result.replace(/\[改行\]FAX：[^\[^\n]*/g, '');
    // \n に変換済みの場合
    result = result.replace(/\nFAX[：:][^\n]*\n?/g, '\n');

    // FI売主の場合は署名の会社固定TEL番号を福岡用（092-401-5331）に変更
    // 担当者個人番号（TEL：<<担当名（営業）電話番号>>）は変更しない
    // ※この時点では [改行] はまだ \n に変換されていないため、
    //   [改行]TEL: ... パターンで直接マッチする
    if (hasFI) {
      // [改行]TEL: 097-533-2022 形式（半角コロン+スペース）→ 福岡用番号に変更
      result = result.replace(/\[改行\]TEL: 097-533-2022/g, '[改行]TEL: 092-401-5331');
      // [改行]TEL：097-533-2022 形式（全角コロン）→ 福岡用番号に変更
      result = result.replace(/\[改行\]TEL：097-533-2022/g, '[改行]TEL：092-401-5331');
      // [改行]097-533-2022 形式（プレフィックスなし）→ 福岡用番号に変更
      result = result.replace(/\[改行\]097-533-2022/g, '[改行]092-401-5331');
      // 実績リンク削除（大分専用のため福岡では不要）
      result = result.replace(/\[改行\]実績: bit\.ly\/3J61wzG/g, '');
      result = result.replace(/\[改行\]売買実績はこちら：bit\.ly\/3J61wzG/g, '');
      // 万が一 \n に変換済みの場合も念のため対応（→ 福岡用番号に変更）
      // 行頭スペースあり・なし両方、\r\n も考慮
      result = result.replace(/(\r?\n[ \t]*)TEL: 097-533-2022/g, '$1TEL: 092-401-5331');
      result = result.replace(/(\r?\n[ \t]*)TEL：097-533-2022/g, '$1TEL：092-401-5331');
      result = result.replace(/(\r?\n[ \t]*)097-533-2022/g, '$1092-401-5331');
      result = result.replace(/(\r?\n[ \t]*)実績: bit\.ly\/3J61wzG/g, '');
      result = result.replace(/(\r?\n[ \t]*)売買実績はこちら：bit\.ly\/3J61wzG/g, '');

      // FI売主の場合はHP URLをくじら不動産のURLに変更
      // [改行]HP：https://ifoo-oita.com/ 形式（SMSテンプレート）
      result = result.replace(/\[改行\]HP[：:]https:\/\/ifoo-oita\.com\//g, '[改行]HP：https://kujira-fudosan.com/');
      // \n に変換済みの場合（行頭スペースあり・なし両方対応）
      result = result.replace(/(\r?\n[ \t]*)HP[：:]https:\/\/ifoo-oita\.com\//g, '$1HP：https://kujira-fudosan.com/');

      // FI売主の場合は査定額案内メールの「売却の流れPDF」URLを福岡用Google DriveのURLに変更
      console.log(`[replacePlaceholders] FI売主のURL置換開始: ${seller?.sellerNumber}`);
      console.log(`[replacePlaceholders] 置換前テキスト（最初の500文字）: ${result.substring(0, 500)}`);
      
      // テキスト内にURLパターンが存在するかチェック
      const urlPatterns = [
        { name: 'chrome-extension PDF', pattern: 'chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj' },
        { name: 'ifoo-oita PDF', pattern: 'ifoo-oita.com/testsite/wp-content/uploads/2020/12/d58af49c9c6dd87c7aee1845265204b6.pdf' },
        { name: 'Google Drive (正確なID)', pattern: '1lr2vafII3OQ3ALYR6BJI09xLkXLfJqgP' }
      ];
      urlPatterns.forEach(({ name, pattern }) => {
        if (result.includes(pattern)) {
          console.log(`[replacePlaceholders] ✅ 検出: ${name} (パターン: ${pattern})`);
        }
      });

      // chrome-extension://... プレフィックス付きのURL（valuation_inheritanceテンプレート）
      const before1 = result;
      result = result.replace(
        /chrome-extension:\/\/efaidnbmnnnibpcajpcglclefindmkaj\/https:\/\/ifoo-oita\.com\/testsite\/wp-content\/uploads\/2020\/12\/d58af49c9c6dd87c7aee1845265204b6\.pdf/g,
        'https://drive.google.com/file/d/19HxXMAvuHZWKIYNOTHIb8nH15D9J3sjJ/view?usp=sharing'
      );
      if (before1 !== result) console.log('[replacePlaceholders] ✅ chrome-extension PDF URL置換成功');

      // プレフィックスなしのURL（valuation_non_inheritanceテンプレート）
      const before2 = result;
      result = result.replace(
        /https:\/\/ifoo-oita\.com\/testsite\/wp-content\/uploads\/2020\/12\/d58af49c9c6dd87c7aee1845265204b6\.pdf/g,
        'https://drive.google.com/file/d/19HxXMAvuHZWKIYNOTHIb8nH15D9J3sjJ/view?usp=sharing'
      );
      if (before2 !== result) console.log('[replacePlaceholders] ✅ ifoo-oita PDF URL置換成功');

      // スプレッドシートテンプレートで使用される既存のGoogle Drive URL（大分用）を福岡用に変更
      // 正確なファイルID: 1lr2vafII3OQ3ALYR6BJI09xLkXLfJqgP (注意: 1lr=数字1+小文字l+小文字r、II=大文字I×2)
      const before3 = result;
      result = result.replace(
        /https:\/\/drive\.google\.com\/file\/d\/1lr2vafII3OQ3ALYR6BJI09xLkXLfJqgP\/view\?usp=sharing/g,
        'https://drive.google.com/file/d/19HxXMAvuHZWKIYNOTHIb8nH15D9J3sjJ/view?usp=sharing'
      );
      if (before3 !== result) console.log('[replacePlaceholders] ✅ Google Drive URL 置換成功');

      console.log(`[replacePlaceholders] 置換後テキスト（最初の500文字）: ${result.substring(0, 500)}`);

      // FI売主の場合は会社名を「株式会社くじら不動産」に変更
      // ステップ1: 「〇〇にございます、不動産会社の"?株式会社 ?いふう"?です」パターンを
      //            「〇〇にございます、株式会社くじら不動産です」に変換（住所変換後のパターンも含む）
      result = result.replace(/にございます、不動産会社の"?株式会社\s?いふう"?です/g, 'にございます、株式会社くじら不動産です');
      // ステップ2: 「不動産会社のいふう」「不動産会社の㈱いふう」「不動産会社の株式会社いふう」パターン
      //            → 「不動産会社の」を除去してくじら不動産のみにする
      result = result.replace(/不動産会社の"?(?:株式会社\s?|㈱)?いふう"?/g, 'くじら不動産');
      // ステップ3: 残った「株式会社 いふう」「株式会社いふう」を置換
      result = result.replace(/株式会社\s?いふう/g, '株式会社くじら不動産');
      // ステップ4: 「㈱いふう」→「㈱くじら不動産」
      result = result.replace(/㈱いふう/g, '㈱くじら不動産');
      // ステップ4.1: 「いふうスタッフ一同」→「くじら不動産スタッフ一同」
      result = result.replace(/いふうスタッフ一同/g, 'くじら不動産スタッフ一同');
      // ステップ4.5: 件名パターン「（株いふう）」「(㈱いふう)」など括弧付き会社名
      result = result.replace(/[（(][㈱株式会社　 ]*いふう[）)]/g, '（株くじら不動産）');
      // ステップ5: 万が一残った「不動産会社の株式会社くじら不動産」「不動産会社の㈱くじら不動産」の後処理
      result = result.replace(/不動産会社の(?:株式会社|㈱)くじら不動産/g, '株式会社くじら不動産');

      // ── 署名ブロック全体をくじら不動産用に置換 ─────────────────────
      // ***...*** で囲まれた署名ブロックを検出して福岡署名に一括置換
      const kujiraSignature =
        `***************************\n` +
        `株式会社くじら不動産（株式会社いふう）\n` +
        `〒810-0073　福岡市中央区舞鶴3－1－10\n` +
        `TEL：092-401-5331\n` +
        `FAX：092-401-5332\n` +
        `HP：https://kujira-fudosan.com/\n` +
        `***************************`;
      // パターン: ***で始まり***で終わる署名ブロック
      result = result.replace(/\*{3,}[\s\S]*?\*{3,}/g, kujiraSignature);
    }
    
    return result;
  } catch (error) {
    console.error('[replacePlaceholders] Error occurred:', error);
    return message; // 元のメッセージを返す
  }
};

/**
 * デフォルト値でプレースホルダーを置換するヘルパー関数
 * @param message - プレースホルダーを含むメッセージ文字列
 * @returns デフォルト値で置換されたメッセージ文字列
 */
const replaceWithDefaults = (message: string): string => {
  let result = message;
  result = result.replace(/<<当社住所>>/g, '大分市舞鶴町1-3-30STビル１F');
  result = result.replace(/<<売買実績ｖ>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
  result = result.replace(/<<売買実績v>>/g, '売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map');
  return result;
};

/**
 * 8. 挨拶SMS
 * AA → (株)いふう、FI → (株)くじら不動産
 */
export const generateGreetingSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  employees?: Employee[]
): string => {
  const name = seller.name || '';
  
  // 担当者名を解決（本文には名字だけを表示: 国広智子 → 国広）
  const assigneeIdentifier = seller.assignedTo || '';
  const assigneeName = extractLastName(getEmployeeName(assigneeIdentifier, employees));
  
  // 売主番号でAA/FI判定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const companyName = sellerNumber.includes('FI') ? '(株)くじら不動産' : '(株)いふう';
  
  return `${name}様[改行]お世話になっております。${companyName}の${assigneeName}です。[改行][改行]今後ともどうぞよろしくお願いいたします。`;
};

/**
 * 9. メールアドレス確認SMS
 * AA → (株)いふう、FI → (株)くじら不動産
 */
export const generateAskEmailSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  employees?: Employee[]
): string => {
  const name = seller.name || '';

  // 売主番号でAA/FI判定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const companyName = sellerNumber.includes('FI') ? 'くじら不動産' : '不動産会社いふう';

  return `${name}様[改行]お世話になっております。${companyName}です。[改行]先ほどは物件についてお問い合わせいただき、誠にありがとうございました。[改行]今後、ご希望条件に合う新着物件やおすすめ物件がございましたら、メールにてご紹介・配信させていただければと思っております。[改行]差し支えなければ、こちらのショートメールへご確認いただけるメールアドレスをご返信いただけますと幸いです。[改行]どうぞよろしくお願いいたします。`;
};

/**
 * 10. 他決→3ヶ月後追客
 * 他社媒介契約から3ヶ月経過後のフォローアップ
 * FI → くじら不動産、AA → 株式会社いふう
 * 物件住所から丁目以降（数字）を省略してエリア名として使用
 * @param staffLastName 送信者の名字（例: 「国広」）
 */
export const generateOtherDecisionThreeMonthsFollowUpSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // 売主番号でFI/AA判定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const companyName = sellerNumber.includes('FI') ? 'くじら不動産' : '株式会社いふう';

  // 物件住所から丁目以降の数字を省略（例: 「大分市中央町3丁目4-5」→「大分市中央町」）
  const fullAddress = property?.address || seller.propertyAddress || '';
  // 「●丁目」または「●-」または「●－」の直前までを抽出
  let addressArea = fullAddress.replace(/\d+[丁目\-－].*$/, '').trim();
  // 万が一残っている場合の追加処理：数字で終わる場合はその数字も削除
  if (/\d+$/.test(addressArea)) {
    addressArea = addressArea.replace(/\d+$/, '').trim();
  }

  const message = [
    `${name}様`,
    ``,
    `ご無沙汰しております。${companyName}の${accountName}です。`,
    ``,
    `本日、${addressArea}エリアで物件をお探しのお客様からお問い合わせがあり、ご連絡いたしました。`,
    ``,
    `他社様との媒介契約から3か月ほど経過しましたが、その後ご売却状況はいかがでしょうか？`,
    ``,
    `現在の広告も拝見しましたが、写真が全体的に少し暗く、物件本来の良さが十分に伝わっていない点が少しもったいないと感じました。`,
    ``,
    `当社でしたら写真の撮り直し・画像調整を含め、広告の見せ方から販売戦略を組み直します。`,
    ``,
    `ちょうど媒介契約の更新時期かと思いますので、「今のままで良いのか」というご相談だけでも結構です。`,
    ``,
    `よろしければ一度お話しできれば幸いです。`,
  ].join('[改行]');

  // プレースホルダー置換
  return replacePlaceholders(message, seller, staffLastName);
};

/**
 * 11. 他決→追客（6ヶ月後）
 * 他社で販売開始から6ヶ月経過後の販売戦略見直し提案
 * FI → くじら不動産、AA → 株式会社いふう
 * 物件住所から丁目以降（数字）を省略してエリア名として使用
 * @param staffLastName 送信者の名字（例: 「国広」）
 */
export const generateOtherDecisionSixMonthsFollowUpSMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // 売主番号でFI/AA判定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const companyName = sellerNumber.includes('FI') ? 'くじら不動産' : '株式会社いふう';

  // 物件住所から丁目以降の数字を省略（例: 「大分市中央町3丁目4-5」→「大分市中央町」）
  const fullAddress = property?.address || seller.propertyAddress || '';
  // 「●丁目」または「●-」または「●－」の直前までを抽出
  let addressArea = fullAddress.replace(/\d+[丁目\-－].*$/, '').trim();
  // 万が一残っている場合の追加処理：数字で終わる場合はその数字も削除
  if (/\d+$/.test(addressArea)) {
    addressArea = addressArea.replace(/\d+$/, '').trim();
  }

  const message = [
    `${name}様`,
    ``,
    `ご無沙汰しております。${companyName}の${accountName}です。`,
    ``,
    `弊社のお客様で、${addressArea}エリアで物件をお探しの方がおり、ご連絡いたしました。`,
    ``,
    `他社様で販売を開始されて半年ほど経過しましたが、その後ご状況はいかがでしょうか？`,
    ``,
    `売却が長期化する場合、価格だけでなく「写真の見せ方」「広告の出し方」「物件の魅力の伝え方」など、販売戦略を変えることで反響が変わることがあります。`,
    ``,
    `現在の掲載状況も拝見しましたが、まだ改善できる部分があるように感じております。`,
    ``,
    `もし今の販売活動に少しでも不安がございましたら、当社でしたらどのように販売するか、具体的にご提案させてください。`,
    ``,
    `今の会社様との比較だけでも結構です。`,
    `一度お話しする機会をいただけましたら幸いです。`,
  ].join('[改行]');

  // プレースホルダー置換
  return replacePlaceholders(message, seller, staffLastName);
};

/**
 * 改行プレースホルダーを実際の改行文字に変換
 */
export const convertLineBreaks = (message: string): string => {
  return message.replace(/\[改行\]/g, '\n');
};

/**
 * 進捗①の返信
 * 売却を検討中とのこと承知、査定価格の根拠や税金関係について説明
 * FI: くじら不動産、非FI: 株式会社いふう
 */
export const generateProgressStep1ReplySMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // FI判定で会社名を決定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const hasFI = sellerNumber.includes('FI');
  const companyName = hasFI ? 'くじら不動産' : '株式会社いふう';

  const message = [
    `${name}様`,
    ``,
    `ご返信ありがとうございます。${companyName}の${accountName}です。`,
    `売却をご検討中とのこと、承知いたしました。`,
    `査定価格の根拠や、税金関係、今後の売却の進め方について簡単にご説明できればと思います。`,
    `5分程度で構いませんので、お電話可能な曜日や時間帯を教えていただけますでしょうか？`,
    `「平日夕方」「土日」など、大まかで結構です。`,
    `よろしくお願いいたします。`,
  ].join('[改行]');

  return message;
};

/**
 * 進捗②の返信
 * 売却時期が未定の段階でも気軽に相談を、市場状況に合わせた査定額をメールで送付
 * FI: くじら不動産、非FI: 株式会社いふう
 */
export const generateProgressStep2ReplySMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // FI判定で会社名を決定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const hasFI = sellerNumber.includes('FI');
  const companyName = hasFI ? 'くじら不動産' : '株式会社いふう';

  const message = [
    `${name}様`,
    ``,
    `ご返信ありがとうございます。${companyName}の${accountName}です。`,
    ``,
    `承知いたしました。`,
    ``,
    `売却時期がまだお決まりでない段階でも、今後の参考として価格や売却方法などお気軽にご相談ください。`,
    `また、その時々の市場状況に合わせた査定額もメールでお送りできればと思っております。`,
    `差し支えなければ、現時点ではいつ頃を目処に売却をお考えでしょうか？`,
    `「半年以内」「1年くらい」「2〜3年後」など、大まかで結構です。`,
    `今後ともよろしくお願いいたします。`,
  ].join('[改行]');

  return message;
};

/**
 * 進捗③の返信
 * 不動産価格の変動に応じた定期的な査定額のメール送付を提案
 * FI: くじら不動産、非FI: 株式会社いふう
 */
export const generateProgressStep3ReplySMS = (
  seller: Seller,
  property: PropertyInfo | null,
  staffLastName?: string
): string => {
  const name = seller.name || '';
  // 名字だけを使う（フルネームが渡ってきても「国広智子」→「国広」に丸める）
  const accountName = extractLastName(staffLastName);

  // FI判定で会社名を決定
  const sellerNumber = (seller.sellerNumber || '').toUpperCase();
  const hasFI = sellerNumber.includes('FI');
  const companyName = hasFI ? 'くじら不動産' : '株式会社いふう';

  const message = [
    `${name}様`,
    ``,
    `ご返信ありがとうございます。${companyName}の${accountName}です。`,
    ``,
    `承知いたしました。`,
    ``,
    `個人情報が残ったままになりますので、一度下記方法でキャンセルされることをオススメ致します。`,
    ``,
    `注意点としまして、「査定額知りたかっただけ」はキャンセルできず、「査定不要ですのでキャンセルしたい」はキャンセルできます。キャンセルしても各社より机上査定はメールで届く仕組みになっておりますのでご了承ください。`,
    ``,
    `【送信先】ieul-support@speee.jp`,
    ``,
    `【件名】査定依頼のキャンセルについて`,
    ``,
    `【本文】`,
    ``,
    `査定不要ですので査定依頼をキャンセルしたいです。`,
    ``,
    `物件住所：`,
    ``,
    `お名前：`,
  ].join('[改行]');

  return message;
};
