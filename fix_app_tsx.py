with open('frontend/frontend/src/App.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ReinsRegistrationPage のインポートを追加
old_import = "import NearbyBuyersPage from './pages/NearbyBuyersPage';"
new_import = "import NearbyBuyersPage from './pages/NearbyBuyersPage';\nimport ReinsRegistrationPage from './pages/ReinsRegistrationPage';"
text = text.replace(old_import, new_import)

# /property-listings/:propertyNumber ルートの前にレインズ登録ルートを追加
old_route = """      <Route
        path="/property-listings/:propertyNumber"
        element={
          <ProtectedRoute>
            <PropertyListingDetailPage />
          </ProtectedRoute>
        }
      />"""
new_route = """      <Route
        path="/property-listings/:propertyNumber/reins-registration"
        element={
          <ProtectedRoute>
            <ReinsRegistrationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber"
        element={
          <ProtectedRoute>
            <PropertyListingDetailPage />
          </ProtectedRoute>
        }
      />"""
text = text.replace(old_route, new_route)

with open('frontend/frontend/src/App.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
