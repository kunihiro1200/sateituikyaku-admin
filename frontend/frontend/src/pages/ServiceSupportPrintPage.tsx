/**
 * サービス資料 印刷プレビューページ
 *
 * ServiceSupportModal から window.open('/service-support-print?key=xxx', '_blank') で開かれる。
 * データは sessionStorage に JSON で渡される。
 * 全画像のロード完了後に自動で window.print() を呼ぶ。
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface PrintData {
  sellerNumber: string;
  ownerName: string;
  propertyAddress: string;
  items: string[]; // service id のリスト（例: ['cleaning', 'bridge']）
}

const SERVICE_LABELS: Record<string, string> = {
  cleaning:   '室内クリーニング',
  garden:     '庭の除草、草刈り',
  wallpaper:  'クロスの張替え',
  removal:    '残置物撤去',
  warranty:   '設備の1年間無償保証',
  commission: '最低価格を下回った場合 仲介手数料２％',
  bridge:     'つなぎ融資',
};

export default function ServiceSupportPrintPage() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get('key') || '';
  const [data, setData] = useState<PrintData | null>(null);

  // 画像ロードカウンタ（ref で管理してレンダリングを増やさない）
  const loadedRef      = useRef(0);
  const totalRef       = useRef(0);
  const printStarted   = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PrintData;
      totalRef.current = parsed.items.length;
      setData(parsed);
    } catch {
      // 無視
    }
  }, [key]);

  /** 画像1枚ロード完了 or エラー時 */
  const onImgDone = () => {
    loadedRef.current += 1;
    if (loadedRef.current >= totalRef.current && !printStarted.current) {
      printStarted.current = true;
      setTimeout(() => window.print(), 200);
    }
  };

  if (!data) {
    return <div style={{ padding: 20, fontFamily: 'sans-serif' }}>読み込み中...</div>;
  }

  const isFI        = data.sellerNumber.toUpperCase().startsWith('FI');
  const title       = isFI ? 'くじら不動産の売却サポート' : 'いふうの売却サポート';
  const accentColor = isFI ? '#1B3A6B' : '#00695C';
  const lightBg     = isFI ? '#EBF0F9' : '#E8F5E9';

  // ── A4 縦スペース計算 ──
  // 297mm - 余白(20) - ヘッダー(22) - 物件情報(14) - フッター(7) = 234mm
  const n       = data.items.length;
  const gapMm   = 2;
  const labelMm = 7;
  const availMm = 234;
  const cardMm  = Math.floor((availMm - (n - 1) * gapMm) / Math.max(n, 1));
  const imgMm   = Math.max(cardMm - labelMm, 8);

  return (
    <>
      {/* 印刷用グローバルCSS */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 0; }
        body {
          font-family: 'Noto Sans JP','ヒラギノ角ゴ Pro W3','メイリオ',Meiryo,sans-serif;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print { html, body { width: 210mm; height: 297mm; } }
      `}</style>

      {/* A4 ページ */}
      <div style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm 12mm',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}>

        {/* ── ヘッダー ── */}
        <div style={{
          background: accentColor,
          borderRadius: 5,
          padding: '5mm 10mm',
          color: '#fff',
          marginBottom: '4mm',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装飾円 */}
          <div style={{
            position: 'absolute', top: '-12mm', right: '-6mm',
            width: '40mm', height: '40mm', borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{ fontSize: '7pt', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.65)', marginBottom: '1.5mm' }}>
            Seller Support Services
          </div>
          <div style={{ fontSize: '17pt', fontWeight: 700, letterSpacing: '0.04em' }}>
            {title}
          </div>
        </div>

        {/* ── 物件情報 ── */}
        <div style={{
          background: lightBg,
          borderRadius: 4,
          padding: '3mm 7mm',
          marginBottom: '4mm',
          display: 'flex',
          flexDirection: 'column',
          gap: '1mm',
        }}>
          {data.ownerName && (
            <div style={{ display: 'flex', gap: '4mm', alignItems: 'baseline' }}>
              <span style={{ fontSize: '7pt', color: accentColor, fontWeight: 600, minWidth: '18mm', whiteSpace: 'nowrap' }}>お客様氏名</span>
              <span style={{ fontSize: '9pt', color: '#222', fontWeight: 500 }}>{data.ownerName} 様</span>
            </div>
          )}
          {data.propertyAddress && (
            <div style={{ display: 'flex', gap: '4mm', alignItems: 'baseline' }}>
              <span style={{ fontSize: '7pt', color: accentColor, fontWeight: 600, minWidth: '18mm', whiteSpace: 'nowrap' }}>物件所在地</span>
              <span style={{ fontSize: '9pt', color: '#222', fontWeight: 500 }}>{data.propertyAddress}</span>
            </div>
          )}
        </div>

        {/* ── サービスカード（横1列） ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${gapMm}mm`, flex: 1 }}>
          {data.items.map((id) => (
            <div key={id} style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #dde',
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: 3,
              overflow: 'hidden',
              background: '#fff',
            }}>
              {/* 画像エリア */}
              <div style={{ width: '100%', height: `${imgMm}mm`, overflow: 'hidden', background: '#f5f7fa' }}>
                <img
                  src={`/sale-schedule/illustrations/${id}.png`}
                  alt={SERVICE_LABELS[id] || id}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  onLoad={onImgDone}
                  onError={onImgDone}
                />
              </div>
              {/* ラベル */}
              <div style={{
                fontSize: '8pt',
                fontWeight: 700,
                color: accentColor,
                padding: '1.5mm 3mm',
                background: lightBg,
                whiteSpace: 'nowrap',
              }}>
                {SERVICE_LABELS[id] || id}
              </div>
            </div>
          ))}
        </div>

        {/* ── フッター ── */}
        <div style={{
          marginTop: '3mm',
          borderTop: '1px solid #ddd',
          paddingTop: '2mm',
          textAlign: 'center',
          fontSize: '6.5pt',
          color: '#aaa',
        }}>
          ※ 内容・条件の詳細については担当スタッフまでお問い合わせください。
        </div>
      </div>
    </>
  );
}
