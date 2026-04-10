with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_str = """                  sx={{
                    ...(getButtonState('call-memo-unreachable') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-unreachable') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
              </Box>
            </Box>

            {/* コメント入力・編集エリア（直接書き込み可能） */}"""

new_str = """                  sx={{
                    ...(getButtonState('call-memo-unreachable') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-unreachable') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
                <Chip
                  label="お客様います"
                  onClick={() => {
                    handleQuickButtonClick('call-memo-has-customer');
                    appendBoldText('お客様からこの辺で探していると問合せがあったときにご紹介は控えたほうが良いですよね？');
                  }}
                  size="small"
                  clickable
                  disabled={isButtonDisabled('call-memo-has-customer')}
                  sx={{
                    backgroundColor: '#fce4ec',
                    ...(getButtonState('call-memo-has-customer') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-has-customer') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
                <Chip
                  label="当社紹介"
                  onClick={() => {
                    handleQuickButtonClick('call-memo-our-referral');
                    appendBoldText('当社紹介済み');
                  }}
                  size="small"
                  clickable
                  disabled={isButtonDisabled('call-memo-our-referral')}
                  sx={{
                    backgroundColor: '#fce4ec',
                    ...(getButtonState('call-memo-our-referral') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-our-referral') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
              </Box>
            </Box>

            {/* コメント入力・編集エリア（直接書き込み可能） */}"""

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('SUCCESS: ボタンを追加しました')
else:
    print('ERROR: 挿入位置が見つかりませんでした')
