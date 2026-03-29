# NewBuyerPage.tsx に売主コピー・買主コピーのAutocomplete UIを追加するスクリプト
# file-encoding-protection.md のルールに従い、UTF-8で書き込む

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 買主番号フィールドの前に挿入するUI
ui_to_insert = """                {/* 売主コピー */}
                <Grid item xs={12}>
                  <Autocomplete
                    options={sellerCopyOptions}
                    getOptionLabel={(option) => `${option.sellerNumber} - ${option.name}`}
                    loading={sellerCopyLoading}
                    inputValue={sellerCopyInput}
                    onInputChange={(_event, value) => {
                      setSellerCopyInput(value);
                      handleSellerCopySearch(value);
                    }}
                    onChange={(_event, value) => handleSellerCopySelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="売主コピー（既存の売主番号を入力して情報をコピー）"
                        placeholder="例: AA910"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {sellerCopyLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText="該当する売主が見つかりません"
                    isOptionEqualToValue={(option, value) => option.sellerNumber === value.sellerNumber}
                  />
                </Grid>

                {/* 買主コピー */}
                <Grid item xs={12}>
                  <Autocomplete
                    options={buyerCopyOptions}
                    getOptionLabel={(option) => `${option.buyer_number} - ${option.name}`}
                    loading={buyerCopyLoading}
                    inputValue={buyerCopyInput}
                    onInputChange={(_event, value) => {
                      setBuyerCopyInput(value);
                      handleBuyerCopySearch(value);
                    }}
                    onChange={(_event, value) => handleBuyerCopySelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="買主コピー（既存の買主番号を入力して情報をコピー）"
                        placeholder="例: 2051"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {buyerCopyLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText="該当する買主が見つかりません"
                    isOptionEqualToValue={(option, value) => option.buyer_number === value.buyer_number}
                  />
                </Grid>

"""

# 買主番号フィールドの前に挿入
target = """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="買主番号（自動採番）"
                    value={nextBuyerNumber || '取得中...'}
                    InputProps={{ readOnly: true }}
                    sx={{ bgcolor: '#f5f5f5' }}
                  />
                </Grid>"""

replacement = ui_to_insert + """                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="買主番号（自動採番）"
                    value={nextBuyerNumber || '取得中...'}
                    InputProps={{ readOnly: true }}
                    sx={{ bgcolor: '#f5f5f5' }}
                  />
                </Grid>"""

if target in text:
    text = text.replace(target, replacement, 1)
    print('✅ UIコンポーネントを挿入しました')
else:
    print('❌ 挿入ターゲットが見つかりませんでした')

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)}')
