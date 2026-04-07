# -*- coding: utf-8 -*-
import re

# ファイルを読み込む
with open('frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 1. インポートを修正
content = content.replace(
    "import { Email as EmailIcon } from '@mui/icons-material';",
    "import {\n  Email as EmailIcon,\n  Image as ImageIcon,\n} from '@mui/icons-material';"
)

# 2. ImageSelectorModalをインポート
content = content.replace(
    "import { SECTION_COLORS } from '../theme/sectionColors';",
    "import { SECTION_COLORS } from '../theme/sectionColors';\nimport ImageSelectorModal from '../components/ImageSelectorModal';"
)

# 3. ImageFile型を追加
content = content.replace(
    "interface Buyer {",
    """// 画像ファイル型（ImageSelectorModalと同じ）
interface ImageFile {
  id: string;
  name: string;
  source: 'drive' | 'local' | 'url';
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  previewUrl: string;
  driveFileId?: string;
  localFile?: File;
  url?: string;
}

interface Buyer {"""
)

# 4. 状態を更新
old_state = """  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentTab, setAttachmentTab] = useState(1);"""

new_state = """  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);"""

content = content.replace(old_state, new_state)

# 5. ハンドラーを追加
old_handlers = """  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };"""

new_handlers = """  const handleOpenImageSelector = () => {
    setImageSelectorOpen(true);
  };

  const handleImageSelectionConfirm = (images: ImageFile[]) => {
    setSelectedImages(images);
    setImageSelectorOpen(false);
  };

  const handleImageSelectionCancel = () => {
    setImageSelectorOpen(false);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };"""

content = content.replace(old_handlers, new_handlers)

# 6. メール送信処理を更新
old_send = """        // 添付ファイルを追加
        attachments.forEach(file => {
          formData.append('attachments', file);
        });"""

new_send = """        // 画像を添付ファイルに変換（ローカルファイルのみ）
        for (const image of selectedImages) {
          if (image.source === 'local' && image.localFile) {
            formData.append('attachments', image.localFile);
          }
        }"""

content = content.replace(old_send, new_send)

# 7. クリア処理を更新
content = content.replace(
    "setAttachments([]); // 添付ファイルをクリア",
    "setSelectedImages([]); // 選択画像をクリア"
)

# 8. 添付ファイルUIを置き換え
# まず、古いUIの開始位置を見つける
old_ui_start = "          {/* 添付ファイル選択 */}"
old_ui_end = "          </Box>\n        </DialogContent>"

# 新しいUIを作成
new_ui = """          {/* 画像添付ボタン */}
          <Box>
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={handleOpenImageSelector}
              fullWidth
            >
              画像を添付
            </Button>

            {selectedImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success">
                  {selectedImages.length}枚の画像が選択されました
                </Alert>
                <List dense sx={{ mt: 1 }}>
                  {selectedImages.map((image, index) => (
                    <ListItem
                      key={image.id}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => removeImage(index)}>
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={image.name}
                        secondary={`${(image.size / 1024).toFixed(1)} KB - ${image.source === 'drive' ? 'Google Drive' : image.source === 'local' ? 'ローカル' : 'URL'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </DialogContent>"""

# 正規表現で古いUIを見つけて置き換え
pattern = r'          /\* 添付ファイル選択 \*/.*?          </Box>\s*</DialogContent>'
content = re.sub(pattern, new_ui, content, flags=re.DOTALL)

# 9. ImageSelectorModalを追加（Snackbarの後）
old_snackbar_end = """      </Snackbar>
    </Container>
  );
}"""

new_snackbar_end = """      </Snackbar>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={handleImageSelectionConfirm}
        onCancel={handleImageSelectionCancel}
      />
    </Container>
  );
}"""

content = content.replace(old_snackbar_end, new_snackbar_end)

# ファイルに書き込む
with open('frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')
