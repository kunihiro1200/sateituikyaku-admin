# -*- coding: utf-8 -*-
import re

# ファイルを読み込む
with open('frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 1. 古いタブUIのコードを完全に削除
# 「画像を選択」から「</Box>」までを削除
pattern = r'          <Typography variant="subtitle2".*?画像を選択.*?</Typography>.*?<Tabs value=\{attachmentTab\}.*?</Box>\s*</DialogContent>'
content = re.sub(pattern, '          {/* 画像添付ボタン */}\n          <Box>\n            <Button\n              variant="outlined"\n              startIcon={<ImageIcon />}\n              onClick={handleOpenImageSelector}\n              fullWidth\n            >\n              画像を添付\n            </Button>\n\n            {selectedImages.length > 0 && (\n              <Box sx={{ mt: 2 }}>\n                <Alert severity="success">\n                  {selectedImages.length}枚の画像が選択されました\n                </Alert>\n                <List dense sx={{ mt: 1 }}>\n                  {selectedImages.map((image, index) => (\n                    <ListItem\n                      key={image.id}\n                      secondaryAction={\n                        <IconButton edge="end" onClick={() => removeImage(index)}>\n                          <DeleteIcon />\n                        </IconButton>\n                      }\n                    >\n                      <ListItemText\n                        primary={image.name}\n                        secondary={`${(image.size / 1024).toFixed(1)} KB - ${image.source === \'drive\' ? \'Google Drive\' : image.source === \'local\' ? \'ローカル\' : \'URL\'}`}\n                      />\n                    </ListItem>\n                  ))}\n                </List>\n              </Box>\n            )}\n          </Box>\n        </DialogContent>', content, flags=re.DOTALL)

# 2. ImageIconのインポートを追加（まだない場合）
if 'Image as ImageIcon' not in content:
    content = content.replace(
        'import {\n  Email as EmailIcon,',
        'import {\n  Email as EmailIcon,\n  Image as ImageIcon,'
    )

# ファイルに書き込む
with open('frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')
