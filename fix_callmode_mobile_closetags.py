#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx - アコーディオンBoxの閉じタグを追加
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: コメント欄Gridの閉じタグの前に </Box> を追加
# コメント欄Gridの最後（AssigneeSection の後）
old_comment_grid_end = """            )}
          </Grid>
        </Grid>

      </Box>
      </Box>"""

new_comment_grid_end = """            )}
            </Box>{/* スマホ時コメント開閉Box */}
          </Grid>
        </Grid>

      </Box>
      </Box>"""

if old_comment_grid_end in text:
    text = text.replace(old_comment_grid_end, new_comment_grid_end)
    print("✅ コメント欄の閉じBoxタグを追加しました")
else:
    print("❌ コメント欄の閉じタグ箇所が見つかりませんでした")

# 修正2: 物件情報Gridの閉じタグの前に </Box> を追加
# 物件情報Gridの最後（PerformanceMetricsSection の後）
# 左側Gridの終わりを探す - 右側Gridの直前
old_property_grid_end = """            </Paper>
          </Grid>

          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}"""

new_property_grid_end = """            </Paper>
            </Box>{/* スマホ時物件情報開閉Box */}
          </Grid>

          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}"""

if old_property_grid_end in text:
    text = text.replace(old_property_grid_end, new_property_grid_end)
    print("✅ 物件情報欄の閉じBoxタグを追加しました")
else:
    print("❌ 物件情報欄の閉じタグ箇所が見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
