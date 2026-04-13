const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const authMiddleware = require('../middleware/auth');

// POST /orders — protected
router.post('/', authMiddleware, async (req, res) => {
  const { items } = req.body;
  const user_id = req.user_id; // from JWT, not from body

  try {
    const result = await orderService.createOrder({ user_id, items });
    res.status(201).json({ message: 'Order created', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /orders/:id/cancel — protected
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  const order_id = parseInt(req.params.id);
  const user_id = req.user_id;

  try {
    const result = await orderService.cancelOrder({ order_id, user_id });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /orders — protected
router.get('/', authMiddleware, async (req, res) => {
  const user_id = req.user_id;
  const { page = 1, limit = 10 } = req.query;

  try {
    const result = await orderService.getOrders({ user_id, page, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;