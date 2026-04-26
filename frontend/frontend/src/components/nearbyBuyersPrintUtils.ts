// 印刷用HTMLを生成するユーティリティ関数

export interface NearbyBuyer {
  buyer_number: string;
  name: string;
  distribution_areas: string[];
  latest_status: string;
  viewing_date: string;
  reception_date?: string;
  inquiry_hearing?: string;
  viewing_result_follow_up?: string;
  email?: string;
  phone_number?: string;
  property_address?: string | null;
  inquiry_property_type?: string | null;
  inquiry_price?: number | null;
  // 希望価格フィールド（タスク1.1）
  price_range_house?: string | null;
  price_range_apartment?: string | null;
  price_range_land?: string | null;
}

/**
 * 物件種別に応じた希望価格文字列を取得する（純粋関数）
 * NearbyBuyersList.tsx の getDesiredPriceStr と同等のロジック
 * @param buyer - 買主データ
 * @param propertyType - 物件種別
 * @returns 希望価格文字列、または null
 */
export const getDesiredPriceForPrint = (
  buyer: NearbyBuyer,
  propertyType?: string | null
): string | null => {
  const pt = (propertyType || '').trim();
  if (pt === '戸' || pt === '戸建' || pt === '戸建て') {
    return buyer.price_range_house ?? null;
  }
  if (pt === 'マ' || pt === 'マンション' || pt === 'アパート') {
    return buyer.price_range_apartment ?? null;
  }
  if (pt === '土' || pt === '土地') {
    return buyer.price_range_land ?? null;
  }
  // 種別不明またはundefined: house → apartment → land の順でフォールバック
  return buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land || null;
};

/**
 * 印刷用HTMLを生成する純粋関数
 * @param buyers - 全買主リスト
 * @param selectedBuyerNumbers - 選択された買主番号のセット
 * @param isNameHidden - 名前を黒塗りにするかどうか
 * @param propertyType - 物件種別（省略可能）
 * @param propertyAddress - 物件住所（省略可能）。有効な文字列の場合、ヘッダーに見出しを表示する
 * @returns 印刷用HTML文字列
 */
export const buildPrintContent = (
  buyers: NearbyBuyer[],
  selectedBuyerNumbers: Set<string>,
  isNameHidden: boolean,
  propertyType?: string | null,
  propertyAddress?: string | null
): string => {
  // 選択行のみをフィルタリング
  const selectedBuyers = buyers.filter(b => selectedBuyerNumbers.has(b.buyer_number));

  const rows = selectedBuyers.map(buyer => {
    // 問合せ物件情報：種別 + 住所 + 価格
    const inquiryParts: string[] = [];
    if (buyer.inquiry_property_type) inquiryParts.push(buyer.inquiry_property_type);
    if (buyer.property_address) inquiryParts.push(buyer.property_address);
    if (buyer.inquiry_price) inquiryParts.push(`${(buyer.inquiry_price / 10000).toLocaleString()}万円`);
    const inquiryInfo = inquiryParts.join(' / ') || '-';

    // 希望価格行（タスク1.5）
    const desiredPrice = getDesiredPriceForPrint(buyer, propertyType);
    const desiredPriceLine = desiredPrice
      ? `<br><span style="font-size:11px;">希望価格：${desiredPrice}</span>`
      : '';

    // ヒアリング/内覧結果
    const hearingOrResult = buyer.viewing_result_follow_up || buyer.inquiry_hearing || '-';

    return `
    <tr>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.buyer_number}</td>
      <td style="border:1px solid #ccc; padding:4px;">
        ${isNameHidden
          ? `<span style="display:inline-block; position:relative; white-space:nowrap;">
               <span style="visibility:hidden;">${buyer.name || '-'}</span>
               <span style="position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); height:6px; background:black; display:block;"></span>
             </span>`
          : (buyer.name || '-')
        }
      </td>
      <td style="border:1px solid #ccc; padding:4px;">${(() => {
        if (!buyer.reception_date) return '-';
        const d = new Date(buyer.reception_date);
        // 2024年12月31日以前は「-」を表示
        return d <= new Date('2024-12-31') ? '-' : d.toLocaleDateString('ja-JP');
      })()}</td>
      <td style="border:1px solid #ccc; padding:4px;">${inquiryInfo}${desiredPriceLine}</td>
      <td style="border:1px solid #ccc; padding:4px; white-space:pre-wrap; max-width:200px;">${hearingOrResult}</td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.latest_status || '-'}</td>
    </tr>`;
  }).join('');

  return `
    <div style="font-family: sans-serif; padding: 20px;">
      <div style="text-align: right; margin-bottom: 16px;">
        <div>株式会社いふう</div>
        <div>大分市舞鶴町1-3-30 STビル１F</div>
        <div>097-533-2022</div>
      </div>
      ${propertyAddress && propertyAddress.trim() ? `<h2 style="font-size:20px; margin-bottom:16px; margin-top:8px;">${propertyAddress.trim()}の近隣にお問合せのあった買主様</h2>` : ''}
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:4px;">買主番号</th>
            <th style="border:1px solid #ccc; padding:4px;">名前</th>
            <th style="border:1px solid #ccc; padding:4px;">受付日</th>
            <th style="border:1px solid #ccc; padding:4px;">問合せ物件情報</th>
            <th style="border:1px solid #ccc; padding:4px;">ヒアリング/内覧結果</th>
            <th style="border:1px solid #ccc; padding:4px;">最新状況</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};
