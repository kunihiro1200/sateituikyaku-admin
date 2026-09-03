import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack } from '@mui/material';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxIcon from '@mui/icons-material/AddBox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { isIOS, isAndroid } from '../../utils/deviceDetect';

/**
 * 端末に応じた「ホーム画面に保存」の案内ダイアログ。
 * - Android（Chrome等）: beforeinstallprompt イベントが発火していれば、その場でインストール操作に進める
 * - Android（対応外ブラウザ）/ iPhone: 実際の操作場所が分かる視覚的な手順を表示する
 */
export default function InstallPwaGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>スマホに保存する</DialogTitle>
      <DialogContent>
        {isIOS() ? <IosGuide /> : isAndroid() ? <AndroidGuide deferredPrompt={deferredPrompt} onInstall={handleAndroidInstall} /> : <GenericGuide />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}

function IosGuide() {
  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        Safariの「共有」ボタンから、ホーム画面に追加できます。
      </Typography>
      <Step icon={<IosShareIcon color="primary" />} text="① 画面下（または上）の「共有」ボタンをタップ" />
      <Step icon={<AddBoxIcon color="primary" />} text="② メニューから「ホーム画面に追加」を選択" />
      <Step icon={<CheckCircleIcon color="primary" />} text="③ 右上の「追加」をタップ" />
      <Typography variant="caption" color="text.secondary">
        ホーム画面に「売却サポート」のアイコンが追加されます。
      </Typography>
    </Stack>
  );
}

function AndroidGuide({ deferredPrompt, onInstall }: { deferredPrompt: any; onInstall: () => void }) {
  if (deferredPrompt) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2">
          下のボタンからそのままインストールできます。
        </Typography>
        <Button variant="contained" onClick={onInstall}>
          インストールする
        </Button>
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        ブラウザのメニュー（右上の縦三点アイコン）から「ホーム画面に追加」または「アプリをインストール」を選択してください。
      </Typography>
    </Stack>
  );
}

function GenericGuide() {
  return (
    <Typography variant="body2">
      ブラウザのメニューから「ホーム画面に追加」を選択すると、次回からアイコンから直接開けます。
    </Typography>
  );
}

function Step({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon}
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
