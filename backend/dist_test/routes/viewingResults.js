"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 内覧結果のAPIルート
const express_1 = require("express");
const ViewingService_1 = require("../services/ViewingService");
const router = (0, express_1.Router)();
const viewingService = new ViewingService_1.ViewingService();
// 買主の内覧結果を取得（買主番号でグループ化）
router.get('/buyers/:buyerId/viewing-results', async (req, res) => {
    try {
        const { buyerId } = req.params;
        const { groupByBuyerNumber } = req.query;
        if (groupByBuyerNumber === 'true') {
            const grouped = await viewingService.getByBuyerIdGroupedByBuyerNumber(buyerId);
            return res.json(grouped);
        }
        const results = await viewingService.getByBuyerId(buyerId);
        res.json(results);
    }
    catch (error) {
        console.error('Error fetching viewing results:', error);
        res.status(500).json({ error: error.message });
    }
});
// 特定の買主番号の内覧結果を取得
router.get('/buyers/:buyerId/viewing-results/:buyerNumber', async (req, res) => {
    try {
        const { buyerId, buyerNumber } = req.params;
        const results = await viewingService.getByBuyerIdAndBuyerNumber(buyerId, buyerNumber);
        res.json(results);
    }
    catch (error) {
        console.error('Error fetching viewing results:', error);
        res.status(500).json({ error: error.message });
    }
});
// 内覧結果を作成
router.post('/viewing-results', async (req, res) => {
    try {
        const { buyer_id, buyer_number, property_number, viewing_date, assignee, status, result, feedback } = req.body;
        // 基本的なバリデーション
        if (!buyer_id || !buyer_number || !property_number || !viewing_date) {
            return res.status(400).json({
                error: 'buyer_id, buyer_number, property_number, and viewing_date are required'
            });
        }
        // 買主番号が有効かチェック
        const isValid = await viewingService.validateBuyerNumber(buyer_id, buyer_number);
        if (!isValid) {
            return res.status(400).json({
                error: 'Invalid buyer_number. Must be current or past buyer number for this buyer.'
            });
        }
        const newResult = await viewingService.create({
            buyer_id,
            buyer_number,
            property_number,
            viewing_date: new Date(viewing_date),
            assignee,
            status,
            result,
            feedback
        });
        res.status(201).json(newResult);
    }
    catch (error) {
        console.error('Error creating viewing result:', error);
        res.status(500).json({ error: error.message });
    }
});
// 内覧結果を更新
router.put('/viewing-results/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // 買主番号を変更する場合はバリデーション
        if (updateData.buyer_number && updateData.buyer_id) {
            const isValid = await viewingService.validateBuyerNumber(updateData.buyer_id, updateData.buyer_number);
            if (!isValid) {
                return res.status(400).json({
                    error: 'Invalid buyer_number. Must be current or past buyer number for this buyer.'
                });
            }
        }
        const updated = await viewingService.update(id, updateData);
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating viewing result:', error);
        res.status(500).json({ error: error.message });
    }
});
// 内覧結果を削除
router.delete('/viewing-results/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await viewingService.delete(id);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting viewing result:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
