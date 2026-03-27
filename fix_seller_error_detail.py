# エラーレスポンスに詳細を含めて原因特定
with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''  } catch (error) {
    console.error('Update seller error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_SELLER_ERROR',
        message: 'Failed to update seller',
        retryable: true,
      },
    });
  }
});'''

new = '''  } catch (error: any) {
    console.error('Update seller error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_SELLER_ERROR',
        message: error?.message || 'Failed to update seller',
        detail: error?.message,
        retryable: true,
      },
    });
  }
});'''

if old in text:
    text = text.replace(old, new)
    with open('backend/src/routes/sellers.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: target not found')
    idx = text.find('UPDATE_SELLER_ERROR')
    print(f'Found UPDATE_SELLER_ERROR at: {idx}')
