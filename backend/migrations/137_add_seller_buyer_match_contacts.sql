-- Migration 137: 売主×買主ペアごとのマッチング連絡状況テーブルを追加
--
-- 背景:
--   これまでは sellers.match_contact_status / buyers.match_contact_status という
--   単一カラムで連絡状況を管理していたが、1人の売主に複数の買主候補がマッチする場合、
--   買主ごとに個別の連絡状況（連絡済み/連絡不要/連絡未）を記録する必要がある。
--   そのため、売主IDと買主番号の組み合わせ（ペア）ごとに連絡状況を記録する
--   専用テーブルを新設する。
--
-- 用途:
--   つうわモードページのマッチングセクションで、マッチした買主候補を一覧テーブルで表示し、
--   各行に「連絡済み/連絡不要/連絡未」ボタンを設置して記録する。
--   買主詳細ページでも同様に、マッチした売主候補ごとの連絡状況を確認・更新できる。

CREATE TABLE IF NOT EXISTS seller_buyer_match_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    buyer_number TEXT NOT NULL,
    contact_status TEXT NOT NULL DEFAULT '連絡未', -- '連絡済み' | '連絡不要' | '連絡未'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT, -- 更新した担当者（任意）

    UNIQUE(seller_id, buyer_number)
);

CREATE INDEX IF NOT EXISTS idx_seller_buyer_match_contacts_seller_id ON seller_buyer_match_contacts(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_buyer_match_contacts_buyer_number ON seller_buyer_match_contacts(buyer_number);
CREATE INDEX IF NOT EXISTS idx_seller_buyer_match_contacts_status ON seller_buyer_match_contacts(contact_status);

COMMENT ON TABLE seller_buyer_match_contacts IS 'マッチング機能: 売主×買主ペアごとの連絡状況（連絡済み/連絡不要/連絡未）';
COMMENT ON COLUMN seller_buyer_match_contacts.seller_id IS 'sellers.id への参照';
COMMENT ON COLUMN seller_buyer_match_contacts.buyer_number IS 'buyers.buyer_number（売主候補側から見た相手の買主番号）';
COMMENT ON COLUMN seller_buyer_match_contacts.contact_status IS '連絡済み/連絡不要/連絡未';
