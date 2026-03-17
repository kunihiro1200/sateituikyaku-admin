"""
テスト3の修正スクリプト
api.get が呼ばれることを前提とせず、単純に console.error が呼ばれないことを確認するように変更
"""

with open('frontend/frontend/src/__tests__/bug-condition-exploration.test.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# テスト3の問題箇所を修正
# 「api.get が呼ばれるまで待つ」部分を削除し、単純に待機してから確認する
old_str = """    // api.get が呼ばれるまで待つ（useEffect が実行されるのを確認）
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled();
    });

    // Promise の reject が処理されるまで待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 未修正コードでは 'Failed to fetch scheduled notifications:' が出力されるため失敗する"""

new_str = """    // 修正後のコードでは api.get は呼ばれないため、単純に待機してから確認する
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 修正後のコードでは 'Failed to fetch scheduled notifications:' は出力されない"""

text = text.replace(old_str, new_str)

with open('frontend/frontend/src/__tests__/bug-condition-exploration.test.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! テスト3を修正しました。')
