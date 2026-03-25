# BuyerDetailPage.tsx の修正
# vendor_survey: 常時表示に変更（値が空でも表示、「未」のときはオレンジ強調）
# これにより画面から直接設定できるようになる

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_vendor = """                    // vendor_surveyフィールドは特別処理（値が入っている場合は常時表示、「未」のときはオレンジ強調）
                    if (field.key === 'vendor_survey') {
                      // 値が空の場合は非表示
                      if (!buyer?.vendor_survey) {
                        return null;
                      }
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      const isUmi = buyer?.vendor_survey === '未';"""

new_vendor = """                    // vendor_surveyフィールドは特別処理（常時表示、「未」のときはオレンジ強調）
                    if (field.key === 'vendor_survey') {
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      const isUmi = buyer?.vendor_survey === '未';"""

if old_vendor in text:
    text = text.replace(old_vendor, new_vendor)
    print('変更: vendor_survey 常時表示に変更完了')
else:
    print('エラー: ターゲットが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
