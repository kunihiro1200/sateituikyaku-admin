#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App.tsx に PropertyReportPage のルートを追加
"""

with open('frontend/frontend/src/App.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. import 追加
old_import = "import PropertyListingDetailPage from './pages/PropertyListingDetailPage';"
new_import = """import PropertyListingDetailPage from './pages/PropertyListingDetailPage';
import PropertyReportPage from './pages/PropertyReportPage';"""
text = text.replace(old_import, new_import)

# 2. ルート追加（buyer-candidates の後、propertyNumber の前）
old_route = """      <Route
        path="/property-listings/:propertyNumber"
        element={
          <ProtectedRoute>
            <PropertyListingDetailPage />
          </ProtectedRoute>
        }
      />"""
new_route = """      <Route
        path="/property-listings/:propertyNumber/report"
        element={
          <ProtectedRoute>
            <PropertyReportPage />
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

print('Done! App.tsx updated with PropertyReportPage route.')
