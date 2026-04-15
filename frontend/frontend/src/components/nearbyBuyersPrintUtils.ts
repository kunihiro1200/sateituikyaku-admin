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
}

/**
 * 印刷用HTMLを生成する純粋関数
 * @param buyers - 全買主リスト
 * @param selectedBuyerNumbers - 選択された買主番号のセット
 * @param isNameHidden - 名前を黒塗りにするかどうか
 * @returns 印刷用HTML文字列
 */
export const buildPrintContent = (
  buyers: NearbyBuyer[],
  selectedBuyerNumbers: Set<string>,
  isNameHidden: boolean
): string => {
  // 選択行のみをフィルタリング
  const selectedBuyers = buyers.filter(b => selectedBuyerNumbers.has(b.buyer_number));

  const rows = selectedBuyers.map(buyer => `
    <tr>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.buyer_number}</td>
      <td style="border:1px solid #ccc; padding:4px; ${isNameHidden ? 'background-color:black;color:black;' : ''}">
        ${buyer.name || '-'}
      </td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.reception_date ? new Date(buyer.reception_date).toLocaleDateString('ja-JP') : '-'}</td>
      <td style="border:1px solid #ccc; padding:4px;">${(buyer.distribution_areas || []).join(', ') || '-'}</td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.inquiry_property_type || '-'}</td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}</td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.latest_status || '-'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: sans-serif; padding: 20px;">
      <div style="text-align: right; margin-bottom: 16px;">
        <div>株式会社いふう</div>
        <div>大分市舞鶴町1-3-30 STビル１F</div>
        <div>097-533-2022</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:4px;">買主番号</th>
            <th style="border:1px solid #ccc; padding:4px;">名前</th>
            <th style="border:1px solid #ccc; padding:4px;">受付日</th>
            <th style="border:1px solid #ccc; padding:4px;">配布エリア</th>
            <th style="border:1px solid #ccc; padding:4px;">物件種別</th>
            <th style="border:1px solid #ccc; padding:4px;">価格</th>
            <th style="border:1px solid #ccc; padding:4px;">最新状況</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};
