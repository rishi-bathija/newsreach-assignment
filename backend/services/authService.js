const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const signup = async ({ name, email, password }) => {
  // check if email already exists
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );
  if (existing.rows.length > 0) {
    throw new Error('Email already registered');
  }

  const hashed = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, hashed]
  );

  return result.rows[0];
};

const login = async ({ email, password }) => {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new Error('Invalid email or password');
  }

  const token = jwt.sign(
    { user_id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { token };
};

module.exports = { signup, login };