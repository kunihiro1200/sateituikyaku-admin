import { useState } from 'react';
import { Snackbar, Paper, Typography, Box, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import InstallPwaGuideDialog from './InstallPwaGuideDialog';

/**
 * 初回アクセス時の「このページをスマホに保存しておきませんか？」案内。
 * 全画面表示にせず、査定内容を見てもらうことを優先した控えめな表示にする。
 */
export default function InstallPwaPrompt({ onDismiss }: { onDismiss: () => void }) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 90, sm: 24 } }}>
        <Paper sx={{ p: 2, borderRadius: 3, maxWidth: 360, boxShadow: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <PhoneIphoneIcon color="primary" />
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  このページを保存しておきませんか？
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  査定額・手残り金額・売却スケジュール・スタッフとの相談を、いつでもすぐ確認できます。
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button size="small" onClick={onDismiss}>
              今はしない
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setGuideOpen(true)}
            >
              保存する
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            次回からアプリのように1タップで開けます
          </Typography>
        </Paper>
      </Snackbar>

      <InstallPwaGuideDialog
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          onDismiss();
        }}
      />
    </>
  );
}
