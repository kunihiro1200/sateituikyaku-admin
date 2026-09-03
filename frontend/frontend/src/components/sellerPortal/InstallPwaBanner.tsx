import { useState } from 'react';
import { Paper, Typography, Box, Button } from '@mui/material';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import InstallPwaGuideDialog from './InstallPwaGuideDialog';
import { isStandalone } from '../../utils/deviceDetect';

/**
 * ページ内に常時残す「スマホに保存」の小さな導線。
 * 初回案内を断った場合でも、後からいつでも保存方法を確認できるようにする。
 */
export default function InstallPwaBanner() {
  const [guideOpen, setGuideOpen] = useState(false);

  if (isStandalone()) return null;

  return (
    <>
      <Paper
        sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
        variant="outlined"
        onClick={() => setGuideOpen(true)}
      >
        <PhoneIphoneIcon color="primary" />
        <Box>
          <Typography variant="body2" fontWeight="bold">
            この査定ページをスマホに保存
          </Typography>
          <Typography variant="caption" color="text.secondary">
            次回からアプリのように1タップで開けます
          </Typography>
        </Box>
      </Paper>

      <InstallPwaGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
