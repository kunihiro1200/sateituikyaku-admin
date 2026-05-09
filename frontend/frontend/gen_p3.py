ts = r"""
// ============================================================
// ページ3: 内覧証明書
// ============================================================
export function generatePage3Html(propertyAddress: string): string {
  const lineStyle = 'border:none;border-bottom:1px solid #000;display:block;width:100%;height:28px;';
  return `<div style="width:210mm;min-height:297mm;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;">
    <div style="font-size:8pt;text-align:center;margin-bottom:4px;">この媒介契約は、国土交通省が定めた標準媒介契約約款に基づく契約です。</div>
    <div style="font-size:16pt;font-weight:bold;text-align:center;letter-spacing:0.3em;margin-bottom:4px;">内　覧　証　明　書</div>
    <div style="font-size:9pt;text-align:center;margin-bottom:12px;">依頼の内容：購入</div>
    <div style="border:1px solid #000;padding:12px;margin-bottom:16px;font-size:8.5pt;line-height:1.7;">
      <div>この契約は、次の３つの契約型式のうち、専任媒介契約型式です。</div>
      <div style="font-weight:bold;margin-top:8px;">・専属専任媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができません。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができません。</div>
      <div>当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。</div>
      <div style="font-weight:bold;margin-top:8px;">・専任媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができません。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。</div>
      <div>当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。</div>
      <div style="font-weight:bold;margin-top:8px;">・一般媒介契約型式</div>
      <div>依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができます。</div>
      <div>依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。</div>
    </div>
    <div style="display:flex;align-items:baseline;margin-bottom:4px;">
      <span style="font-size:10pt;min-width:80px;">目的物件：</span>
      <div style="flex:1;border-bottom:2px solid #000;padding-bottom:4px;text-align:center;font-size:13pt;font-weight:bold;">${propertyAddress}</div>
    </div>
    <div style="text-align:center;margin:16px 0;">
      <span style="font-size:12pt;font-weight:bold;border-bottom:1px solid #000;padding-bottom:4px;">を株式会社いふうで内覧しました。</span>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:10pt;font-weight:bold;margin-bottom:12px;">【甲・依頼者】</div>
      <div style="display:flex;align-items:flex-end;margin-bottom:16px;">
        <span style="font-size:10pt;min-width:60px;margin-right:16px;">住　所</span>
        <span style="${lineStyle}"></span>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:16px;">
        <span style="font-size:10pt;min-width:60px;margin-right:16px;">氏　名</span>
        <span style="${lineStyle}"></span>
      </div>
    </div>
    <div>
      <div style="font-size:10pt;font-weight:bold;margin-bottom:12px;">【乙・宅地建物取引業者】</div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">商号（名称）</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">株式会社　威風</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">代表者</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">國廣智子</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">主たる事務所の所在地</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">大分市舞鶴町1-3-30</div>
      </div>
      <div style="display:flex;align-items:flex-end;margin-bottom:12px;">
        <span style="font-size:10pt;min-width:120px;margin-right:16px;">免許証番号</span>
        <div style="flex:1;border-bottom:1px solid #000;padding-bottom:4px;font-size:10pt;">大分県知事（３）第3183号</div>
      </div>
    </div>
  </div>`;
}
"""
with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'a', encoding='utf-8') as f:
    f.write(ts)
print('Part3 done')
