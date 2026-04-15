import React from 'react';
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
} from '@mui/material';

export interface VisitPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  sellerId: string | undefined;
  inquiryUrl: string | null | undefined;
}

// 固定リンク定数（添付資料・ぜんりん・謄本・成約事例）
const FIXED_LINKS = [
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

/**
 * 訪問準備ポップアップコンポーネント
 * 訪問前に必要な6種類のリソースへのリンクを一覧表示する
 */
export const VisitPreparationPopup: React.FC<VisitPreparationPopupProps> = ({
  open,
  onClose,
  sellerId,
  inquiryUrl,
}) => {
  // 表示順序：添付資料 → ぜんりん → 謄本 → 査定書 → 成約事例 → 近隣買主
  const items: Array<{ label: string; content: React.ReactNode }> = [
    // 1. 添付資料
    ...FIXED_LINKS.map((link) => ({
      label: link.label,
      content: (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ),
    })),
    // 4. 査定書（動的）
    {
      label: '査定書',
      content: inquiryUrl ? (
        <a
          href={inquiryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          査定書
        </a>
      ) : (
        <span>（リンクなし）</span>
      ),
    },
    // 5. 成約事例
    ...FIXED_LINKS_AFTER_ASSESSMENT.map((link) => ({
      label: link.label,
      content: (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ),
    })),
    // 6. 近隣買主（動的）
    {
      label: '近隣買主',
      content: sellerId ? (
        <a
          href={`/sellers/${sellerId}/nearby-buyers`}
          target="_blank"
          rel="noopener noreferrer"
        >
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
