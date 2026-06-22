import React from 'react';
import { Box, Typography } from '@mui/material';

// ============================================================
// 型定義
// ============================================================

interface ExclusiveMediationContractSheetProps {
  propertyAddress?: string;
  viewingDate?: string;
  propertyNumber?: string;
}

// ============================================================
// メインコンポーネント
// ============================================================

const ExclusiveMediationContractSheet = React.forwardRef<HTMLDivElement, ExclusiveMediationContractSheetProps>(
  ({ propertyAddress, viewingDate, propertyNumber }, ref) => {
    const isFI = (propertyNumber || '').toUpperCase().includes('FI');

    // 内覧日の表示文字列を生成
    let viewingDateDisplay = '';
    if (viewingDate) {
      try {
        const d = new Date(viewingDate.replace(/\//g, '-'));
        if (!isNaN(d.getTime())) {
          viewingDateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        } else {
          viewingDateDisplay = viewingDate;
        }
      } catch {
        viewingDateDisplay = viewingDate;
      }
    }

    return (
      <Box
        ref={ref}
        sx={{
          width: '210mm',
          minHeight: '297mm',
          p: '12mm 18mm',
          bgcolor: '#fff',
          fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
          fontSize: '9pt',
          color: '#000',
          boxSizing: 'border-box',
          '@media print': {
            width: '210mm',
            minHeight: '297mm',
            p: '12mm 18mm',
            margin: 0,
          },
        }}
      >
        {/* 上部注記 */}
        <Typography sx={{ fontSize: '8pt', textAlign: 'center', mb: 0.5 }}>
          この媒介契約は、国土交通省が定めた標準媒介契約約款に基づく契約です。
        </Typography>

        {/* タイトル */}
        <Typography
          sx={{
            fontSize: '16pt',
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.3em',
            mb: 0.5,
          }}
        >
          内 覧 証 明 書
        </Typography>

        {/* 依頼の内容 */}
        <Typography sx={{ fontSize: '9pt', textAlign: 'center', mb: 1.5 }}>
          依頼の内容：購入
        </Typography>

        {/* 契約型式説明ボックス */}
        <Box sx={{ border: '1px solid #000', p: 1.5, mb: 2, fontSize: '8.5pt', lineHeight: 1.7 }}>
          <Typography sx={{ fontSize: '8.5pt', mb: 0.5 }}>
            この契約は、次の３つの契約型式のうち、専任媒介契約型式です。
          </Typography>

          <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', mt: 1 }}>
            ・専属専任媒介契約型式
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地 建物取引業者に重ねて依頼することができません。
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができません。
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。
          </Typography>

          <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', mt: 1 }}>
            ・専任媒介契約型式
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができません。
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            当社は、目的物件を国土交通大臣が指定した指定流通機構に登録します。
          </Typography>

          <Typography sx={{ fontSize: '8.5pt', fontWeight: 'bold', mt: 1 }}>
            ・一般媒介契約型式
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、目的物件の売買又は交換の媒介又は代理を、当社以外の宅地建物取引業者に重ねて依頼することができます。
          </Typography>
          <Typography sx={{ fontSize: '8pt', lineHeight: 1.6 }}>
            依頼者は、自ら発見した相手方と売買又は交換の契約を締結することができます。
          </Typography>
        </Box>

        {/* 目的物件 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
          <Typography sx={{ fontSize: '10pt', minWidth: '80px' }}>
            目的物件：
          </Typography>
          <Box sx={{ flex: 1, borderBottom: '2px solid #000', pb: 0.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '13pt', fontWeight: 'bold' }}>
              {propertyAddress || ''}
            </Typography>
          </Box>
        </Box>

        {/* 内覧文言 */}
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <Box sx={{ borderBottom: '1px solid #000', display: 'inline-block', pb: 0.5 }}>
            <Typography sx={{ fontSize: '12pt', fontWeight: 'bold' }}>
              {isFI ? 'を株式会社くじら不動産で内覧しました。' : 'を株式会社いふうで内覧しました。'}
            </Typography>
          </Box>
        </Box>

        {/* 内覧日 */}
        {viewingDateDisplay ? (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: '10pt' }}>
              内覧日：{viewingDateDisplay}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mb: 2 }} />
        )}

        {/* 甲・依頼者 */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', mb: 1.5 }}>
            【甲・依頼者】
          </Typography>

          {/* 住所 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '60px', mr: 2 }}>
              住　所
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', minHeight: '24px' }} />
          </Box>

          {/* 氏名 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '60px', mr: 2 }}>
              氏　名
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', minHeight: '24px' }} />
          </Box>
        </Box>

        {/* 乙・宅地建物取引業者 */}
        <Box>
          <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', mb: 1.5 }}>
            【乙・宅地建物取引業者】
          </Typography>

          {/* 商号 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1.5 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '120px', mr: 2 }}>
              商号（名称）
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5 }}>
              <Typography sx={{ fontSize: '10pt' }}>
                {isFI ? '株式会社くじら不動産' : '株式会社　威風'}
              </Typography>
            </Box>
          </Box>

          {/* 代表者 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1.5 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '120px', mr: 2 }}>
              代表者
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5 }}>
              <Typography sx={{ fontSize: '10pt' }}>國廣智子</Typography>
            </Box>
          </Box>

          {/* 主たる事務所の所在地 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1.5 }}>
            <Typography sx={{ fontSize: '10pt', minWidth: '120px', mr: 2 }}>
              主たる事務所の所在地
            </Typography>
            <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5 }}>
              <Typography sx={{ fontSize: '10pt' }}>
                {isFI ? '福岡市中央区舞鶴3－1－10' : '大分市舞鶴町1-3-30'}
              </Typography>
            </Box>
          </Box>

          {/* 免許証番号（FI物件は表示しない） */}
          {!isFI && (
            <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1.5 }}>
              <Typography sx={{ fontSize: '10pt', minWidth: '120px', mr: 2 }}>
                免許証番号
              </Typography>
              <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5 }}>
                <Typography sx={{ fontSize: '10pt' }}>大分県知事（３）第3183号</Typography>
              </Box>
            </Box>
          )}

          {/* TEL（FI物件のみ表示） */}
          {isFI && (
            <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1.5 }}>
              <Typography sx={{ fontSize: '10pt', minWidth: '120px', mr: 2 }}>
                電話番号
              </Typography>
              <Box sx={{ flex: 1, borderBottom: '1px solid #000', pb: 0.5 }}>
                <Typography sx={{ fontSize: '10pt' }}>TEL:092-401-5331</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  }
);

ExclusiveMediationContractSheet.displayName = 'ExclusiveMediationContractSheet';

export default ExclusiveMediationContractSheet;
