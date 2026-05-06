import React from 'react';
import { Box, Typography } from '@mui/material';

const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';

// ============================================================
// サブコンポーネント: テーブル行
// ============================================================

function ReformRow({
  category,
  categoryRowSpan,
  item,
  price,
  notes,
  isFirstInCategory = false,
  isLastInCategory = false,
  isLast = false,
}: {
  category?: string;
  categoryRowSpan?: number;
  item: string;
  price: string;
  notes: string[];
  isFirstInCategory?: boolean;
  isLastInCategory?: boolean;
  isLast?: boolean;
}) {
  const borderBottom = isLast ? 'none' : '1px solid #000';

  return (
    <Box sx={{ display: 'flex', borderBottom }}>
      {/* カテゴリセル（rowspan相当：最初の行のみ表示） */}
      {isFirstInCategory && (
        <Box
          sx={{
            width: '60px',
            minWidth: '60px',
            border: '1px solid #000',
            borderTop: 'none',
            borderLeft: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 0.5,
          }}
        >
          <Typography sx={{ fontSize: '9pt', fontFamily: FONT, textAlign: 'center' }}>
            {category}
          </Typography>
        </Box>
      )}
      {!isFirstInCategory && (
        <Box
          sx={{
            width: '60px',
            minWidth: '60px',
            borderRight: '1px solid #000',
          }}
        />
      )}

      {/* 項目名 */}
      <Box
        sx={{
          flex: 2.5,
          borderRight: '1px solid #000',
          px: 1,
          py: 0.4,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography sx={{ fontSize: '8.5pt', fontFamily: FONT }}>
          {item}
        </Typography>
      </Box>

      {/* 価格 */}
      <Box
        sx={{
          flex: 1.2,
          borderRight: '1px solid #000',
          px: 1,
          py: 0.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', fontFamily: FONT }}>
          {price}
        </Typography>
      </Box>

      {/* 備考 */}
      <Box
        sx={{
          flex: 2,
          px: 1,
          py: 0.4,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {notes.map((n, i) => (
          <Typography key={i} sx={{ fontSize: '8pt', fontFamily: FONT, lineHeight: 1.5 }}>
            {n}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

// ============================================================
// サブコンポーネント: テーブルヘッダー
// ============================================================

function TableHeader() {
  return (
    <Box sx={{ display: 'flex', bgcolor: '#f2f2f2', border: '1px solid #000', borderBottom: 'none' }}>
      <Box sx={{ width: '60px', minWidth: '60px', borderRight: '1px solid #000', px: 0.5, py: 0.4 }} />
      <Box sx={{ flex: 2.5, borderRight: '1px solid #000', px: 1, py: 0.4 }} />
      <Box sx={{ flex: 1.2, borderRight: '1px solid #000', px: 1, py: 0.4 }} />
      <Box sx={{ flex: 2, px: 1, py: 0.4 }} />
    </Box>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

const ReformEstimateSheet = React.forwardRef<HTMLDivElement, Record<string, never>>(
  (_, ref) => {
    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '12mm 15mm',
          bgcolor: '#fff',
          fontFamily: FONT,
          fontSize: '9pt',
          color: '#000',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          '@media print': {
            width: '210mm',
            minHeight: '297mm',
            p: '12mm 15mm',
            margin: 0,
          },
        }}
      >
        {/* ===== マンションリフォーム概算表 ===== */}
        <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', textAlign: 'center', mb: 1, fontFamily: FONT }}>
          マンションリフォーム概算表【税抜価格】
        </Typography>

        <Box sx={{ border: '1px solid #000', mb: 3 }}>
          {/* 水回り */}
          <ReformRow isFirstInCategory category="水回り" item="●キッチン交換" price="170万円" notes={[]} />
          <ReformRow item="●ユニットバス→ユニットバス交換" price="170万円" notes={[]} />
          <ReformRow item="●洗面台交換" price="20万円" notes={['クッションフロア張替（+3万）', '壁紙張替（+4万）']} />
          <ReformRow isLastInCategory item="●トイレ交換" price="25万円" notes={['クッションフロア張替（+2万）', '壁紙張替（+3万）']} />

          {/* 居室 */}
          <ReformRow isFirstInCategory category="居室" item="●和室→洋室" price="70万円（6帖）" notes={['畳→フローリング', '押入→クローゼット', '壁紙張替']} />
          <ReformRow item="●床上貼り" price="90万円（30坪）" notes={['フローリング']} />
          <ReformRow isLastInCategory item="●壁紙張替" price="70万円（30坪）" notes={['全室', '普及品']} />

          {/* 他 */}
          <ReformRow isFirstInCategory isLastInCategory isLast category="他" item="●内窓設置" price="20万円" notes={['掃出し1箇所']} />
        </Box>

        {/* ===== 戸建リフォーム概算表 ===== */}
        <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', textAlign: 'center', mb: 1, fontFamily: FONT }}>
          戸建リフォーム概算表【税抜価格】
        </Typography>

        <Box sx={{ border: '1px solid #000', flex: 1 }}>
          {/* 水回り */}
          <ReformRow isFirstInCategory category="水回り" item="●キッチン交換" price="170万円" notes={[]} />
          <ReformRow item="●ユニットバス→ユニットバス交換" price="170万円" notes={[]} />
          <ReformRow item="●ユニットバス以外→ユニットバス変更" price="200万円" notes={['例）タイル張浴室→ユニットバス']} />
          <ReformRow item="●洗面台交換" price="20万円" notes={['クッションフロア張替（+3万）', '壁紙張替（+4万）']} />
          <ReformRow isLastInCategory item="●トイレ交換" price="25万円" notes={['クッションフロア張替（+2万）', '壁紙張替（+3万）']} />

          {/* 居室 */}
          <ReformRow isFirstInCategory category="居室" item="●和室→洋室" price="80万円" notes={['畳→フローリング', '押入→クローゼット', '壁紙張替']} />
          <ReformRow item="●床上貼り" price="90万円（30坪）" notes={['フローリング']} />
          <ReformRow isLastInCategory item="●壁紙張替" price="120万円（30坪）" notes={['全室', '普及品']} />

          {/* 他 */}
          <ReformRow isFirstInCategory category="他" item="●外壁塗装" price={'140万円\n（30坪2階建）'} notes={['シリコン塗装', '耐用年数約15年', '普及品']} />
          <ReformRow item="●屋根塗装" price="40万円" notes={['シリコン塗装', '耐用年数約15年', '普及品']} />
          <ReformRow item="●屋根葺替え（ガルテクト 耐用年数20年）" price="140万円" notes={['陶器瓦（+50万 耐用年数50年以上）']} />
          <ReformRow item="●足場設置" price="23万円" notes={['※外壁、屋根工事に必要']} />
          <ReformRow item="●サッシ取替" price="30万円" notes={['掃出し1箇所', '※外壁補修費用込み']} />
          <ReformRow item="●内窓設置" price="20万円" notes={['掃出し1箇所']} />
          <ReformRow item="●庭→駐車場" price="70万円" notes={['1台分']} />
          <ReformRow isLastInCategory isLast item="●オール電化工事" price="100万円" notes={['エコキュート370L', 'IH取付']} />
        </Box>

        {/* フッター */}
        <Box sx={{ mt: 1, textAlign: 'right' }}>
          <Typography sx={{ fontSize: '8pt', color: '#666', fontFamily: FONT }}>
            last
          </Typography>
        </Box>
      </Box>
    );
  }
);

ReformEstimateSheet.displayName = 'ReformEstimateSheet';

export default ReformEstimateSheet;
