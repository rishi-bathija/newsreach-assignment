const express = require('express');
const router = express.Router();
const productService = require('../services/productService');

// POST /products
router.post('/', async (req, res) => {
  const { name, price, stock } = req.body;
  try {
    const product = await productService.createProduct({ name, price, stock });
    res.status(201).json({ message: 'Product created', product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /products
router.get('/', async (req, res) => {
  try {
    const products = await productService.getProducts();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;