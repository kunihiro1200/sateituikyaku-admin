-- Migration 20261014b: 添付資料２にハザードマップ確認済みフラグを追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS hazard_map_confirmed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN seller_attached_document2.hazard_map_confirmed IS
  '自治体の最新ハザードマップを確認済みかどうか（添付資料２のチェックボックス）';
