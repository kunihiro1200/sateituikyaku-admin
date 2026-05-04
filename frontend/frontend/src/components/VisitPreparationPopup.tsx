import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HouseMakerModal from './HouseMakerModal';
import MansionModal from './MansionModal';

export interface VisitPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
  sellerNumber: string | undefined;
  propertyAddress: string | undefined;
  commentHtml?: string;
}

// ゼンリンのログイン情報
const ZENRIN_CREDENTIALS = [
  { region: '大分', id: 'AFXVeUrJR', pw: 'mLP7e2i4j' },
  { region: '福岡', id: 'kc4XUPASDG', pw: 'ifoo2022' },
] as const;

// 固定リンク定数（添付資料・謄本）
const FIXED_LINKS_BEFORE = [
  {
    label: '添付資料',
    url: 'https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I/edit?gid=422937915#gid=422937915',
  },
  {
    label: 'ぜんりん',
    url: 'https://app.zip-site.com/reos/app/index.htm',
  },
  {
    label: '謄本',
    url: 'https://www.jtn-map.com/member/kiyaku.asp',
  },
] as const;

const FIXED_LINKS_AFTER_ASSESSMENT = [
  {
    label: '成約事例',
    url: 'https://atbb.athome.jp/',
  },
] as const;

interface CopyChipProps {
  text: string;
  label: string;
}

/** ワンクリックコピーチップ */
const CopyChip: React.FC<CopyChipProps> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip title={copied ? 'コピーしました！' : 'コピー'} placement="top">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.3,
          cursor: 'pointer',
          px: 0.8,
          py: 0.2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: copied ? 'success.main' : 'divider',
          bgcolor: copied ? 'success.50' : 'grey.50',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={handleCopy}
      >
        <Typography
          component="span"
          sx={{
            fontSize: '0.78rem',
            color: copied ? 'success.main' : 'text.secondary',
          }}
        >
          {label}：<strong style={{ color: copied ? 'inherit' : '#333' }}>{text}</strong>
        </Typography>
        <ContentCopyIcon sx={{ fontSize: 13, color: copied ? 'success.main' : 'action.active' }} />
      </Box>
    </Tooltip>
  );
};

interface CopyButtonProps {
  text: string;
  label: string;
}

/** ワンクリックコピーボタン（売主番号・住所用） */
const CopyButton: React.FC<CopyButtonProps> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip title={copied ? 'コピーしました！' : 'コピー'} placement="top">
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        onClick={handleCopy}
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            color: copied ? 'success.main' : 'text.primary',
          }}
        >
          {label}：{text}
        </Typography>
        <ContentCopyIcon
          sx={{
            fontSize: 16,
            color: copied ? 'success.main' : 'action.active',
          }}
        />
      </Box>
    </Tooltip>
  );
};

/** ゼンリンのログイン情報表示 */
const ZenrinCredentials: React.FC = () => (
  <Box sx={{ mt: 0.5, ml: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {ZENRIN_CREDENTIALS.map((cred) => (
      <Box key={cred.region} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', minWidth: 28 }}>
          {cred.region}
        </Typography>
        <CopyChip label="ID" text={cred.id} />
        <CopyChip label="PW" text={cred.pw} />
      </Box>
    ))}
  </Box>
);

// ハウスメーカー名リスト（コメントに含まれるか判定用）
const HOUSE_MAKERS = [
  '一条工務店', '積水ハウス', 'ダイワハウス', '大和ハウス',
  'パナソニックホームズ', 'ユニバーサルホーム', 'ミサワホーム',
  '谷川建設', '住友林業', 'ヘーベルハウス', 'セキスイハイム',
  'トヨタホーム', '三井ホーム', '旭化成ホームズ', 'タマホーム',
  'アイフルホーム', 'クレバリーホーム', 'アキュラホーム',
  'GIJ株式会社', 'GIJ', '三越商事',
  'ハウスメーカー',
];

/**
 * 訪問準備ポップアップコンポーネント
 * 訪問前に必要な6種類のリソースへのリンクを一覧表示する
 */
export const VisitPreparationPopup: React.FC<VisitPreparationPopupProps> = ({
  open,
  onClose,
  sellerId,
  inquiryUrl,
  sellerNumber,
  propertyAddress,
  commentHtml = '',
}) => {
  const [houseMakerModalOpen, setHouseMakerModalOpen] = useState(false);
  const [mansionModalOpen, setMansionModalOpen] = useState(false);

  // ハウスメーカー名がコメントに含まれるか判定
  const plainComment = commentHtml.replace(/<[^>]+>/g, '');
  const hasHouseMaker = HOUSE_MAKERS.some((m) => plainComment.includes(m));

  // マンションブランド名が物件住所に含まれるか判定
  const MANSION_BRANDS = [
    'アルファステイツ', 'サーパス', 'サンレスコ', 'グリーンヒル',
    'エイリック', 'スタイルパークサイド', 'デュオヒルズ', 'MJR',
    'サンパーク', 'クレアネクスト', 'オーヴィジョン',
    'リビオ', 'ロフティ', 'パレスト',
    'レジオン', 'アルバガーデン', 'パレス',
    'グランフォーレ', 'グランドパレス',
    'ザ・パークハウス', 'ザ・ライオンズ', 'グランドメゾン', 'プレミスト',
    'ザ・サンメゾン', 'ロイヤルアーク', 'レーベン', 'ルッシュ', 'アンピール',
    'ネクサス', 'アーバンパレス', 'ブライトパーク', 'サンリヤン', 'アルテ',
    'マインド', 'ライオンズマンション', 'アクタス', 'パークコート', 'サントーア',
    'コアマンション', 'グランドステイツ', 'サングレート', 'パークホームズ', 'アクロス',
    'エステートマンション', 'ティアラ', 'アーサー', '東急ドエル', 'アルス',
    'デュオヴェール', 'ダイアパレス', 'グランデージ', 'ソピア', 'インプレスト',
    'オープンレジデンシア', 'クリオ', 'サンレジア', 'アートウィル', 'グランコート',
    'エンゼルハイム', 'アドニス', 'ライオンズプラザ', 'コモダス', 'パッソ',
    '藤和シティコープ', 'プレッソ', 'ニューライフ', 'シャンボール', '藤和コープ',
    'ソシエ', '赤坂エクセル', 'ヴィルテージ', '日商岩井', 'ダイナコート',
    '朝日プラザ', 'エスポワール', '東洋マンション', '三井', 'ライオンズ',
  ];
  const addressForMansion = propertyAddress || '';
  const detectedMansionBrand = MANSION_BRANDS.find((m) => addressForMansion.includes(m));
  const hasMansion = !!detectedMansionBrand;
  // 表示順序：添付資料 → ぜんりん（+ログイン情報） → 謄本 → 査定書 → 成約事例 → 近隣買主
  const items: Array<{ label: string; content: React.ReactNode }> = [
    // 1. 添付資料
    {
      label: '添付資料',
      content: (
        <a href={FIXED_LINKS_BEFORE[0].url} target="_blank" rel="noopener noreferrer">
          添付資料
        </a>
      ),
    },
    // 2. ぜんりん（ログイン情報付き）
    {
      label: 'ぜんりん',
      content: (
        <Box component="span" sx={{ display: 'inline-block', verticalAlign: 'top' }}>
          <a href={FIXED_LINKS_BEFORE[1].url} target="_blank" rel="noopener noreferrer">
            ぜんりん
          </a>
          <ZenrinCredentials />
          <Typography sx={{ color: 'error.main', fontSize: '0.85rem', mt: 0.5 }}>
            ヘッダーの「画像」ボタンより、PDF保存してください。
          </Typography>
          <Typography sx={{ color: 'error.main', fontSize: '0.85rem' }}>
            使用後はすぐにログアウトしてください。
          </Typography>
        </Box>
      ),
    },
    // 3. 謄本
    {
      label: '謄本',
      content: (
        <Box component="span" sx={{ display: 'inline-block', verticalAlign: 'top' }}>
          <a href={FIXED_LINKS_BEFORE[2].url} target="_blank" rel="noopener noreferrer">
            謄本
          </a>
          <Typography sx={{ color: 'error.main', fontSize: '0.85rem', mt: 0.5 }}>
            ヘッダーの「画像」ボタンより、PDF保存してください。
          </Typography>
        </Box>
      ),
    },
    // 4. 査定書（動的）
    {
      label: '査定書',
      content: (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {inquiryUrl ? (
            <a href={inquiryUrl} target="_blank" rel="noopener noreferrer">
              査定書
            </a>
          ) : (
            <span>（リンクなし）</span>
          )}
          <a href="https://docs.google.com/document/d/1qXQ9dYuIXS5HgqWDt-0S7fAsFzVTxxv3xtn3zFCFXEo/edit?tab=t.2wdqx1i81hul" target="_blank" rel="noopener noreferrer">
            事務の準備方法
          </a>
        </Box>
      ),
    },
    // 5. 成約事例
    {
      label: '成約事例',
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <a href={FIXED_LINKS_AFTER_ASSESSMENT[0].url} target="_blank" rel="noopener noreferrer">
              成約事例
            </a>
            <a href="https://docs.google.com/document/d/1qXQ9dYuIXS5HgqWDt-0S7fAsFzVTxxv3xtn3zFCFXEo/edit?tab=t.x250eg61pmmp" target="_blank" rel="noopener noreferrer">
              マンションの場合は事務が成約事例をだす
            </a>
          </Box>
          <Box component="span" sx={{ color: 'red', fontSize: '0.85em' }}>
            （マンションの成約事例は、画像ボタンよりPDF保存してください）
          </Box>
        </Box>
      ),
    },
    // 6. 近隣買主（動的）
    {
      label: '近隣買主',
      content: sellerId ? (
        <a href={`/sellers/${sellerId}/nearby-buyers`} target="_blank" rel="noopener noreferrer">
          近隣買主
        </a>
      ) : (
        <span>（リンクなし）</span>
      ),
    },
    // 7. エリア情勢（クリックで別タブに遷移）
    {
      label: 'エリア情勢',
      content: sellerId ? (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <a
            href={`/sellers/${sellerId}/area-report`}
            target="_blank"
            rel="noopener noreferrer"
          >
            エリア情勢
          </a>
          <Typography component="span" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
            両面カラー印刷
          </Typography>
        </Box>
      ) : (
        <span>（リンクなし）</span>
      ),
    },
    // 8. 売買実績
    {
      label: '売買実績',
      content: sellerId ? (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <a
            href={`/sellers/${sellerId}/sales-history`}
            target="_blank"
            rel="noopener noreferrer"
          >
            売買実績
          </a>
          <Typography component="span" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
            両面カラー印刷
          </Typography>
        </Box>
      ) : (
        <span>（リンクなし）</span>
      ),
    },
    // 9. ハウスメーカー（コメントにハウスメーカー名がある場合のみ）
    ...(hasHouseMaker ? [{
      label: 'ハウスメーカー',
      content: (
        <Box
          component="span"
          sx={{
            color: '#1a237e',
            textDecoration: 'underline',
            cursor: 'pointer',
            '&:hover': { opacity: 0.7 },
          }}
          onClick={() => setHouseMakerModalOpen(true)}
        >
          ハウスメーカー
        </Box>
      ),
    }] : []),
    // 9. マンション（物件住所にマンション名がある場合のみ）
    ...(hasMansion ? [{
      label: `マンション：${detectedMansionBrand}`,
      content: (
        <Box
          component="span"
          sx={{
            color: '#1b5e20',
            textDecoration: 'underline',
            cursor: 'pointer',
            '&:hover': { opacity: 0.7 },
          }}
          onClick={() => setMansionModalOpen(true)}
        >
          マンション
        </Box>
      ),
    }] : []),
  ];

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>訪問準備</DialogTitle>
      <DialogContent>
        {/* 売主番号・物件住所コピーエリア */}
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sellerNumber && (
            <CopyButton text={sellerNumber} label="売主番号" />
          )}
          {propertyAddress && (
            <CopyButton text={propertyAddress} label="物件住所" />
          )}
        </Box>

        {/* 注意メッセージ */}
        <Typography
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            mb: 2,
          }}
        >
          ＊準備前に必ずカレンダーに●つけてください！！
        </Typography>

        {/* リンク一覧（番号付きリスト） */}
        <List component="ol" sx={{ listStyleType: 'decimal', pl: 2 }}>
          {items.map((item, index) => (
            <ListItem
              key={index}
              component="li"
              sx={{ display: 'list-item', py: 0.5, alignItems: 'flex-start' }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <Typography component="span" sx={{ whiteSpace: 'nowrap' }}>
                      {item.label}：
                    </Typography>
                    <Box component="span">{item.content}</Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>

    {/* ハウスメーカーモーダル */}
    <HouseMakerModal
      open={houseMakerModalOpen}
      onClose={() => setHouseMakerModalOpen(false)}
      commentHtml={commentHtml}
    />

    {/* マンションモーダル */}
    <MansionModal
      open={mansionModalOpen}
      onClose={() => setMansionModalOpen(false)}
      address={addressForMansion}
    />
  </>
  );
};

export default VisitPreparationPopup;
