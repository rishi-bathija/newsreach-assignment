const db = require('../db');

const createProduct = async ({ name, price, stock }) => {
  if (!name || price === undefined || stock === undefined) {
    throw new Error('name, price and stock are required');
  }
  if (price <= 0) throw new Error('price must be greater than 0');
  if (stock < 0) throw new Error('stock cannot be negative');

  const result = await db.query(
    `INSERT INTO products (name, price, stock)
     VALUES ($1, $2, $3)
     RETURNING id, name, price, stock, created_at`,
    [name, price, stock]
  );

  return result.rows[0];
};

const getProducts = async () => {
  const result = await db.query(
    `SELECT id, name, price, stock
     FROM products
     WHERE is_deleted = FALSE
     ORDER BY created_at DESC`
  );
  return result.rows;
};

module.exports = { createProduct, getProducts };