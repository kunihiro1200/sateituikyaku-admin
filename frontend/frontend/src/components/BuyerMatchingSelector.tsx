import React, { useState } from 'react';
import { Box, Button, ButtonGroup, CircularProgress, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';

interface BuyerMatchingSelectorProps {
  buyerNumber: string;
  matchingRequired: boolean | null; // null=未設定, true=マッチング実行, false=マッチング不要
  isDesiredTimingMissing?: boolean;
  hasUnsavedChanges?: boolean;
  onBeforeSearch?: () => Promise<void>;
  onMatchingStatusChange: (required: boolean) => Promise<void>;
}

/**
 * 買主希望条件の「売主をマッチング」「マッチング不要」ボタンセレクター
 * 希望条件を入力または編集した時点でどちらかのボタンを押すことを必須にする
 */
export default function BuyerMatchingSelector({
  buyerNumber,
  matchingRequired,
  isDesiredTimingMissing,
  hasUnsavedChanges,
  onBeforeSearch,
  onMatchingStatusChange,
}: BuyerMatchingSelectorProps) {
  const [searching, setSearching] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 「売主をマッチング」ボタン押下
  const handleSearchClick = async () => {
    setSearching(true);
    try {
      // 保存処理を実行（未保存の変更がある場合）
      if (onBeforeSearch) {
        await onBeforeSearch();
      }
      // マッチング実行フラグを設定
      await onMatchingStatusChange(true);
      // 売主マッチング画面に遷移
      window.open(`/seller-matching?buyerNumber=${buyerNumber}`, '_blank');
    } catch (error) {
      console.error('[Buyer Matching] Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  // 「マッチング不要」ボタン押下
  const handleNotRequiredClick = async () => {
    setUpdating(true);
    try {
      // マッチング不要フラグを設定
      await onMatchingStatusChange(false);
    } catch (error) {
      console.error('[Buyer Matching] Not required error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // 希望時期が未入力の場合は警告を表示
  if (isDesiredTimingMissing) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ButtonGroup variant="outlined" disabled>
          <Button startIcon={<SearchIcon />}>売主をマッチング</Button>
          <Button startIcon={<BlockIcon />}>マッチング不要</Button>
        </ButtonGroup>
        <Typography variant="caption" color="error">
          ※ 希望時期を入力してください
        </Typography>
      </Box>
    );
  }

  // 未保存の変更がある場合は警告を表示
  if (hasUnsavedChanges) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ButtonGroup variant="outlined">
          <Button 
            startIcon={searching ? <CircularProgress size={16} /> : <SearchIcon />}
            onClick={handleSearchClick}
            disabled={searching || updating}
            color={matchingRequired === true ? 'primary' : 'inherit'}
            variant={matchingRequired === true ? 'contained' : 'outlined'}
          >
            売主をマッチング
          </Button>
          <Button 
            startIcon={updating ? <CircularProgress size={16} /> : <BlockIcon />}
            onClick={handleNotRequiredClick}
            disabled={searching || updating}
            color={matchingRequired === false ? 'error' : 'inherit'}
            variant={matchingRequired === false ? 'contained' : 'outlined'}
          >
            マッチング不要
          </Button>
        </ButtonGroup>
        <Typography variant="caption" color="warning.main">
          ※ 先に保存ボタンを押してください
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <ButtonGroup variant="outlined">
        <Button 
          startIcon={searching ? <CircularProgress size={16} /> : <SearchIcon />}
          onClick={handleSearchClick}
          disabled={searching || updating}
          color={matchingRequired === true ? 'primary' : 'inherit'}
          variant={matchingRequired === true ? 'contained' : 'outlined'}
        >
          売主をマッチング
        </Button>
        <Button 
          startIcon={updating ? <CircularProgress size={16} /> : <BlockIcon />}
          onClick={handleNotRequiredClick}
          disabled={searching || updating}
          color={matchingRequired === false ? 'error' : 'inherit'}
          variant={matchingRequired === false ? 'contained' : 'outlined'}
        >
          マッチング不要
        </Button>
      </ButtonGroup>
      {matchingRequired === null && (
        <Typography variant="caption" color="error">
          ※ 希望条件を入力または編集した場合は、どちらかのボタンを押してください
        </Typography>
      )}
      {matchingRequired === true && (
        <Typography variant="caption" color="success.main">
          ✓ マッチング実行済み
        </Typography>
      )}
      {matchingRequired === false && (
        <Typography variant="caption" color="text.secondary">
          マッチング不要に設定されています
        </Typography>
      )}
    </Box>
  );
}
