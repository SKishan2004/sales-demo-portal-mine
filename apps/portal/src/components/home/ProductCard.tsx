import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, Star } from 'lucide-react';
import type { ProductSummaryDTO } from '@mobileum/shared';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: ProductSummaryDTO;
  index?: number;
  variant?: 'default' | 'featured';
}

export function ProductCard({
  product,
  index = 0,
  variant = 'default',
}: ProductCardProps) {
  const isFeaturedCard = variant === 'featured';

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.05, 0.25),
        ease: 'easeOut',
      }}
      whileHover={{ y: -3 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-[#93C5FD]"
    >
      <Link
        to={`/products/${product.slug}`}
        className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      >
        {/* 16:9 Thumbnail Stage */}
        <div className="relative aspect-video w-full overflow-hidden border-b border-slate-200 bg-[#F4F8FF]">
          {product.thumbnailPath ? (
            <img
              src={product.thumbnailPath}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.025]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              Preview available inside product view
            </div>
          )}

          {product.featured && (
            <div className="absolute left-3.5 top-3.5">
              <Badge variant="default" className="bg-white/95">
                <Star className="h-3 w-3 fill-[#1D4ED8] text-[#1D4ED8]" />
                Featured
              </Badge>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="flex flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="text-[11px]">
              {product.categoryName}
            </Badge>
            <span className="text-[11px] font-medium text-slate-500">
              {product.productTypeName}
            </span>
          </div>

          <h3
            className={`mt-3 font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-[#1D4ED8] ${
              isFeaturedCard ? 'text-xl' : 'text-lg'
            }`}
          >
            {product.name}
          </h3>

          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
            {product.shortDescription}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-medium text-[#1D4ED8]">
            <span>{isFeaturedCard ? 'Explore Product' : 'View Details'}</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-[#F8FAFC] text-[#1D4ED8] transition-colors duration-200 group-hover:border-[#BFDBFE] group-hover:bg-[#EFF6FF]">
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-video w-full animate-pulse bg-slate-100" />
      <div className="space-y-3 p-6">
        <div className="flex gap-2">
          <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-6 w-3/4 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
