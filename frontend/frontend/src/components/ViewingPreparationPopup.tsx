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
import CheckIcon from '@mui/icons-material/Check';
import HouseMakerModal from './HouseMakerModal';
import NearbyMapModal from './NearbyMapModal';

export interface ViewingPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
  houseMaker?: string | null | undefined;
  googleMapUrl?: string | null | undefined;
  address?: string | null | undefined;
}

// 固定リンク定数
const FIXED_LINKS = [
  {
    label: 'スプシの資料',
    url: 'https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=195766785#gid=195766785',
    description: undefined,
  },
  {
    label: 'ATBB',
    url: 'https://atbb.athome.jp/',
    description: '①詳細ページと②地図③インフォシートを印刷',
  },
] as const;

interface CopyButtonProps {
  text: string;
  label: string;
}

/** ワンクリックコピーボタン */
const CopyButton: React.FC<CopyButtonProps> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard が使用不可の場合のフォールバック
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
        {copied ? (
          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 16, color: 'action.active' }} />
        )}
      </Box>
    </Tooltip>
  );
};

/**
 * 内覧準備ポップアップコンポーネント
 * 内覧前に必要な買主番号・物件番号のコピー機能と固定リンク2件を提供する
 */
export const ViewingPreparationPopup: React.FC<ViewingPreparationPopupProps> = ({
  open,
  onClose,
  buyerNumber,
  propertyNumber,
  houseMaker,
  googleMapUrl,
  address,
}) => {
  const hasBuyerNumber = buyerNumber != null && buyerNumber !== '';
  const hasPropertyNumber = propertyNumber != null && propertyNumber !== '';
  const [houseMakerModalOpen, setHouseMakerModalOpen] = useState(false);
  const [nearbyMapModalOpen, setNearbyMapModalOpen] = useState(false);

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>内覧準備資料</DialogTitle>
      <DialogContent>
        {/* 注意書き（赤色・太字） */}
        <Typography
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            mb: 2,
          }}
        >
          ※準備前にカレンダーに●をつけてください
        </Typography>

        {/* 買主番号・物件番号コピーエリア */}
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 買主番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasBuyerNumber ? (
              <CopyButton text={buyerNumber as string} label="買主番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                買主番号：（未設定）
              </Typography>
            )}
          </Box>

          {/* 物件番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasPropertyNumber ? (
              <CopyButton text={propertyNumber as string} label="物件番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                物件番号：（未設定）
              </Typography>
            )}
          </Box>
        </Box>

        {/* リンク一覧（番号付きリスト） */}
        <List component="ol" sx={{ listStyleType: 'decimal', pl: 2 }}>
          {FIXED_LINKS.map((link, index) => (
            <ListItem
              key={index}
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    {link.label}：
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.description ?? link.label}
                    </a>
                  </Typography>
                }
              />
            </ListItem>
          ))}
          {/* 近隣MAP（google_map_urlがある場合のみ表示） */}
          {googleMapUrl && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      近隣MAP：
                      <Box
                        component="span"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.7 },
                        }}
                        onClick={() => setNearbyMapModalOpen(true)}
                      >
                        🗺️ クリックして表示
                      </Box>
                    </Typography>
                    <Typography
                      component="div"
                      sx={{ color: 'error.main', fontSize: '0.8rem', mt: 0.3 }}
                    >
                      ※＋を２回押して拡大表示して印刷してください。カラーの両面印刷です。
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          )}
          {/* ハウスメーカー（house_makerフィールドに値がある場合のみ表示） */}
          {houseMaker && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    ハウスメーカー：{houseMaker}（
                    <Box
                      component="span"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.7 },
                      }}
                      onClick={() => setHouseMakerModalOpen(true)}
                    >
                      詳細を見る
                    </Box>
                    ）
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>

    {/* ハウスメーカーモーダル */}
    {houseMaker && (
      <HouseMakerModal
        open={houseMakerModalOpen}
        onClose={() => setHouseMakerModalOpen(false)}
        commentHtml={houseMaker}
        mode="buyer"
      />
    )}

    {/* 近隣MAPモーダル */}
    {googleMapUrl && (
      <NearbyMapModal
        open={nearbyMapModalOpen}
        onClose={() => setNearbyMapModalOpen(false)}
        googleMapUrl={googleMapUrl}
        address={address || ''}
      />
    )}
    </>
  );
};

export default ViewingPreparationPopup;
