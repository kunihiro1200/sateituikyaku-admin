ts = r"""
// ============================================================
// ページ4: 資金計画書
// ============================================================
export function generatePage4Html(propertyAddress: string, propertyPrice: number | null, propertyType: string | undefined, today: string): string {
  const price = propertyPrice || 0;
  const inshi = price<=1000000?500:price<=5000000?1000:price<=10000000?5000:price<=50000000?10000:30000;
  const shoyuken = price>=25000000?300000:200000;
  const chukai = price<=8000000?330000:Math.round((price*0.03+60000)*1.1);
  const kasai = (propertyType&&propertyType.includes('マンション'))?200000:300000;
  const GINKO_INSHI = 22000;
  const GINKO_JIMU = 220000;
  const shokeihi = inshi+shoyuken+chukai+kasai+GINKO_INSHI+GINKO_JIMU;
  const total = price+shokeihi;
  const borrowing = shokeihi;
  function monthly(principal:number,rate:number,years:number):number{
    if(principal<=0)return 0;
    const r=rate/12/100,n=years*12;
    if(r===0)return Math.round(principal/n);
    return Math.round(principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));
  }
  const m_hendo = monthly(borrowing,0.95,35);
  const m_flat = monthly(borrowing,1.30,35);
  const f = (n:number)=>n.toLocaleString('ja-JP');
  const thG = 'background:#d9d9d9;font-weight:bold;';
  const thF = 'background:#f2f2f2;font-weight:bold;';
  const td = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const loanRow = (lender:string,rate:number,m:number)=>`<tr>
    <td style="${td}">${lender}</td><td style="${td};text-align:right;">35</td>
    <td style="${td};text-align:right;">${f(borrowing)}</td>
    <td style="${td};text-align:right;">${rate.toFixed(2)}%</td>
    <td style="${td};text-align:right;">${f(m)}</td>
    <td style="${td};text-align:right;">50,000</td>
  </tr>`;
  const detailRow = (label:string,amount:string,note:string)=>`<tr>
    <td style="${td}">${label}</td>
    <td style="${td};text-align:right;">${amount}</td>
    <td style="${td};font-size:7.5pt;white-space:pre-wrap;">${note}</td>
  </tr>`;
  return `<div style="width:210mm;min-height:297mm;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="border:2px solid #000;text-align:center;padding:8px;margin-bottom:4px;">
      <span style="font-size:14pt;font-weight:bold;">資金計画書《概算》</span>
    </div>
    <div style="text-align:right;font-size:9pt;margin-bottom:2px;">作成日：　${today}</div>
    <div style="font-size:10pt;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:12px;">${propertyAddress}</div>
    <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:16px;">
      <tr><td colspan="2" style="${td};${thG};text-align:center;font-size:11pt;">購入費用（概算）</td></tr>
      <tr><td style="${td};${thF};width:40%;">物件価格</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(price)} 円</td></tr>
      <tr><td style="${td};${thF};">諸経費</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(shokeihi)} 円</td></tr>
      <tr><td style="${td};${thF};">総額</td><td style="${td};text-align:right;font-size:11pt;font-weight:bold;">${f(total)} 円</td></tr>
    </table>
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;">【住宅ローン】★変動金利</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr style="${thF}">
        ${['借入先','借入期間（年）','借入金額','金利','月額返済額','ボーナス返済（2回）'].map(h=>`<th style="${td};text-align:center;font-size:8pt;">${h}</th>`).join('')}
      </tr>
      ${loanRow('大分銀行',0.95,m_hendo)}
    </table>
    <div style="font-size:9pt;font-weight:bold;margin-bottom:4px;">【住宅ローン】★フラット35（固定金利）</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="${thF}">
        ${['借入先','借入期間（年）','借入金額','金利','月額返済額','ボーナス返済（2回）'].map(h=>`<th style="${td};text-align:center;font-size:8pt;">${h}</th>`).join('')}
      </tr>
      ${loanRow('ARUHI',1.30,m_flat)}
    </table>
    <table style="width:100%;border-collapse:collapse;flex:1;">
      <tr>
        <th style="${td};${thG};text-align:center;flex:2;">内訳</th>
        <th style="${td};${thG};text-align:center;width:120px;">金額（概算）</th>
        <th style="${td};${thG};text-align:center;width:160px;">備考</th>
      </tr>
      ${detailRow('印紙代（売買契約書貼付）',f(inshi),'')}
      ${detailRow('所有権移転、抵当権設定費用等',f(shoyuken),'評価額によって異なります')}
      ${detailRow('仲介手数料',f(chukai),'●801万円以上（3%+6万×消費税）\n●800万円以下（33万円）')}
      ${detailRow('固定資産税・都市計画税の清算金','実費','引渡日で按分します')}
      ${detailRow('火災保険料・地震保険料',f(kasai),'プランによって異なります')}
      ${detailRow('銀行金消契約印紙代',f(GINKO_INSHI),'住宅ローンの契約書に貼る印紙です')}
      ${detailRow('銀行融資事務手数料',f(GINKO_JIMU),'各銀行により異なります')}
      <tr><td style="${td}"></td><td style="${td}"></td><td style="${td}"></td></tr>
      <tr>
        <td style="${td};font-weight:bold;font-size:10pt;">諸経費合計（概算）</td>
        <td style="${td};text-align:right;font-weight:bold;font-size:10pt;">${f(shokeihi)}</td>
        <td style="${td};font-size:7.5pt;">*物件価格以外にかかる費用です</td>
      </tr>
    </table>
    <div style="margin-top:8px;padding-top:4px;border-top:1px solid #000;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:8pt;">㈱いふう　大分市舞鶴町1-3-30　TEL:097-533-2022　MAIL: tenant@ifoo-oita.com</span>
      <span style="font-size:7pt;color:#666;">info→3</span>
    </div>
  </div>`;
}
"""
with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'a', encoding='utf-8') as f:
    f.write(ts)
print('Part4 done')
