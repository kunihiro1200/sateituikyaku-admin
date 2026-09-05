import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxIcon from '@mui/icons-material/AddBox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import { isIOS, isAndroid } from '../../utils/deviceDetect';
import { sellerPortalApi } from '../../services/sellerPortalApi';

/**
 * 端末に応じた「ホーム画面に保存」の案内ダイアログ。
 * - Android（Chrome等）: beforeinstallprompt イベントが発火していれば、その場でインストール操作に進める
 * - Android（対応外ブラウザ）/ iPhone: 実際の操作場所が分かる視覚的な手順を表示する
 *
 * tokenを渡すと、ダイアログが開かれたタイミングで「保存を試みた」ことを全体分析用に記録する
 * （InstallPwaBanner/InstallPwaPromptの両方の入口から共通で呼ばれるため、ここで一括記録する）。
 */
export default function InstallPwaGuideDialog({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (open && token) {
      sellerPortalApi.recordPwaInstallClick(token).catch(() => {
        // 記録の失敗は案内表示自体をブロックしない
      });
    }
  }, [open, token]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>保存する</DialogTitle>
      <DialogContent>
        {isIOS() ? (
          <IosGuide />
        ) : isAndroid() ? (
          <AndroidGuide deferredPrompt={deferredPrompt} onInstall={handleAndroidInstall} />
        ) : (
          <PcGuide deferredPrompt={deferredPrompt} onInstall={handleAndroidInstall} />
        )}
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
      <Step icon={<MoreHorizIcon color="primary" />} text="① 画面下部（または上部）の「…」をタップ" />
      <Step icon={<IosShareIcon color="primary" />} text="② 一番上の「共有」をタップ" />
      <Step icon={<AddBoxIcon color="primary" />} text="③ 共有メニューを下にスクロールして「ホーム画面に追加」をタップ" />
      <Step icon={<CheckCircleIcon color="primary" />} text="④ 右上の「追加」をタップ" />
      <Typography variant="caption" color="text.secondary">
        ホーム画面に「売却サポート」のアイコンが追加されます。
      </Typography>
    </Stack>
  );
}

function AndroidGuide({ deferredPrompt, onInstall }: { deferredPrompt: any; onInstall: () => void }) {
  // パターン1: ブラウザがインストール操作に対応している場合、その場でインストールできる
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
  // パターン2: 対応外ブラウザの場合、手順で案内する
  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        ブラウザのメニューから、ホーム画面に追加できます。
      </Typography>
      <Step icon={<MoreVertIcon color="primary" />} text="① ブラウザ右上の「⋮」をタップ" />
      <Step icon={<AddBoxIcon color="primary" />} text="②「ホーム画面に追加」または「アプリをインストール」をタップ" />
      <Step icon={<CheckCircleIcon color="primary" />} text="③ 画面の案内に従って「追加」または「インストール」をタップ" />
      <Typography variant="caption" color="text.secondary">
        ホーム画面に「売却サポート」のアイコンが追加されます。
      </Typography>
    </Stack>
  );
}

/**
 * PC（Chrome/Edge等）向けの案内。
 * beforeinstallprompt に対応しているブラウザなら、その場でインストールできる。
 * 対応外の場合は、アドレスバーのインストールアイコンから操作する手順を案内する。
 */
function PcGuide({ deferredPrompt, onInstall }: { deferredPrompt: any; onInstall: () => void }) {
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
        ブラウザのアドレスバー右側にあるインストールアイコン（
        <InstallDesktopIcon fontSize="small" sx={{ verticalAlign: 'middle' }} />
        ）をクリックするか、ブラウザのメニューから「アプリをインストール」を選択してください。
      </Typography>
      <Typography variant="caption" color="text.secondary">
        インストール後は、デスクトップやアプリ一覧からアイコンひとつで開けます。
      </Typography>
    </Stack>
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
