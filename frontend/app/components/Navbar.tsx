'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link href="/products" className="font-semibold text-slate-800 text-sm">
        Order Allocation System
      </Link>

      {/* hide all nav links on login/signup pages */}
      {!isAuthPage && (
        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Products
          </Link>
          {isLoggedIn && (
            <Link
              href="/orders"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              My Orders
            </Link>
          )}
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}