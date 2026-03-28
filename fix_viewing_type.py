"""
BuyerViewingResultPage.tsx の viewing_mobile を正しいカラム名に修正する。
- 専任物件セクション: viewing_mobile → viewing_type
- 一般媒介物件セクション: viewing_mobile → viewing_type_general
- カレンダー/SMS用の参照: viewing_mobile → viewing_type
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 専任物件セクション（hasExclusiveProperty）の viewing_mobile → viewing_type
# 一般媒介セクション（hasGeneralProperty）の viewing_mobile → viewing_type_general
# の2種類があるため、セクションを分けて処理する

# まず専任セクションを特定して置換
# 専任セクション: hasExclusiveProperty が true の場合
exclusive_old = """              if (hasExclusiveProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_mobile && buyer.viewing_mobile.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_EXCLUSIVE_OPTIONS = [
                  '【内覧_専（自社物件）】',
                  '【内覧（他社物件）】',
                  '準不【内覧_専（立会）】',
                  '準不【内覧_専（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_EXCLUSIVE_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_mobile === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_mobile === option ? '' : option;
                              await handleInlineFieldSave('viewing_mobile', newValue);
                            }}"""

exclusive_new = """              if (hasExclusiveProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_type && buyer.viewing_type.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_EXCLUSIVE_OPTIONS = [
                  '【内覧_専（自社物件）】',
                  '【内覧（他社物件）】',
                  '準不【内覧_専（立会）】',
                  '準不【内覧_専（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_EXCLUSIVE_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_type === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_type === option ? '' : option;
                              await handleInlineFieldSave('viewing_type', newValue);
                            }}"""

# 一般媒介セクション
general_old = """              if (hasGeneralProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_mobile && buyer.viewing_mobile.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_GENERAL_OPTIONS = [
                  '【内覧_一般（自社物件）】',
                  '準不【内覧_一般（立会）】',
                  '準不【内覧_一般（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態_一般媒介 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_GENERAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_mobile === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_mobile === option ? '' : option;
                              await handleInlineFieldSave('viewing_mobile', newValue);
                            }}"""

general_new = """              if (hasGeneralProperty) {
                // 必須条件：内覧日が入力されているが、内覧形態が未入力の場合
                const hasValue = buyer.viewing_type_general && buyer.viewing_type_general.trim() !== '';
                const isRequired = !hasValue;

                const VIEWING_FORM_GENERAL_OPTIONS = [
                  '【内覧_一般（自社物件）】',
                  '準不【内覧_一般（立会）】',
                  '準不【内覧_一般（立会不要）】',
                ];

                return (
                  <Box sx={{ width: '400px', flexShrink: 0 }}>
                    <Box 
                      sx={{ 
                        p: isRequired ? 1 : 0,
                        border: isRequired ? '2px solid' : 'none',
                        borderColor: isRequired ? 'error.main' : 'transparent',
                        borderRadius: 2,
                        bgcolor: isRequired ? 'rgba(255, 205, 210, 0.3)' : 'transparent',
                        boxShadow: isRequired ? '0 2px 8px rgba(211, 47, 47, 0.2)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                        内覧形態_一般媒介 {isRequired && <span style={{ color: 'red', fontWeight: 'bold' }}>*必須</span>}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {VIEWING_FORM_GENERAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant={buyer.viewing_type_general === option ? 'contained' : 'outlined'}
                            color="primary"
                            size="small"
                            onClick={async () => {
                              // 同じボタンを2度クリックしたら値をクリア
                              const newValue = buyer.viewing_type_general === option ? '' : option;
                              await handleInlineFieldSave('viewing_type_general', newValue);
                            }}"""

# カレンダー/SMS用の残りの viewing_mobile 参照を viewing_type に置換
text = text.replace(exclusive_old, exclusive_new)
text = text.replace(general_old, general_new)

# 残りの viewing_mobile 参照（カレンダータイトル、SMS等）を viewing_type に置換
text = text.replace("buyer.viewing_mobile || '内覧'", "buyer.viewing_type || buyer.viewing_type_general || '内覧'")
text = text.replace('viewingMobile: buyer.viewing_mobile,', 'viewingMobile: buyer.viewing_type || buyer.viewing_type_general,')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# 残りの viewing_mobile が残っていないか確認
remaining = text.count('viewing_mobile')
print(f'Remaining viewing_mobile references: {remaining}')
