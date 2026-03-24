---
inclusion: always
---

# ボタン選択UIのレイアウトルール（全リスト共通）

## ⚠️ 重要：ボタン選択を使用する際の必須レイアウト

フィールドの値をボタンで選択するUI（ボックス選択）を実装する場合、**全てのリスト・詳細画面で以下のレイアウトを統一すること**。

---

## ✅ 正しいレイアウト

### 基本構造

```tsx
<Grid item xs={12}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {/* ラベル：横並び・縮まない */}
    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
      {field.label}
    </Typography>
    {/* ボタン群：残りの幅を全て使う */}
    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
      {OPTIONS.map((option) => {
        const isSelected = value === option;
        return (
          <Button
            key={option}
            size="small"
            variant={isSelected ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => handleSelect(option)}
            sx={{
              flex: 1,          // ← 均等幅（必須）
              py: 0.5,
              fontWeight: isSelected ? 'bold' : 'normal',
              borderRadius: 1,
            }}
          >
            {option}
          </Button>
        );
      })}
    </Box>
  </Box>
</Grid>
```

---

## 📋 ルール一覧

### ルール1: ラベルとボタン群は横並び

```tsx
// ✅ 正しい
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Typography ...>{label}</Typography>
  <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
    {buttons}
  </Box>
</Box>

// ❌ 間違い（ラベルが上、ボタンが下）
<>
  <Typography sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
    {buttons}
  </Box>
</>
```

### ルール2: ボタン群のコンテナに `flex: 1` を付与

ラベルの右側の残り幅を全てボタン群が使うようにする。

```tsx
// ✅ 正しい
<Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>

// ❌ 間違い（幅が固定・内容に依存）
<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
```

### ルール3: 各ボタンに `flex: 1` を付与（均等幅）

ボタン群の幅をボタン数で均等に分割する。

```tsx
// ✅ 正しい
sx={{ flex: 1, py: 0.5, ... }}

// ❌ 間違い（minWidthで固定幅）
sx={{ minWidth: 48, px: 1.5, py: 0.5, ... }}
```

### ルール4: ラベルは `whiteSpace: 'nowrap'` + `flexShrink: 0`

ラベルが折り返したりボタンに押しつぶされないようにする。

```tsx
// ✅ 正しい
sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
```

---

## 🎯 適用対象

以下の全ての画面・リストで、ボタン選択UIを実装する際にこのルールを適用すること：

- 買主詳細画面（`BuyerDetailPage.tsx`）
- 売主詳細画面（`SellerDetailPage.tsx`）
- 物件詳細画面（`PropertyDetailPage.tsx`）
- その他、フィールド値をボタンで選択するUI全般

---

## 📐 実装例（買主詳細画面の broker_inquiry）

```tsx
// broker_inquiryフィールドは特別処理（ボックス選択）
if (field.key === 'broker_inquiry') {
  const BROKER_OPTIONS = ['業者', '個人'];
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
          {BROKER_OPTIONS.map((option) => {
            const isSelected = buyer.broker_inquiry === option;
            return (
              <Button
                key={option}
                size="small"
                variant={isSelected ? 'contained' : 'outlined'}
                color="primary"
                onClick={async () => {
                  const newValue = isSelected ? '' : option;
                  handleFieldChange(section.title, field.key, newValue);
                  await handleInlineFieldSave(field.key, newValue);
                }}
                sx={{
                  flex: 1,
                  py: 0.5,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  borderRadius: 1,
                }}
              >
                {option}
              </Button>
            );
          })}
        </Box>
      </Box>
    </Grid>
  );
}
```

---

## 🚨 よくある間違い

### ❌ 間違い1: ボタンに `minWidth` を使う

```tsx
// ❌ ボタンが均等幅にならない
sx={{ minWidth: 48, px: 1.5 }}

// ✅ 均等幅になる
sx={{ flex: 1 }}
```

### ❌ 間違い2: ボタン群コンテナに `flexWrap: 'wrap'` を使う

```tsx
// ❌ 折り返しが発生し、幅いっぱいにならない
<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>

// ✅ 折り返しなし・幅いっぱい
<Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
```

### ❌ 間違い3: ラベルを上に配置する

```tsx
// ❌ ラベルが上・ボタンが下（縦並び）
<Typography sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
<Box sx={{ display: 'flex' }}>{buttons}</Box>

// ✅ ラベルとボタンが横並び
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <Typography sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</Typography>
  <Box sx={{ display: 'flex', flex: 1 }}>{buttons}</Box>
</Box>
```

---

**最終更新日**: 2026年3月25日
**作成理由**: 買主詳細画面の業者問合せフィールドで実装したボタン選択レイアウト（横並び・均等幅）を、全リスト・全画面の共通ルールとして定義するため
