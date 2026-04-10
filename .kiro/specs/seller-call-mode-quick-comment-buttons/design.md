# デザイン設計書

## 概要

売主管理システムの通話モードページ（CallModePage）のコメントクイックボタンエリアに、2つの新しいChipボタンを追加する。

- **「お客様います」ボタン**（ID: `call-memo-has-customer`）: 押すと長文テキストをコメントエディタに太字挿入する
- **「当社紹介」ボタン**（ID: `call-memo-our-referral`）: 押すと「当社紹介済み」をコメントエディタに太字挿入する

変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ。バックエンドの変更は不要。

---

## アーキテクチャ

### 変更範囲

```
frontend/frontend/src/pages/CallModePage.tsx
  └── コメントクイックボタンエリア（6592行目付近）
        └── 「不通」Chipの直後に2つのChipを追加
```

### 既存の仕組みとの関係

```
useCallModeQuickButtonState(id)
  ├── handleQuickButtonClick(buttonId)  ← ボタン押下時の無効化状態管理
  ├── isButtonDisabled(buttonId)        ← disabled prop に渡す
  └── getButtonState(buttonId)          ← 'pending' | 'persisted' | null を返す

appendBoldText(text)                    ← コメントエディタへの太字テキスト挿入
```

新しいボタンは既存の `handleQuickButtonClick`、`isButtonDisabled`、`getButtonState`、`appendBoldText` をそのまま利用する。新規の関数・フック・状態管理は一切不要。

---

## コンポーネントとインターフェース

### 追加するChipコンポーネント（2つ）

#### 「お客様います」ボタン

| プロパティ | 値 |
|-----------|-----|
| `label` | `"お客様います"` |
| `size` | `"small"` |
| `clickable` | `true` |
| `disabled` | `isButtonDisabled('call-memo-has-customer')` |
| `onClick` | `handleQuickButtonClick('call-memo-has-customer')` + `appendBoldText('お客様からこの辺で探していると問合せがあったときにご紹介は控えたほうが良いですよね？')` |
| 通常時 `backgroundColor` | `#fce4ec`（ピンク） |
| pending時 `backgroundColor` | `#fff9c4`（黄色） |
| pending時 `textDecoration` | `line-through` |
| pending時 `color` | `text.secondary` |
| persisted時 `backgroundColor` | `#e0e0e0`（グレー） |
| persisted時 `textDecoration` | `line-through` |
| persisted時 `color` | `text.disabled` |

#### 「当社紹介」ボタン

| プロパティ | 値 |
|-----------|-----|
| `label` | `"当社紹介"` |
| `size` | `"small"` |
| `clickable` | `true` |
| `disabled` | `isButtonDisabled('call-memo-our-referral')` |
| `onClick` | `handleQuickButtonClick('call-memo-our-referral')` + `appendBoldText('当社紹介済み')` |
| 通常時 `backgroundColor` | `#fce4ec`（ピンク） |
| pending時 `backgroundColor` | `#fff9c4`（黄色） |
| pending時 `textDecoration` | `line-through` |
| pending時 `color` | `text.secondary` |
| persisted時 `backgroundColor` | `#e0e0e0`（グレー） |
| persisted時 `textDecoration` | `line-through` |
| persisted時 `color` | `text.disabled` |

### 挿入位置

```tsx
{/* 既存 */}
<Chip label="不通" ... />

{/* ↓ ここに追加 */}
<Chip label="お客様います" ... />
<Chip label="当社紹介" ... />

</Box>  {/* クイックボタンエリアの閉じタグ */}
</Box>
```

---

## データモデル

新規のデータモデルは不要。既存の `useCallModeQuickButtonState` フックが管理するボタン状態マップに、新しいボタンID（`call-memo-has-customer`、`call-memo-our-referral`）が自動的に追加される。

---

## エラーハンドリング

新しいボタンは既存ボタンと同じエラーハンドリング機構を使用する。

- `handleQuickButtonClick` が内部でエラーを処理する（既存実装に準拠）
- `appendBoldText` が内部でエディタ参照の存在チェックを行う（既存実装に準拠）
- 新規のエラーハンドリングコードは不要

---

## テスト戦略

### PBT適用判断

全ての受け入れ基準がUIレンダリング・ボタンクリック動作・スタイル確認に関するものであり、入力の変化によって動作が変わる「普遍的なプロパティ」は存在しない。そのため、**プロパティベーステスト（PBT）は適用しない**。

### 単体テスト（例ベース）

以下の観点でテストを実施する：

1. **ボタン表示確認**
   - ページレンダリング時に「お客様います」ラベルのChipが存在すること
   - ページレンダリング時に「当社紹介」ラベルのChipが存在すること

2. **クリック動作確認**
   - 「お客様います」クリック時に `handleQuickButtonClick('call-memo-has-customer')` が呼ばれること
   - 「お客様います」クリック時に `appendBoldText` が正しいテキストで呼ばれること
   - 「当社紹介」クリック時に `handleQuickButtonClick('call-memo-our-referral')` が呼ばれること
   - 「当社紹介」クリック時に `appendBoldText('当社紹介済み')` が呼ばれること

3. **スタイル確認**
   - 通常状態: `backgroundColor: #fce4ec`
   - pending状態: `backgroundColor: #fff9c4`、`textDecoration: line-through`
   - persisted状態: `backgroundColor: #e0e0e0`、`textDecoration: line-through`

### 実装確認（手動）

CallModePageを開き、コメントクイックボタンエリアで以下を確認する：

1. 「不通」ボタンの直後に「お客様います」「当社紹介」ボタンが表示される
2. 各ボタンがピンク背景（`#fce4ec`）で表示される
3. 「お客様います」を押すと長文テキストがコメントエディタに太字で挿入される
4. 「当社紹介」を押すと「当社紹介済み」がコメントエディタに太字で挿入される
5. ボタン押下後にpending状態（黄色背景・取り消し線）になる
6. 保存後にpersisted状態（グレー背景・取り消し線）になる

---

## 実装メモ

### ファイルエンコーディング保護

`CallModePage.tsx` は日本語を含む大規模ファイルのため、`strReplace` ツールでの直接編集はShift-JIS変換リスクがある。実装時はPythonスクリプトを使用してUTF-8で安全に書き込む。

```python
# 実装時のPythonスクリプト例
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「不通」ボタンの閉じタグの直後に新ボタンを挿入
old_str = """                />
              </Box>
            </Box>

            {/* コメント入力・編集エリア"""

new_str = """                />
                <Chip
                  label="お客様います"
                  onClick={() => {
                    handleQuickButtonClick('call-memo-has-customer');
                    appendBoldText('お客様からこの辺で探していると問合せがあったときにご紹介は控えたほうが良いですよね？');
                  }}
                  size="small"
                  clickable
                  disabled={isButtonDisabled('call-memo-has-customer')}
                  sx={{
                    backgroundColor: '#fce4ec',
                    ...(getButtonState('call-memo-has-customer') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-has-customer') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
                <Chip
                  label="当社紹介"
                  onClick={() => {
                    handleQuickButtonClick('call-memo-our-referral');
                    appendBoldText('当社紹介済み');
                  }}
                  size="small"
                  clickable
                  disabled={isButtonDisabled('call-memo-our-referral')}
                  sx={{
                    backgroundColor: '#fce4ec',
                    ...(getButtonState('call-memo-our-referral') === 'pending' && {
                      backgroundColor: '#fff9c4',
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                    }),
                    ...(getButtonState('call-memo-our-referral') === 'persisted' && {
                      backgroundColor: '#e0e0e0',
                      textDecoration: 'line-through',
                      color: 'text.disabled',
                    }),
                  }}
                />
              </Box>
            </Box>

            {/* コメント入力・編集エリア"""

text = text.replace(old_str, new_str, 1)

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
```
