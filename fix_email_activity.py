import re

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Email送信後のsetSuccessMessageを、活動履歴記録＋担当フィールド自動セット＋Snackbarに置き換え
old = """          setSuccessMessage(hasImages ? `${template.label}を画像付きで送信しました` : `${template.label}を送信しました`);
        }
      } else if (type === 'sms') {"""

new = """          // Email送信後、活動履歴を記録
          await api.post(`/api/sellers/${id}/activities`, {
            type: 'email',
            content: `【${template.label}】を送信`,
            result: 'sent',
          });

          setSnackbarMessage(hasImages ? `${template.label}を画像付きで送信しました` : `${template.label}を送信しました`);
          setSnackbarOpen(true);

          // Email送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
          try {
            const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];
            let myInitial = '';
            const myEmployee = activeEmployees.find(e => e.email === employee?.email);
            if (myEmployee?.initials) {
              myInitial = myEmployee.initials;
            } else {
              try {
                const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());
                const freshMe = freshEmployees.find(e => e.email === employee?.email);
                myInitial = freshMe?.initials || employee?.initials || '';
              } catch {
                myInitial = employee?.initials || '';
              }
            }
            if (assigneeKey && myInitial && seller?.id) {
              await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });
              setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);
            }
          } catch (assigneeErr) {
            console.error('Email担当フィールド自動セットエラー:', assigneeErr);
          }
        }
      } else if (type === 'sms') {"""

if old in text:
    text = text.replace(old, new)
    print('✅ 置換成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
