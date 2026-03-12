/**
 * 買主希望条件の選択肢定義
 */

// 希望エリア
export const AREA_OPTIONS = [
  { value: '①中学校区（府内中・泉南中・大分中・大分西中）', label: '①中学校区（府内中・泉南中・大分中・大分西中）' },
  { value: '②中学校区（住吉中・坂ノ市中・次浜）', label: '②中学校区（住吉中・坂ノ市中・次浜）' },
  { value: '③中学校区（王子中・大道中）', label: '③中学校区（王子中・大道中）' },
  { value: '④中学校区（鶴崎中・春日浦）', label: '④中学校区（鶴崎中・春日浦）' },
  { value: '⑤中学校区（大在中・稙田中・稲田中・佐賀関）', label: '⑤中学校区（大在中・稙田中・稲田中・佐賀関）' },
  { value: '⑥中学校区（滝尾中・大南中・南大分・三重）', label: '⑥中学校区（滝尾中・大南中・南大分・三重）' },
  { value: '⑦中学校区（城南中・明野浜）', label: '⑦中学校区（城南中・明野浜）' },
  { value: '⑧中学校区（愛宕中・竹中・翔南中・中判田）', label: '⑧中学校区（愛宕中・竹中・翔南中・中判田）' },
  { value: '⑨郡部中学校区（滝尾郡浹・田中・援護院・腰蝨偵・稲田隕具ｼ礼ｵ・・ｼ咏ｵ・Ν繝溘お繝ｼ繝ｫ髯､縺擾ｼ・', label: '⑨郡部中学校区（滝尾郡浹・田中・援護院・腰蝨偵・稲田隕具ｼ礼ｵ・・ｼ咏ｵ・Ν繝溘お繝ｼ繝ｫ髯､縺擾ｼ・' },
  { value: '⑩中部中学校区（鶴崎闕伜恍・浹蝙｣譚ｱ・圏豬懊∽ｺｬ逕ｺ・眠貂ｯ逕ｺ）', label: '⑩中部中学校区（鶴崎闕伜恍・浹蝙｣譚ｱ・圏豬懊∽ｺｬ逕ｺ・眠貂ｯ逕ｺ）' },
  { value: '⑪蛹鈴Κ中学校区（ｺ蟾晏屁縺ｮ貉ｯ・ｺ蟾晄ｵ懃伐逕ｺ・大隕ｳ螻ｱ・ｸ贋ｺｺ譛ｬ逕ｺ・ｸ贋ｺｺ繧ｱ豬懶ｼ・', label: '⑪蛹鈴Κ中学校区（ｺ蟾晏屁縺ｮ貉ｯ・ｺ蟾晄ｵ懃伐逕ｺ・大隕ｳ螻ｱ・ｸ贋ｺｺ譛ｬ逕ｺ・ｸ贋ｺｺ繧ｱ豬懶ｼ・' },
  { value: '⑫譛晄律中学校区（域・遉ｬ・眠蛻･蠎懊∫↓螢ｲ・圏荳ｭ・ｫｹ縺ｮ蜀・∝､ｧ逡代∵悃譌･繧ｱ荳假ｼ・', label: '⑫譛晄律中学校区（域・遉ｬ・眠蛻･蠎懊∫↓螢ｲ・圏荳ｭ・ｫｹ縺ｮ蜀・∝､ｧ逡代∵悃譌･繧ｱ荳假ｼ・' },
  { value: '⑬譚ｱ螻ｱ中学校区（鶴崎螻ｱ・ｱｱ縺ｮ蜿｣）', label: '⑬譚ｱ螻ｱ中学校区（鶴崎螻ｱ・ｱｱ縺ｮ蜿｣）' },
  { value: '⑭鮓ｴ隕句床中学校区（滝尾鬆郁ｳ・浹蝙｣譚ｱ・浹蝙｣隘ｿ・ｸｭ鬆郁ｳ蜈・伴）', label: '⑭鮓ｴ隕句床中学校区（滝尾鬆郁ｳ・浹蝙｣譚ｱ・浹蝙｣隘ｿ・ｸｭ鬆郁ｳ蜈・伴）' },
  { value: '⑮蛻･蠎懆･ｿ中学校区（域・逕ｺ・ｸｭ蟲ｶ逕ｺ・搨螻ｱ逕ｺ・ｫ狗伐逕ｺ・ｵ懆х・ｱｱ螳ｶ）', label: '⑮蛻･蠎懆･ｿ中学校区（域・逕ｺ・ｸｭ蟲ｶ逕ｺ・搨螻ｱ逕ｺ・ｫ狗伐逕ｺ・ｵ懆х・ｱｱ螳ｶ）' },
  { value: '大分市外', label: '大分市外' },
  { value: '別府市', label: '別府市' },
  { value: '別府市外（中部・霎ｺ・ｸｭ螟ｮ逕ｺ・ｧ・燕譛ｬ逕ｺ・ｸ顔伐縺ｮ貉ｯ逕ｺ・㍽蜿｣荳ｭ逕ｺ・∬･ｿ驥主哨逕ｺ・ｧ・燕逕ｺ）', label: '別府市外（中部・霎ｺ・ｸｭ螟ｮ逕ｺ・ｧ・燕譛ｬ逕ｺ・ｸ顔伐縺ｮ貉ｯ逕ｺ・㍽蜿｣荳ｭ逕ｺ・∬･ｿ驥主哨逕ｺ・ｧ・燕逕ｺ）' },
  { value: '⑱驩・ｼｪ邱壹ｈ繧贋ｸ具ｼ亥漉遶狗浹・貞玄・鶴崎闕伜恍・Ν繝溘・繝ｫ縺ｮ荳倥∫浹蝙｣譚ｱ・ｺ蟾昜ｸｭ螟ｮ逕ｺ）', label: '⑱驩・ｼｪ邱壹ｈ繧贋ｸ具ｼ亥漉遶狗浹・貞玄・鶴崎闕伜恍・Ν繝溘・繝ｫ縺ｮ荳倥∫浹蝙｣譚ｱ・ｺ蟾昜ｸｭ螟ｮ逕ｺ）' },
];

// 希望種別
export const DESIRED_PROPERTY_TYPE_OPTIONS = [
  { value: '戸建て', label: '戸建て' },
  { value: 'マンション', label: 'マンション' },
  { value: '土地', label: '土地' },
  { value: '戸建て・土地', label: '戸建て・土地' },
  { value: '戸建て・マンション', label: '戸建て・マンション' },
  { value: '戸建て・マンション・土地', label: '戸建て・マンション・土地' },
  { value: 'マンション・土地', label: 'マンション・土地' },
  { value: '条件次第', label: '条件次第' },
];

// 価格帯（戸建て）
export const PRICE_RANGE_DETACHED_OPTIONS = [
  { value: '指定なし', label: '指定なし' },
  { value: '~1900万', label: '~1900万' },
  { value: '1000万~2999万', label: '1000万~2999万' },
  { value: '2000万以上', label: '2000万以上' },
  { value: 'ヒアリングできず', label: 'ヒアリングできず' },
];

// 価格帯（マンション）
export const PRICE_RANGE_MANSION_OPTIONS = [
  { value: '指定なし', label: '指定なし' },
  { value: '~1900万', label: '~1900万' },
  { value: '1000万~2999万', label: '1000万~2999万' },
  { value: '2000万以上', label: '2000万以上' },
];

// 価格帯（土地）
export const PRICE_RANGE_LAND_OPTIONS = [
  { value: '指定なし', label: '指定なし' },
  { value: '~1900万', label: '~1900万' },
  { value: '1000万~2999万', label: '1000万~2999万' },
  { value: '2000万以上', label: '2000万以上' },
];

// 希望築年数
export const BUILDING_AGE_OPTIONS = [
  { value: '新築', label: '新築' },
  { value: '~3年', label: '~3年' },
  { value: '~5年', label: '~5年' },
  { value: '~10年', label: '~10年' },
  { value: '~15年', label: '~15年' },
  { value: '~25年', label: '~25年' },
  { value: '~30年', label: '~30年' },
];

// 希望間取り
export const FLOOR_PLAN_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7~', label: '7~' },
];

// 駐車台数
export const PARKING_SPACES_OPTIONS = [
  { value: '1台', label: '1台' },
  { value: '2台以上', label: '2台以上' },
  { value: '3台以上', label: '3台以上' },
  { value: '10台以上', label: '10台以上' },
  { value: '不要', label: '不要' },
];

// 温泉あり
export const HOT_SPRING_OPTIONS = [
  { value: 'あり', label: 'あり' },
  { value: 'どちらでも', label: 'どちらでも' },
  { value: 'なし', label: 'なし' },
];

// 庭付き
export const GARDEN_OPTIONS = [
  { value: 'どちらでも', label: 'どちらでも' },
  { value: 'あり', label: 'あり' },
  { value: 'なし', label: 'なし' },
];

// ペット可
export const PET_ALLOWED_OPTIONS = [
  { value: '可', label: '可' },
  { value: '不可', label: '不可' },
  { value: 'どちらでも', label: 'どちらでも' },
];

// 高層階
export const HIGH_FLOOR_OPTIONS = [
  { value: '高層階', label: '高層階' },
  { value: 'どちらでも', label: 'どちらでも' },
  { value: '低層', label: '低層' },
  { value: '低層階', label: '低層階' },
];

// 角部屋
export const CORNER_ROOM_OPTIONS = [
  { value: '角部屋希望', label: '角部屋希望' },
  { value: 'どちらでも', label: 'どちらでも' },
];

// 眺望良好
export const GOOD_VIEW_OPTIONS = [
  { value: '眺望重視', label: '眺望重視' },
  { value: 'どちらでも', label: 'どちらでも' },
];

// 月極でも可
export const MONTHLY_PARKING_OK_OPTIONS = [
  { value: '可', label: '可' },
  { value: '不可', label: '不可' },
  { value: 'どちらでも', label: 'どちらでも' },
];
