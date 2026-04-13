'use client';
import { useState, useEffect } from 'react';
import { Product } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [token, setToken] = useState('');
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [ordering, setOrdering] = useState<number | null>(null);
    const [orderMsg, setOrderMsg] = useState('');
    const [orderError, setOrderError] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('token');
        if (stored) setToken(stored);
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/products');
            setProducts(data.products);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOrder = async (productId: number) => {
        if (!token) {
            setOrderError('You must be logged in to place an order');
            return;
        }
        const quantity = quantities[productId] || 1;
        setOrdering(productId);
        setOrderMsg('');
        setOrderError('');
        try {
            await apiFetch(
                '/orders',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        items: [{ product_id: productId, quantity }],
                    }),
                },
                token
            );
            setOrderMsg(`Order placed successfully!`);
            fetchProducts(); // refresh stock
        } catch (err: any) {
            setOrderError(err.message);
        } finally {
            setOrdering(null);
        }
    };

    if (loading) return (
        <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 animate-pulse bg-gray-100 h-40" />
                ))}
            </div>
        </div>
    );

    if (error) return (
        <div className="p-6 text-red-500">Error: {error}</div>
    );

    return (
        <div className="max-w-5xl mx-auto p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Products</h1>
                <a href="/orders" className="text-sm text-blue-500 hover:underline">
                    My Orders →
                </a>
            </div>

            {orderMsg && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                    {orderMsg}
                </div>
            )}
            {orderError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {orderError}
                </div>
            )}
            {!token && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm flex items-center justify-between">
                    <span>You need to be logged in to place orders.</span>
                    <a href="/login" className="font-medium underline ml-2">
                        Login →
                    </a>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col gap-3"
                    >
                        <div>
                            <h2 className="font-semibold text-slate-800">{product.name}</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                ₹{Number(product.price).toLocaleString()}
                            </p>
                            <p className={`text-xs mt-1 font-medium ${product.stock === 0 ? 'text-red-500' : 'text-green-600'
                                }`}>
                                {product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 mt-auto">
                            <input
                                type="number"
                                min={1}
                                max={product.stock}
                                value={quantities[product.id] || 1}
                                onChange={(e) =>
                                    setQuantities((q) => ({
                                        ...q,
                                        [product.id]: parseInt(e.target.value) || 1,
                                    }))
                                }
                                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-800"
                                disabled={product.stock === 0}
                            />
                            <button
                                onClick={() => handleOrder(product.id)}
                                disabled={product.stock === 0 || ordering === product.id}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                            >
                                {ordering === product.id ? 'Placing...' : 'Order'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
