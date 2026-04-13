# Order Allocation System

A mini order allocation system built with Node.js, PostgreSQL, and Next.js. Supports product management, order creation with concurrency control, order cancellation, and JWT authentication.

## Tech Stack

- **Backend:** Node.js, Express.js, PostgreSQL (raw SQL)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Auth:** JWT, bcrypt
- **Database:** PostgreSQL (hosted on Neon)

## Setup Instructions

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon or local)

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:


DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
PORT=5000

Start the server:

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` folder:


NEXT_PUBLIC_API_URL=http://localhost:5000

Start the frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

### Database

Run the schema SQL in your PostgreSQL database (Neon SQL editor or psql):

```bash
psql -d your_db -f backend/db/schema.sql
```

---

## Schema Explanation

### Tables

**users** — stores registered users with hashed passwords.

**products** — stores product catalog with stock count. `stock >= 0` constraint enforced at DB level. `is_deleted` flag supports soft delete.

**orders** — stores each order with total price and status (`PENDING`, `COMPLETED`, `CANCELLED`). Linked to users via `user_id`.

**order_items** — stores individual line items per order. `unit_price` is snapshotted at order time so future price changes don't affect historical orders.

### Relationships

users → orders (one to many)
orders → order_items (one to many)
products → order_items (one to many)

### Constraints

- `products.stock >= 0` — DB-level guard against negative stock
- `products.price > 0` — price must be positive
- `order_items.quantity > 0` — quantity must be positive
- `orders.status CHECK` — only allows PENDING, COMPLETED, CANCELLED
- `users.email UNIQUE` — no duplicate accounts

---

## Concurrency Explanation

### The Problem

Two users simultaneously attempt to purchase the last 5 units of a product. Without protection:

1. User A reads stock = 5, sees sufficient
2. User B reads stock = 5, sees sufficient
3. User A decrements → stock = 0
4. User B decrements → stock = -5 ← oversold

### The Solution — SELECT FOR UPDATE

When creating an order, each product row is locked using `SELECT ... FOR UPDATE` inside a transaction:

```sql
BEGIN;
SELECT id, name, price, stock
FROM products
WHERE id = $1
FOR UPDATE;  -- locks this row
```

This acquires a row-level lock. Any concurrent transaction attempting to read or update the same product row is blocked until the first transaction commits or rolls back.

**Flow:**
1. User A's transaction locks the product row
2. User B's transaction tries to lock the same row — blocked, waits
3. User A checks stock, decrements, commits — lock released
4. User B now reads the updated stock (0), insufficient → rollback

### Isolation Level

PostgreSQL default isolation level (`READ COMMITTED`) combined with `SELECT FOR UPDATE` is sufficient for this use case. The lock ensures the second transaction always sees the committed state after the first completes.

### Transaction Scope

Every order creation is wrapped in a transaction:

BEGIN
→ Lock product rows (FOR UPDATE)
→ Check stock for each item
→ Insert order record
→ Insert order_items records
→ Decrement stock for each product
COMMIT (or ROLLBACK on any failure)

If anything fails at any step — insufficient stock, DB error, network issue — the entire transaction rolls back. No partial orders, no orphaned records, no stock leaks.

---

## Indexing Strategy

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_is_deleted ON products(is_deleted);
```

**Why each index:**

- `idx_orders_user_id` — `GET /orders` filters by `user_id` on every request. Without this index, every paginated orders query does a full table scan.
- `idx_orders_status` — filtering cancelled/completed orders is common. Speeds up status-based queries.
- `idx_order_items_order_id` — every order fetch joins `order_items` on `order_id`. This is the most frequently used join in the system.
- `idx_order_items_product_id` — used during order cancellation to look up items by product for stock restoration.
- `idx_products_is_deleted` — all product listings filter `WHERE is_deleted = FALSE`. Without this, deleted product filtering requires a full scan.

**Note:** `users.email` has an implicit index from the `UNIQUE` constraint. `PRIMARY KEY` columns are also automatically indexed by PostgreSQL.

---

## API Reference

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /auth/signup | Register new user | No |
| POST | /auth/login | Login, returns JWT | No |

### Products
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /products | Create product | No |
| GET | /products | List all products | No |

### Orders
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /orders | Place an order | Yes |
| GET | /orders?page=1&limit=10 | Get paginated orders | Yes |
| PATCH | /orders/:id/cancel | Cancel an order | Yes |

---

## Assumptions Made

- Authentication is simple JWT — no refresh tokens, no OAuth as specified
- Product creation is open (no admin auth) — focus was on order flow
- `user_id` is always extracted from JWT token, never trusted from request body
- Order status starts as `COMPLETED` immediately — no async processing or payment step
- Pagination uses `LIMIT/OFFSET` — suitable for this scale. For very large datasets, cursor-based pagination would be more efficient
- Prices are stored as `NUMERIC(10,2)` to avoid floating point precision issues
- Stock restoration on cancellation happens synchronously in the same transaction

---

## Bonus Features Implemented

- Soft delete for products (`is_deleted` flag)
- Proper error messages for insufficient stock
- Ownership validation on order cancellation (can't cancel another user's order)
- Double cancellation prevention
