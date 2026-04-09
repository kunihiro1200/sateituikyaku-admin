SELECT target_id, action, metadata->>'source' as source, metadata->>'subject' as subject, created_at
FROM activity_logs
WHERE target_type = 'buyer' AND (target_id = '6752' OR target_id = '4216')
ORDER BY created_at DESC LIMIT 10;
