import re

# 1. バックエンド: DELETE /:id エンドポイントを追加
with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# mark-unreachableの前に削除エンドポイントを追加
old = "/**\r\n * Phase 1: Mark seller as unreachable\r\n */"
new = """/**
 * 売主を削除（ソフトデリート）
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { error } = await supabase
      .from('sellers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      return res.status(500).json({ error: 'Failed to delete seller' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({ error: 'Failed to delete seller' });
  }
});

/**
 * Phase 1: Mark seller as unreachable
 */"""

old_crlf = old.replace('\n', '\r\n')
if old_crlf in text:
    text = text.replace(old_crlf, new.replace('\n', '\r\n'), 1)
    print('OK backend (CRLF)')
elif old in text:
    text = text.replace(old, new, 1)
    print('OK backend (LF)')
else:
    print('ERROR backend: not found')

with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

# 2. フロントエンド: 削除ボタンとダイアログを追加
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# DeleteアイコンをMUIアイコンに追加
old_icon = "import { ArrowBack, Phone, Save, CalendarToday, Email, Image as ImageIcon, ContentCopy as ContentCopyIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';"
new_icon = "import { ArrowBack, Phone, Save, CalendarToday, Email, Image as ImageIcon, ContentCopy as ContentCopyIcon, Search as SearchIcon, Clear as ClearIcon, Delete as DeleteIcon } from '@mui/icons-material';"
if old_icon in text:
    text = text.replace(old_icon, new_icon, 1)
    print('OK icon')
else:
    print('ERROR icon: not found')

# 削除確認ダイアログ用stateを追加（savingAppointment stateの後）
old_state = "  const [savingAppointment, setSavingAppointment] = useState(false);\n"
new_state = "  const [savingAppointment, setSavingAppointment] = useState(false);\n  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);\n  const [deleting, setDeleting] = useState(false);\n"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('OK state')
else:
    old_state_crlf = old_state.replace('\n', '\r\n')
    new_state_crlf = new_state.replace('\n', '\r\n')
    if old_state_crlf in text:
        text = text.replace(old_state_crlf, new_state_crlf, 1)
        print('OK state (CRLF)')
    else:
        print('ERROR state: not found')

# 削除ハンドラを追加（handleSaveCommentsの前）
old_handler = "  // コメント直接編集の保存処理\n  const handleSaveComments"
new_handler = """  // 売主削除ハンドラ
  const handleDeleteSeller = async () => {
    if (!seller?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/sellers/${seller.id}`);
      setDeleteDialogOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Delete seller error:', err);
    } finally {
      setDeleting(false);
    }
  };

  // コメント直接編集の保存処理
  const handleSaveComments"""

if old_handler in text:
    text = text.replace(old_handler, new_handler, 1)
    print('OK handler')
else:
    old_handler_crlf = old_handler.replace('\n', '\r\n')
    new_handler_crlf = new_handler.replace('\n', '\r\n')
    if old_handler_crlf in text:
        text = text.replace(old_handler_crlf, new_handler_crlf, 1)
        print('OK handler (CRLF)')
    else:
        print('ERROR handler: not found')

# 近隣買主ボタンの後に削除ボタンを追加
old_btn = """          )}
        </Box>

        {/* 査定額表示（中央） */}"""
new_btn = """          )}
          {/* 削除ボタン */}
          {seller?.id && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ ml: 'auto' }}
              size="small"
            >
              削除
            </Button>
          )}
        </Box>

        {/* 削除確認ダイアログ */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>売主を削除しますか？</DialogTitle>
          <DialogContent>
            <Typography>
              {seller?.name}（{seller?.sellerNumber}）をDBから削除します。<br />
              削除後も復元可能ですが、一覧から非表示になります。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>キャンセル</Button>
            <Button onClick={handleDeleteSeller} color="error" variant="contained" disabled={deleting}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 査定額表示（中央） */}"""

if old_btn in text:
    text = text.replace(old_btn, new_btn, 1)
    print('OK button')
else:
    old_btn_crlf = old_btn.replace('\n', '\r\n')
    new_btn_crlf = new_btn.replace('\n', '\r\n')
    if old_btn_crlf in text:
        text = text.replace(old_btn_crlf, new_btn_crlf, 1)
        print('OK button (CRLF)')
    else:
        print('ERROR button: not found')

# DialogTitle, DialogContent, DialogActions, DialogのMUIインポートを確認・追加
if 'DialogTitle' not in text:
    old_mui = "import {\n  Container,"
    new_mui = "import {\n  Container,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,"
    if old_mui in text:
        text = text.replace(old_mui, new_mui, 1)
        print('OK Dialog import')
    else:
        print('NOTE: Dialog import may already exist or needs manual check')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
