import os

file_path = r'frontend\frontend\src\components\nearbyBuyersPrintUtils.ts'

new_content = '''// \u5370\u5237\u7528HTML\u3092\u751f\u6210\u3059\u308b\u30e6\u30fc\u30c6\u30a3\u30ea\u30c6\u30a3\u95a2\u6570

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
 * \u5370\u5237\u7528HTML\u3092\u751f\u6210\u3059\u308b\u7d14\u7c8b\u95a2\u6570
 * @param buyers - \u5168\u8cb7\u4e3b\u30ea\u30b9\u30c8
 * @param selectedBuyerNumbers - \u9078\u629e\u3055\u308c\u305f\u8cb7\u4e3b\u756a\u53f7\u306e\u30bb\u30c3\u30c8
 * @param isNameHidden - \u540d\u524d\u3092\u9ed2\u5857\u308a\u306b\u3059\u308b\u304b\u3069\u3046\u304b
 * @returns \u5370\u5237\u7528HTML\u6587\u5b57\u5217
 */
export const buildPrintContent = (
  buyers: NearbyBuyer[],
  selectedBuyerNumbers: Set<string>,
  isNameHidden: boolean
): string => {
  // \u9078\u629e\u884c\u306e\u307f\u3092\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0
  const selectedBuyers = buyers.filter(b => selectedBuyerNumbers.has(b.buyer_number));

  const rows = selectedBuyers.map(buyer => {
    // \u554f\u5408\u305b\u7269\u4ef6\u60c5\u5831\uff1a\u7a2e\u5225 + \u4f4f\u6240 + \u4fa1\u683c
    const inquiryParts: string[] = [];
    if (buyer.inquiry_property_type) inquiryParts.push(buyer.inquiry_property_type);
    if (buyer.property_address) inquiryParts.push(buyer.property_address);
    if (buyer.inquiry_price) inquiryParts.push(`${(buyer.inquiry_price / 10000).toLocaleString()}\u4e07\u5186`);
    const inquiryInfo = inquiryParts.join(' / ') || '-';

    // \u30d2\u30a2\u30ea\u30f3\u30b0/\u5185\u89a7\u7d50\u679c
    const hearingOrResult = buyer.viewing_result_follow_up || buyer.inquiry_hearing || '-';

    return `
    <tr>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.buyer_number}</td>
      <td style="border:1px solid #ccc; padding:4px; ${isNameHidden ? 'background-color:black;color:black;' : ''}">
        ${buyer.name || '-'}
      </td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.reception_date ? new Date(buyer.reception_date).toLocaleDateString('ja-JP') : '-'}</td>
      <td style="border:1px solid #ccc; padding:4px;">${inquiryInfo}</td>
      <td style="border:1px solid #ccc; padding:4px; white-space:pre-wrap; max-width:200px;">${hearingOrResult}</td>
      <td style="border:1px solid #ccc; padding:4px;">${buyer.latest_status || '-'}</td>
    </tr>`;
  }).join('');

  return `
    <div style="font-family: sans-serif; padding: 20px;">
      <div style="text-align: right; margin-bottom: 16px;">
        <div>\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046</div>
        <div>\u5927\u5206\u5e02\u821e\u9db4\u753a1-3-30 ST\u30d3\u30eb\uff11F</div>
        <div>097-533-2022</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ccc; padding:4px;">\u8cb7\u4e3b\u756a\u53f7</th>
            <th style="border:1px solid #ccc; padding:4px;">\u540d\u524d</th>
            <th style="border:1px solid #ccc; padding:4px;">\u53d7\u4ed8\u65e5</th>
            <th style="border:1px solid #ccc; padding:4px;">\u554f\u5408\u305b\u7269\u4ef6\u60c5\u5831</th>
            <th style="border:1px solid #ccc; padding:4px;">\u30d2\u30a2\u30ea\u30f3\u30b0/\u5185\u89a7\u7d50\u679c</th>
            <th style="border:1px solid #ccc; padding:4px;">\u6700\u65b0\u72b6\u6cc1</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};
'''

with open(file_path, 'wb') as f:
    f.write(new_content.encode('utf-8'))

print('Done! UTF-8 written.')

# BOMチェック
with open(file_path, 'rb') as f:
    head = f.read(3)
print('BOM check:', repr(head))
