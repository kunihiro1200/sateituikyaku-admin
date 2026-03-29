# buyerEnumOptions.ts と CalendarLinkGenerator.ts を正しいUTF-8で書き直す

# ========== CalendarLinkGenerator.ts ==========
calendar_content = '''/**
 * CalendarLinkGenerator
 *
 * Googleカレンダーリンクを生成するサービス
 */

interface Buyer {
  buyer_number: string;
  name?: string;
  phone_number?: string;
  email?: string;
  latest_viewing_date: string;
  viewing_time: string;
  follow_up_assignee: string;
  pre_viewing_notes?: string;
  [key: string]: any;
}

interface Employee {
  name: string;
  initials: string;
  email: string;
  [key: string]: any;
}

export class CalendarLinkGenerator {
  /**
   * Googleカレンダーリンクを生成
   * @param buyer - 買主データ
   * @param employees - 従業員データ
   * @returns Googleカレンダーのイベント作成URL
   */
  static generateCalendarLink(buyer: Buyer, employees: Employee[]): string {
    // 内覧日時を取得
    const viewingDate = new Date(buyer.latest_viewing_date);
    const viewingTime = buyer.viewing_time || '14:00';

    // 時間をパース
    const [hours, minutes] = viewingTime.split(':').map(Number);
    viewingDate.setHours(hours, minutes, 0, 0);

    // 終了時刻（1時間後）
    const endDate = new Date(viewingDate);
    endDate.setHours(viewingDate.getHours() + 1);

    // 日時フォーマット
    const startDateStr = this.formatDateForCalendar(viewingDate);
    const endDateStr = this.formatDateForCalendar(endDate);

    // イベントタイトル
    const title = encodeURIComponent(`内覧: ${buyer.name || buyer.buyer_number}`);

    // 担当従業員のメールアドレスを取得
    const assignedEmployee = employees.find(e =>
      e.name === buyer.follow_up_assignee ||
      e.initials === buyer.follow_up_assignee ||
      e.email === buyer.follow_up_assignee
    );
    const assignedEmail = assignedEmployee?.email || '';

    // 詳細情報（担当従業員の情報を含む）
    let detailsText = `買主名: ${buyer.name || buyer.buyer_number}\\n` +
      `買主番号: ${buyer.buyer_number}\\n` +
      `電話: ${buyer.phone_number || 'なし'}\\n` +
      `メール: ${buyer.email || 'なし'}\\n`;

    if (assignedEmployee) {
      detailsText += `\\n担当従業員: ${assignedEmployee.name} (${assignedEmployee.email})\\n`;
    }

    detailsText += `\\n買主詳細ページ:\\n${window.location.origin}/buyers/${buyer.buyer_number}\\n` +
      `\\n内覧前日確認事項: ${buyer.pre_viewing_notes || 'なし'}`;

    const details = encodeURIComponent(detailsText);

    // 担当従業員をゲストとして追加（addパラメータを使用）
    // これにより、担当従業員のカレンダーにもイベントが表示される
    const addParam = assignedEmail ? `&add=${encodeURIComponent(assignedEmail)}` : '';

    // タイムゾーンを指定（日本時間）
    const ctz = '&ctz=Asia/Tokyo';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}${addParam}${ctz}`;
  }

  /**
   * Googleカレンダー用の日時フォーマット（YYYYMMDDTHHmmss）
   * @param date - フォーマットする日時
   * @returns フォーマットされた日時文字列
   */
  private static formatDateForCalendar(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}`;
  }
}
'''

with open('frontend/frontend/src/services/CalendarLinkGenerator.ts', 'wb') as f:
    f.write(calendar_content.encode('utf-8'))
print('CalendarLinkGenerator.ts: OK')

# ========== buyerEnumOptions.ts ==========
buyer_enum_content = '''/**
 * 買主登録画面のENUM選択肢定義
 * 表示順・選択肢の変更は一元管理
 */

// 最新状況
export const LATEST_STATUS_ENUM_OPTIONS = [
  'A:この物件を前向きに入ってくる（こちらからの一押しが必要）',
  'B:1年以内に引っ越し予定はあるが、この物件ではない（希望条件や日程たちが合わない）',
  'C:引っ越しは1年以上先',
  'D:信頼・追客不要案件（知人や確度が弱く追客不要案件等）',
  '買い逃れました',
  '買（一般 成約）',
  '買（一般 失注）',
  '買（仲介 成約）',
  '買（仲介 失注）',
  '買（仲介 現状、援護）',
  '成約',
  '2番手',
  '3番手',
  'AZ:Aだが次回日待ち',
  '2番手以降物件出待ち',
  '3番手以降物件出待ち',
];

// 問合せ元
export const INQUIRY_SOURCE_ENUM_OPTIONS = [
  '問合せ（at home）',
  '問合せ（スーモ）',
  "問合せ（HOME'S/goo）",
  '問合せ（いふりP）',
  '問合せ（紹介）',
  '問合せ（チラシ）',
  '問合せ（自社サイト他）',
  '問合せ（知人）',
  'メール（at home）',
  'メール（スーモ）',
  'メール（いふりP）',
  'メール（チラシ）',
  'メール（紹介）',
  'メール（自社サイト他）',
  '公開前送信メール',
  '値下げ送信メール',
  'LINE（at home）',
  '来店',
  '売主',
  'ピンリッチ（at home）',
  'ピンリッチ（スーモ）',
  'ピンリッチ（いふりP）',
  'ピンリッチ（内覧）',
  'ピンリッチ（営業）',
  'ピンリッチ（チラシ）',
  'ピンリッチ（紹介）',
  'ピンリッチ（電話）',
  'ピンリッチ（メール設定済）',
  'ピンリッチ（物件条件変更）',
  'ピンリッチ（他）',
  '全て他',
  '紹介',
  '送信追客アンケート',
  '2件目以降',
];

// 他物件になる可能性
export const OTHER_PROPERTY_HEARING_OPTIONS = [
  '済',
  '未（先方連絡したが返事取れず）',
  '確認方法',
];

// 内覧促進メール不要
export const VIEWING_PROMOTION_EMAIL_OPTIONS = [
  '不要',
];

// メール種別
export const EMAIL_TYPE_ENUM_OPTIONS = [
  'メールアドレス確認',
  '内覧促進メール（初、他）',
  '内覧促進メール（初、許可不要）',
  '内覧促進メール（初、営業中へ要許可',
  '売主あり内覧NG',
  '売主あり内覧OK',
  '前日確認が必要ない',
  '前日確認が必要ない（買主あり・物件待ち同時）',
  '物件指定なし送信（Pinrich）',
  '定期送信',
  '指定ヒアリング',
];

// メア確認
export const EMAIL_CONFIRMATION_OPTIONS = [
  '確認OK',
  '聞かれる（rもって待っていない）',
  '未確認',
  '送信失敗あり',
];

// 送信種別
export const DISTRIBUTION_TYPE_ENUM_OPTIONS = [
  '要',
  '不要',
];

// 駐車数
export const PARKING_SPACES_OPTIONS = [
  '1台',
  '2台以上',
  '3台以上',
  '10台以上',
  '不要',
];

// 月極でも可
export const MONTHLY_PARKING_OK_OPTIONS = [
  '可',
  '不可',
  'どちらでも',
];

// Pinrich
export const PINRICH_OPTIONS = [
  '送信中',
  'クローズ',
  '登録不要（不可）',
  '500万以上設定済み',
  '送信後（確認より）',
  '登録無い',
  '2件目以降',
  '受信エラー',
];

// 内覧未確定
export const VIEWING_UNCONFIRMED_OPTIONS = [
  '未確定',
];

// 画像チャット送信
export const IMAGE_CHAT_SENT_OPTIONS = [
  'Y(送信済)',
  'N(送信無)',
];

// 仮審査
export const PRELIMINARY_SCREENING_OPTIONS = [
  '済',
  '未（予定日中）',
  '未',
];

// エリア
export const AREA_OPTIONS = [
  '①中心部（大分市・別府市・由布市）',
  '②南中心部（臼杵、津久見、佐伯）',
  '③西中心部（竹田・大分市）',
  '④北中心部（国東、杵築）',
  '⑤大中心部（大分市・日出・江津・杵築・別府）',
  '⑥東中心部（漁大分・大分市・宇佐）',
  '⑦南中心部（大分市、南部）',
  '⑧東中心部（大分市・日出・新別府・宇佐・中心部）',
  '⑨中部中心部（大分市・浜田・圏外・豊後大野・江津・別府）',
  '⑩中部中心部（大分市・浜田・圏外・豊後大野・江津・別府）',
  '⑪蛹鈴Κ中心部（北蟾晏屁の貉ｯ・北蟾晄ｵ懃伐逕ｺ・大分市・一贋ｺｺ本逕ｺ・一贋ｺｺ繧ｱ豬懶ｼ・',
  '⑫日中心部（大分市・新別府・南宇佐・中心部・大分市・日出ケ丘）',
  '⑬津ｱ螻ｱ中心部（大分市・浜田・圏外・中心部）',
  '⑭鮓ｴ隕句床中心部（大分市・浜田・圏外・中心部・中鬆郁ｳ蜈・伴）',
  '⑮蛻･蠎懆･ｿ中心部（大分市・中蟲ｶ逕ｺ・搨螻ｱ逕ｺ・宇佐・豊後・圏外・圏外）',
  '⑯大分市',
  '⑰別府市',
  '⑱別府市（中螟ｮ逕ｺ・燕本逕ｺ・一顔伐の貉ｯ逕ｺ・㍽蜿｣中逕ｺ・宇佐驥主哨逕ｺ・燕逕ｺ）',
  '⑲（よりｸ具ｼ亥漉遶狗浹・貞玄・大分市・Ν繝溘・繝ｫの荳倥∫浹蝙｣譚ｱ・北蟾昜ｸｭ螟ｮ逕ｺ）',
];

// 希望物件種別
export const DESIRED_PROPERTY_TYPE_OPTIONS = [
  '戸建て',
  'マンション',
  '土地',
  '戸建て、土地',
  '戸建て、マンション',
  '戸建て、マンション、土地',
  'マンション、土地',
  '収益物件',
];

// 価格帯（戸建て）
export const PRICE_RANGE_DETACHED_OPTIONS = [
  '指定なし',
  '~1900万円',
  '1000万円~2999万円',
  '2000万円以上',
  'ヒアリングできず',
];

// 価格帯（マンション）
export const PRICE_RANGE_MANSION_OPTIONS = [
  '指定なし',
  '~1900万円',
  '1000万円~2999万円',
  '2000万円以上',
];

// 価格帯（土地）
export const PRICE_RANGE_LAND_OPTIONS = [
  '指定なし',
  '~1900万円',
  '1000万円~2999万円',
  '2000万円以上',
];

// 築年数
export const BUILDING_AGE_OPTIONS = [
  '新築',
  '~3年',
  '~5年',
  '~10年',
  '~15年',
  '~25年',
  '~30年',
];

// 間取り
export const FLOOR_PLAN_OPTIONS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7~',
];

// 温泉あり
export const HOT_SPRING_OPTIONS = [
  'あり',
  'どちらでも',
  'なし',
];

// 庭付き
export const GARDEN_OPTIONS = [
  'どちらでも',
  'あり',
  'なし',
];

// ペット可
export const PET_ALLOWED_OPTIONS = [
  '可',
  '不可',
  'どちらでも',
];

// 高層階
export const HIGH_FLOOR_OPTIONS = [
  '高層階',
  'どちらでも',
  '・詮',
  '低層階',
];

// 角部屋
export const CORNER_ROOM_OPTIONS = [
  '角部屋希望',
  'どちらでも',
];

// 現在住居
export const CURRENT_RESIDENCE_OPTIONS = [
  '持家（戸建て）',
  '賃貸',
  '持家（マンション）',
  '不明',
];

// 眺望・景色
export const GOOD_VIEW_OPTIONS = [
  '海景色',
  'どちらでも',
];
'''

with open('frontend/frontend/src/utils/buyerEnumOptions.ts', 'wb') as f:
    f.write(buyer_enum_content.encode('utf-8'))
print('buyerEnumOptions.ts: OK')

# BOMチェック
for path in [
    'frontend/frontend/src/services/CalendarLinkGenerator.ts',
    'frontend/frontend/src/utils/buyerEnumOptions.ts',
]:
    with open(path, 'rb') as f:
        bom = f.read(3)
    if bom == b'\xef\xbb\xbf':
        print(f'WARNING: BOM found in {path}')
    else:
        print(f'BOM OK: {path}')
