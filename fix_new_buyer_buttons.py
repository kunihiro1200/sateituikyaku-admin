with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. registeredBuyerNumber state の後に postRegistrationAction state を追加
old1 = "  const [registeredBuyerNumber, setRegisteredBuyerNumber] = useState<string | null>(null);"
new1 = """  const [registeredBuyerNumber, setRegisteredBuyerNumber] = useState<string | null>(null);
  const [postRegistrationAction, setPostRegistrationAction] = useState<'desired-conditions' | 'viewing-result' | null>(null);"""

text = text.replace(old1, new1, 1)

# 2. handleSubmit の setRegisteredBuyerNumber の後に遷移ロジックを追加
old2 = """      const response = await api.post('/api/buyers', buyerData);
      const createdBuyerNumber = response.data.buyer_number || nextBuyerNumber;
      setRegisteredBuyerNumber(createdBuyerNumber);"""
new2 = """      const response = await api.post('/api/buyers', buyerData);
      const createdBuyerNumber = response.data.buyer_number || nextBuyerNumber;
      setRegisteredBuyerNumber(createdBuyerNumber);
      // 登録後アクションがある場合は即遷移
      if (postRegistrationAction) {
        navigate(`/buyers/${createdBuyerNumber}/${postRegistrationAction}`);
        return;
      }"""

text = text.replace(old2, new2, 1)

# 3. ボタン部分を全面置き換え
# 登録前: キャンセル + 希望条件を入力（登録して遷移）+ 内覧を入力（登録して遷移）+ 登録
# 登録後: 成功メッセージ + 買主詳細・物件詳細ボタン
old3 = """                {/* ボタン */}
                <Grid item xs={12}>
                  {!registeredBuyerNumber ? (
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (propertyNumberField) {
                            navigate(`/property-listings/${propertyNumberField}`);
                          } else {
                            navigate('/buyers');
                          }
                        }}
                        disabled={loading}
                      >
                        キャンセル
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                      >
                        {loading ? '登録中...' : '登録'}
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                      <Typography variant="subtitle1" color="success.dark" fontWeight="bold" gutterBottom>
                        ✅ 買主番号 {registeredBuyerNumber} を登録しました
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/desired-conditions`)}
                        >
                          希望条件を入力
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/viewing-result`)}
                        >
                          内覧を入力
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}`)}
                        >
                          買主詳細を見る
                        </Button>
                        {propertyNumberField && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/property-listings/${propertyNumberField}`)}
                          >
                            物件詳細に戻る
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}
                </Grid>"""

new3 = """                {/* ボタン */}
                <Grid item xs={12}>
                  {!registeredBuyerNumber ? (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
                        <Button
                          variant="contained"
                          color="success"
                          disabled={loading}
                          onClick={() => {
                            setPostRegistrationAction('desired-conditions');
                          }}
                          type="submit"
                        >
                          {loading && postRegistrationAction === 'desired-conditions' ? '登録中...' : '登録して希望条件を入力'}
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={loading}
                          onClick={() => {
                            setPostRegistrationAction('viewing-result');
                          }}
                          type="submit"
                        >
                          {loading && postRegistrationAction === 'viewing-result' ? '登録中...' : '登録して内覧を入力'}
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            if (propertyNumberField) {
                              navigate(`/property-listings/${propertyNumberField}`);
                            } else {
                              navigate('/buyers');
                            }
                          }}
                          disabled={loading}
                        >
                          キャンセル
                        </Button>
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={loading}
                          onClick={() => setPostRegistrationAction(null)}
                        >
                          {loading && !postRegistrationAction ? '登録中...' : '登録'}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                      <Typography variant="subtitle1" color="success.dark" fontWeight="bold" gutterBottom>
                        ✅ 買主番号 {registeredBuyerNumber} を登録しました
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/desired-conditions`)}
                        >
                          希望条件を入力
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}/viewing-result`)}
                        >
                          内覧を入力
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/buyers/${registeredBuyerNumber}`)}
                        >
                          買主詳細を見る
                        </Button>
                        {propertyNumberField && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/property-listings/${propertyNumberField}`)}
                          >
                            物件詳細に戻る
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}
                </Grid>"""

if old3 in text:
    text = text.replace(old3, new3, 1)
    print('ボタン部分の置き換え: OK')
else:
    print('ERROR: ボタン部分が見つかりません')
    # デバッグ用に周辺を確認
    idx = text.find('/* ボタン */')
    print(repr(text[idx:idx+200]))

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
