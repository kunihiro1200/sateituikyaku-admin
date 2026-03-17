"""
テスト3の修正スクリプト v3
CRLF改行コードに対応
"""

with open('frontend/frontend/src/__tests__/bug-condition-exploration.test.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF対応の置換
old_str = "    // api.get \u304c\u547c\u3070\u308c\u308b\u307e\u3067\u5f85\u3064\uff08useEffect \u304c\u5b9f\u884c\u3055\u308c\u308b\u306e\u3092\u78ba\u8a8d\uff09\r\n    await waitFor(() => {\r\n      expect(mockApi.get).toHaveBeenCalled();\r\n    });\r\n\r\n    // Promise \u306e reject \u304c\u51e6\u7406\u3055\u308c\u308b\u307e\u3067\u5f85\u3064\r\n    await new Promise((resolve) => setTimeout(resolve, 100));\r\n\r\n    // \u672a\u4fee\u6b63\u30b3\u30fc\u30c9\u3067\u306f 'Failed to fetch scheduled notifications:' \u304c\u51fa\u529b\u3055\u308c\u308b\u305f\u3081\u5931\u6557\u3059\u308b"

new_str = "    // \u4fee\u6b63\u5f8c\u306e\u30b3\u30fc\u30c9\u3067\u306f api.get \u306f\u547c\u3070\u308c\u306a\u3044\u305f\u3081\u3001\u5358\u7d14\u306b\u5f85\u6a5f\u3057\u3066\u304b\u3089\u78ba\u8a8d\u3059\u308b\r\n    await new Promise((resolve) => setTimeout(resolve, 100));\r\n\r\n    // \u4fee\u6b63\u5f8c\u306e\u30b3\u30fc\u30c9\u3067\u306f 'Failed to fetch scheduled notifications:' \u306f\u51fa\u529b\u3055\u308c\u306a\u3044"

if old_str in text:
    text = text.replace(old_str, new_str)
    print("Replacement successful!")
else:
    print("String not found, trying alternative...")
    # 別の方法で探す
    idx = text.find('api.get \u304c\u547c\u3070\u308c\u308b\u307e\u3067\u5f85\u3064')
    print(f"Found at: {idx}")
    if idx >= 0:
        print(repr(text[idx:idx+400]))

with open('frontend/frontend/src/__tests__/bug-condition-exploration.test.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
