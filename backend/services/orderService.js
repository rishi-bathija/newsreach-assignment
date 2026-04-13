const db = require('../db');

const createOrder = async ({ user_id, items }) => {
  if (!items || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  // get a client from pool for transaction
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    let totalPrice = 0;
    const lockedProducts = [];

    // lock each product row for update — prevents concurrent overselling
    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        throw new Error('Each item needs a valid product_id and quantity');
      }

      // SELECT FOR UPDATE locks the row until transaction ends
      const result = await client.query(
        `SELECT id, name, price, stock
         FROM products
         WHERE id = $1 AND is_deleted = FALSE
         FOR UPDATE`,
        [product_id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product ${product_id} not found`);
      }

      const product = result.rows[0];

      if (product.stock < quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${quantity}`
        );
      }

      totalPrice += parseFloat(product.price) * quantity;
      lockedProducts.push({ product, quantity });
    }

    // create the order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_price, status)
       VALUES ($1, $2, 'COMPLETED')
       RETURNING id, user_id, total_price, status, created_at`,
      [user_id, totalPrice.toFixed(2)]
    );

    const order = orderResult.rows[0];

    // insert order items + decrement stock
    for (const { product, quantity } of lockedProducts) {
      // insert order item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, product.id, quantity, product.price]
      );

      // decrement stock
      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [quantity, product.id]
      );
    }

    await client.query('COMMIT');

    return { order, items: lockedProducts.map(({ product, quantity }) => ({
      product_id: product.id,
      name: product.name,
      quantity,
      unit_price: product.price,
    }))};

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always release client back to pool
  }
};

const cancelOrder = async ({ order_id, user_id }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // lock the order row
    const orderResult = await client.query(
      `SELECT id, user_id, status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    // verify ownership
    if (order.user_id !== user_id) {
      throw new Error('Unauthorized — this is not your order');
    }

    // prevent double cancellation
    if (order.status === 'CANCELLED') {
      throw new Error('Order is already cancelled');
    }

    if (order.status !== 'COMPLETED') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    // get order items to restore stock
    const itemsResult = await client.query(
      `SELECT product_id, quantity
       FROM order_items
       WHERE order_id = $1`,
      [order_id]
    );

    // restore stock for each item
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products
         SET stock = stock + $1
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // update order status
    await client.query(
      `UPDATE orders
       SET status = 'CANCELLED'
       WHERE id = $1`,
      [order_id]
    );

    await client.query('COMMIT');

    return { message: 'Order cancelled and stock restored', order_id };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getOrders = async ({ user_id, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  // get total count — efficient, not fetch-all
  const countResult = await db.query(
    `SELECT COUNT(*) FROM orders WHERE user_id = $1`,
    [user_id]
  );
  const total = parseInt(countResult.rows[0].count);

  // get paginated orders with items
  const ordersResult = await db.query(
    `SELECT
       o.id,
       o.total_price,
       o.status,
       o.created_at,
       json_agg(
         json_build_object(
           'product_id', oi.product_id,
           'product_name', p.name,
           'quantity', oi.quantity,
           'unit_price', oi.unit_price
         )
       ) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT $2 OFFSET $3`,
    [user_id, limit, offset]
  );

  return {
    orders: ordersResult.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = { createOrder, cancelOrder, getOrders };