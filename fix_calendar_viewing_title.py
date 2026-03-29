"""
BuyerViewingResultPage.tsx にカレンダータイトル・説明生成の純粋関数を追加し、
handleCalendarButtonClick のロジックを更新するスクリプト
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 変更1: generatePreDaySmsBody の前に2つの純粋関数を追加
# ============================================================

NEW_FUNCTIONS = '''/**
 * カレンダーイベントのタイトルを生成する
 * - viewing_type（専任物件用）を優先し、空の場合は viewing_type_general（一般媒介用）を使用
 * - 「立会」を含み「立会不要」を含まない場合のみ末尾に（買主氏名）を追加
 */
export function generateCalendarTitle(
  viewingType: string | undefined | null,
  viewingTypeGeneral: string | undefined | null,
  propertyAddress: string | undefined | null,
  buyerName: string | undefined | null
): string {
  const viewingTypeValue = viewingType || viewingTypeGeneral || '';
  const propertyAddr = propertyAddress || '';
  const isRittai = viewingTypeValue.includes('立会') && !viewingTypeValue.includes('立会不要');
  const buyerNameSuffix = isRittai && buyerName ? `（${buyerName}）` : '';
  return `${viewingTypeValue}${propertyAddr}${buyerNameSuffix}`.trim();
}

/**
 * カレンダーイベントの説明欄を生成する
 * 末尾に買主詳細画面のURLを追加する
 */
export function generateCalendarDescription(
  propertyAddress: string | undefined | null,
  googleMapUrl: string | undefined | null,
  buyerName: string | undefined | null,
  buyerNumber: string | undefined | null,
  phoneNumber: string | undefined | null,
  inquiryHearing: string | undefined | null
): string {
  const baseUrl = 'https://sateituikyaku-admin-frontend.vercel.app';
  return (
    `物件住所: ${propertyAddress || 'なし'}\\n` +
    `GoogleMap: ${googleMapUrl || 'なし'}\\n` +
    `\\n` +
    `お客様名: ${buyerName || buyerNumber || 'なし'}\\n` +
    `電話番号: ${phoneNumber || 'なし'}\\n` +
    `問合時ヒアリング: ${inquiryHearing || 'なし'}\\n` +
    `買主詳細: ${baseUrl}/buyers/${buyerNumber || ''}`
  );
}

'''

# generatePreDaySmsBody の直前に挿入
OLD_ANCHOR = '/**\n * 内覧前日SMS本文を生成する'
if OLD_ANCHOR not in text:
    print('ERROR: anchor not found for function insertion')
    exit(1)

text = text.replace(OLD_ANCHOR, NEW_FUNCTIONS + OLD_ANCHOR, 1)
print('変更1: 純粋関数を追加しました')

# ============================================================
# 変更2: handleCalendarButtonClick 内のタイトル・説明生成を更新
# ============================================================

OLD_TITLE_DESC = '''    // タイトルと説明を生成
    const title = `${buyer.viewing_type || buyer.viewing_type_general || '内覧'} ${property?.address || ''} ${buyer.name || buyer.buyer_number}`.trim();
    const description =
      `物件住所: ${property?.address || 'なし'}\\n` +
      `GoogleMap: ${property?.google_map_url || 'なし'}\\n` +
      `\\n` +
      `お客様名: ${buyer.name || buyer.buyer_number}\\n` +
      `電話番号: ${buyer.phone_number || 'なし'}\\n` +
      `問合時ヒアリング: ${buyer.inquiry_hearing || 'なし'}`;'''

NEW_TITLE_DESC = '''    // タイトルと説明を生成
    const title = generateCalendarTitle(
      buyer.viewing_type,
      buyer.viewing_type_general,
      property?.address,
      buyer.name
    );
    const description = generateCalendarDescription(
      property?.address,
      property?.google_map_url,
      buyer.name,
      buyer.buyer_number,
      buyer.phone_number,
      buyer.inquiry_hearing
    );'''

if OLD_TITLE_DESC not in text:
    print('ERROR: old title/description code not found')
    exit(1)

text = text.replace(OLD_TITLE_DESC, NEW_TITLE_DESC, 1)
print('変更2: handleCalendarButtonClick のタイトル・説明生成を更新しました')

# ============================================================
# UTF-8 で書き込む
# ============================================================
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerViewingResultPage.tsx を更新しました')
