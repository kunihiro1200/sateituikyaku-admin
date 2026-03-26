with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. RichTextCommentEditorのimportを追加
old_import = "import api from '../services/api';"
new_import = "import api from '../services/api';\nimport RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';\nimport { useRef } from 'react';"
text = text.replace(old_import, new_import, 1)

# 2. useState importにCircularProgressとFormControl/InputLabel/Select追加
old_mui = """import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Checkbox,
  FormControlLabel,
  Autocomplete,
} from '@mui/material';"""
new_mui = """import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';"""
text = text.replace(old_mui, new_mui, 1)

# 3. confidence初期値を空欄に
text = text.replace(
    "const [confidence, setConfidence] = useState('B');",
    "const [confidence, setConfidence] = useState('');",
    1
)

# 4. site初期値を'2件目以降査定'に
text = text.replace(
    "const [site, setSite] = useState('');",
    "const [site, setSite] = useState('2件目以降査定');",
    1
)

# 5. コメント用state追加（sellerCopyLoading stateの後に追加）
old_state = "  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);"
new_state = """  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);

  // コメント
  const [comments, setComments] = useState('');
  const [savingComments, setSavingComments] = useState(false);
  const commentEditorRef = useRef<RichTextCommentEditorHandle>(null);"""
text = text.replace(old_state, new_state, 1)

# 6. handleSubmitのバリデーションに確度必須チェック追加
old_validation = """    if (!propertyAddress || !propertyType) {
      setError('物件の住所、種別は必須です');
      return;
    }"""
new_validation = """    if (!propertyAddress || !propertyType) {
      setError('物件の住所、種別は必須です');
      return;
    }

    if (!confidence) {
      setError('確度は必須です');
      return;
    }"""
text = text.replace(old_validation, new_validation, 1)

# 7. handleSubmitのconfidenceフォールバックを削除
text = text.replace(
    "        confidence: confidence || 'B',",
    "        confidence: confidence || undefined,",
    1
)

# 8. commentsをhandleSubmitのdataに追加
old_data_end = """        // 競合情報
        competitorName: competitorName || undefined,"""
new_data_end = """        // コメント
        comments: comments || undefined,

        // 競合情報
        competitorName: competitorName || undefined,"""
text = text.replace(old_data_end, new_data_end, 1)

# 9. 物件情報セクションの後（査定情報セクションの前）にコメントセクションとステータスセクションを挿入
old_section = """          {/* 査定情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              査定情報
            </Typography>"""
new_section = """          {/* コメントセクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              コメント
            </Typography>
            <Box>
              <RichTextCommentEditor
                ref={commentEditorRef}
                value={comments}
                onChange={(html) => setComments(html)}
                placeholder="コメントを入力してください..."
              />
            </Box>
          </Paper>

          {/* ステータス情報セクション（コメントの直後） */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ステータス情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>状況（当社）</InputLabel>
                  <Select
                    value={status}
                    label="状況（当社）"
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <MenuItem value="追客中">追客中</MenuItem>
                    <MenuItem value="追客不要(未訪問）">追客不要(未訪問）</MenuItem>
                    <MenuItem value="除外済追客不要">除外済追客不要</MenuItem>
                    <MenuItem value="除外後追客中">除外後追客中</MenuItem>
                    <MenuItem value="専任媒介">専任媒介</MenuItem>
                    <MenuItem value="一般媒介">一般媒介</MenuItem>
                    <MenuItem value="リースバック（専任）">リースバック（専任）</MenuItem>
                    <MenuItem value="他決→追客">他決→追客</MenuItem>
                    <MenuItem value="他決→追客不要">他決→追客不要</MenuItem>
                    <MenuItem value="他決→専任">他決→専任</MenuItem>
                    <MenuItem value="他決→一般">他決→一般</MenuItem>
                    <MenuItem value="専任→他社専任">専任→他社専任</MenuItem>
                    <MenuItem value="一般→他決">一般→他決</MenuItem>
                    <MenuItem value="他社買取">他社買取</MenuItem>
                    <MenuItem value="訪問後（担当付）追客不要">訪問後（担当付）追客不要</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!confidence}>
                  <InputLabel>確度 *</InputLabel>
                  <Select
                    value={confidence}
                    label="確度 *"
                    onChange={(e) => setConfidence(e.target.value)}
                  >
                    <MenuItem value="A">A（売る気あり）</MenuItem>
                    <MenuItem value="B">B（売る気あるがまだ先の話）</MenuItem>
                    <MenuItem value="B_PRIME">B'（売る気は全く無い）</MenuItem>
                    <MenuItem value="C">C（電話が繋がらない）</MenuItem>
                    <MenuItem value="D">D（再建築不可）</MenuItem>
                    <MenuItem value="E">E（収益物件）</MenuItem>
                    <MenuItem value="DUPLICATE">ダブり（重複している）</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="担当社員"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 査定情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              査定情報
            </Typography>"""
text = text.replace(old_section, new_section, 1)

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
