import os

ts = r"""
// ============================================================
// ページ2: 買付申込書
// ============================================================
export function generatePage2Html(propertyAddress: string, propertyPrice: number | null): string {
  const priceStr = propertyPrice ? propertyPrice.toLocaleString('ja-JP') : '';
  const tdStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const thStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;';
  return `<div style="width:210mm;min-height:297mm;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;">
    <div style="font-size:18pt;font-weight:bold;text-align:center;text-decoration:underline;margin-bottom:16px;">買付申込書</div>
    <div style="text-align:right;margin-bottom:24px;font-size:10pt;">　　　　年　　　月　　　日</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="${thStyle}">住所</td><td style="${tdStyle}"></td></tr>
      <tr><td colspan="2" style="${tdStyle}">□借家　□持ち家（売却ご予定　ある・なし）</td></tr>
      <tr><td style="${thStyle}">連絡先電話番号</td><td style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">メールアドレス</td><td style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">契約名義人氏名</td><td style="${tdStyle}"></td></tr>
      <tr><td style="${thStyle}">勤務先</td><td style="${tdStyle}"></td></tr>
      <tr>
        <td style="${thStyle}">勤続年数</td>
        <td style="${tdStyle}"></td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:80px;">年収</td>
        <td style="${tdStyle}"></td>
      </tr>
    </table>
    <div style="font-size:9pt;margin-bottom:16px;">
      仲介業者：株式会社いふう<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;大分市舞鶴町1-3-30<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TEL：097-533-2022　FAX：<span style="text-decoration:underline;">097-529-7160</span>
    </div>
    <div style="margin-bottom:16px;">私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。</div>
    <div style="text-align:center;margin-bottom:16px;">記</div>
    <div style="display:flex;align-items:baseline;margin-bottom:16px;padding-left:4px;">
      <span style="min-width:80px;">１，物件</span>
      <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin-left:8px;text-align:center;font-size:12pt;font-weight:bold;">${propertyAddress}</div>
    </div>
    <div style="padding-left:4px;margin-bottom:16px;">
      <div style="margin-bottom:8px;">２，条件</div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:12px;">
        <span style="min-width:80px;">購入価格</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;text-align:center;font-size:12pt;font-weight:bold;">${priceStr}</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;margin-bottom:12px;">
        <span style="min-width:80px;">手付金</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;margin:0 8px;">&nbsp;</div>
        <span>円</span>
      </div>
      <div style="display:flex;align-items:baseline;padding-left:48px;gap:8px;">
        <span>契約日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
        <span style="margin-left:16px;">決済日（仮）</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>月</span><div style="border-bottom:1px solid #000;width:40px;">&nbsp;</div><span>日</span>
      </div>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:100px;">３，支払い方法</span>
      <span style="margin-left:32px;">□ 銀行融資　　　　　　　□ 自己資金</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:100px;">４，有効期限</span>
      <span style="margin-left:32px;">本書の有効期間は　提出日より　<strong>２週間</strong>　といたします。</span>
    </div>
    <div style="display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;">
      <span style="min-width:140px;">５，火災保険の見積もり</span>
      <span style="margin-left:8px;">希望する　・　希望しない</span>
    </div>
    <div style="padding-left:4px;margin-bottom:16px;"><div>６，その他条件</div></div>
    <div style="border:1px solid #000;padding:12px;font-size:8.5pt;line-height:1.6;">
      <div style="font-weight:bold;margin-bottom:4px;">☐ 契約日について</div>
      <div style="margin-bottom:8px;">買付証明書を提出した日から2週間以内に契約日を協議のうえ決定し、契約締結に向けて誠意をもって進めるものとします。また、融資を受ける場合は、買付証明書提出後すぐに金融機関へローンの仮審査の手続きを開始するものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 買付後のキャンセルについて</div>
      <div style="margin-bottom:8px;">買付証明書に記載された条件に基づき、金額等の条件交渉が成立した場合、正当な理由なく一方的に買付証明書を撤回することはできないものとします。</div>
      <div style="font-weight:bold;margin-bottom:4px;">☐ 住宅ローン特約について</div>
      <div style="margin-bottom:8px;">本売買契約は、住宅ローン特約付きの契約として締結するものとします。（住宅ローン審査が否認となった場合には、契約を白紙解除できる特約を付します。）</div>
      <div style="font-size:8pt;font-weight:bold;">※本申込は購入意思を示すものであり、先に他のお客様より申込が入っている場合には、2番手以降での受付となる可能性があることをあらかじめご了承ください。</div>
    </div>
  </div>`;
}
"""

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'a', encoding='utf-8') as f:
    f.write(ts)
print('Part2 done')
