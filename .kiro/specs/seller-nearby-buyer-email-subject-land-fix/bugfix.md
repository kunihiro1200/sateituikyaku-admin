# Bugfix Requirements Document

## Introduction

売主リストの近隣買主メール送信機能において、物件種別が「土地」の場合でも件名末尾に「事前に内覧可能です！」が付与されてしまうバグを修正する。
土地は建物が存在しないため「内覧」という表現が不適切であり、物件種別が「土地」の場合は当該文言を省略する必要がある。

対象ファイル: `frontend/frontend/src/components/NearbyBuyersList.tsx`（`handleSendEmail` 関数内の件名生成ロジック）

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件種別が「土地」であり、近隣買主メール送信ボタンを押下する THEN システムは件名を `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！` と生成する（「事前に内覧可能です！」が含まれる）

### Expected Behavior (Correct)

2.1 WHEN 物件種別が「土地」であり、近隣買主メール送信ボタンを押下する THEN システムは件名を `${address}に興味のあるかた！もうすぐ売り出します！` と生成する SHALL（「事前に内覧可能です！」を省略する）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件種別が「土地」以外（戸建・マンション等）であり、近隣買主メール送信ボタンを押下する THEN システムは件名を `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！` と生成する SHALL CONTINUE TO（現行の件名をそのまま維持する）
