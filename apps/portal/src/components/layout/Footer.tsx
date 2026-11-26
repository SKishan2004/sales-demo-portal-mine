import { Link } from 'react-router-dom';
import { MobileumBrand } from '@/components/MobileumBrand';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <MobileumBrand size="sm" />

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600"
        >
          <Link to="/" className="transition-colors hover:text-[#1D4ED8]">
            Home
          </Link>
          <Link to="/featured" className="transition-colors hover:text-[#1D4ED8]">
            Featured
          </Link>
          <Link to="/categories" className="transition-colors hover:text-[#1D4ED8]">
            Categories
          </Link>
          <Link to="/products" className="transition-colors hover:text-[#1D4ED8]">
            Products
          </Link>
        </nav>

        <span className="text-xs text-slate-500">
          © {new Date().getFullYear()} Mobileum. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
