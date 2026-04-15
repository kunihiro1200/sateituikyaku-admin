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

export interface VisitPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
  sellerNumber: string | undefined;
  propertyAddress: string | undefined;
}

// ゼンリンのログイン情報
const ZENRIN_CREDENTIALS = [
  { region: '大分', id: 'AFXVeUrJRPW', pw: 'mLP7e2i4j' },
  { region: '福岡', id: 'kc4XUPASDGPW', pw: 'ifoo2022' },
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
}) => {
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
        <Box component="span" sx={{ display: 'inline-block' }}>
          <a href={FIXED_LINKS_BEFORE[1].url} target="_blank" rel="noopener noreferrer">
            ぜんりん
          </a>
          <ZenrinCredentials />
        </Box>
      ),
    },
    // 3. 謄本
    {
      label: '謄本',
      content: (
        <a href={FIXED_LINKS_BEFORE[2].url} target="_blank" rel="noopener noreferrer">
          謄本
        </a>
      ),
    },
    // 4. 査定書（動的）
    {
      label: '査定書',
      content: inquiryUrl ? (
        <a href={inquiryUrl} target="_blank" rel="noopener noreferrer">
          査定書
        </a>
      ) : (
        <span>（リンクなし）</span>
      ),
    },
    // 5. 成約事例
    {
      label: '成約事例',
      content: (
        <a href={FIXED_LINKS_AFTER_ASSESSMENT[0].url} target="_blank" rel="noopener noreferrer">
          成約事例
        </a>
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
  ];

  return (
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
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    {item.label}：{item.content}
                  </Typography>
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
  );
};

export default VisitPreparationPopup;
