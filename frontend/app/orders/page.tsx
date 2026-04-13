'use client';
import { useState, useEffect } from 'react';
import { Order, Pagination } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [cancelMsg, setCancelMsg] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) fetchOrders();
  }, [token, page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch(
        `/orders?page=${page}&limit=5`,
        {},
        token
      );
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    setCancelling(orderId);
    setCancelMsg('');
    try {
      await apiFetch(
        `/orders/${orderId}/cancel`,
        { method: 'PATCH' },
        token
      );
      setCancelMsg('Order cancelled successfully');
      fetchOrders();
    } catch (err: any) {
      setCancelMsg(err.message);
    } finally {
      setCancelling(null);
    }
  };

  if (!token) return (
    <div className="p-6 text-slate-500">
      Please log in to view your orders.
    </div>
  );

  if (loading) return (
    <div className="p-6 text-slate-500">Loading orders...</div>
  );

  if (error) return (
    <div className="p-6 text-red-500">Error: {error}</div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Orders</h1>
        <a href="/products" className="text-sm text-blue-500 hover:underline">
          ← Back to Products
        </a>
      </div>

      {cancelMsg && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
          {cancelMsg}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          No orders yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    Order #{order.id}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    order.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : order.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.status}
                  </span>
                  {order.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      {cancelling === order.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="text-slate-500">
                      ₹{(Number(item.unit_price) * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="text-sm font-semibold text-slate-800">
                  ₹{Number(order.total_price).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === pagination.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
