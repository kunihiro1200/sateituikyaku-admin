import hashlib

with open('backend/src/services/AuthService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# キャッシュキーをトークン先頭32文字からトークン全体のSHA256ハッシュに変更
old_validate = '  async validateSession(accessToken: string): Promise<Employee> {\r\n    // キャッシュをチェック（トークンの先頭32文字をキーに使用）\r\n    const cacheKey = accessToken.substring(0, 32);\r\n    const cached = _sessionCache.get(cacheKey);'

new_validate = '  async validateSession(accessToken: string): Promise<Employee> {\r\n    // キャッシュをチェック（トークン全体のSHA256ハッシュをキーに使用）\r\n    // ⚠️ 先頭32文字はJWTヘッダー部分で全ユーザー共通のため、必ずハッシュ全体を使う\r\n    const crypto = require(\'crypto\');\r\n    const cacheKey = crypto.createHash(\'sha256\').update(accessToken).digest(\'hex\');\r\n    const cached = _sessionCache.get(cacheKey);'

# logoutのキャッシュクリアも修正
old_logout = '    // キャッシュをクリア\r\n    const cacheKey = accessToken.substring(0, 32);\r\n    _sessionCache.delete(cacheKey);'

new_logout = '    // キャッシュをクリア\r\n    const crypto = require(\'crypto\');\r\n    const cacheKey = crypto.createHash(\'sha256\').update(accessToken).digest(\'hex\');\r\n    _sessionCache.delete(cacheKey);'

if old_validate in text:
    text = text.replace(old_validate, new_validate)
    print('validateSession キャッシュキー修正: OK')
else:
    print('ERROR: validateSession の対象文字列が見つかりません')

if old_logout in text:
    text = text.replace(old_logout, new_logout)
    print('logout キャッシュクリア修正: OK')
else:
    print('ERROR: logout の対象文字列が見つかりません')

with open('backend/src/services/AuthService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
