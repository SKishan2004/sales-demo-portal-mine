import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Grid2X2, LayoutGrid, Star } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';

const PORTAL_AREAS = [
  {
    title: 'Featured Products',
    description:
      'Explore highlighted Mobileum platforms and flagship demonstrations curated for client presentations.',
    to: '/featured',
    cta: 'View Featured',
    icon: Star,
  },
  {
    title: 'Solution Categories',
    description:
      'Navigate products organized by domain including Network & Roaming, Voice, Analytics, and AI.',
    to: '/categories',
    cta: 'Browse Categories',
    icon: Grid2X2,
  },
  {
    title: 'All Products',
    description:
      'Search, filter, and open interactive showcases with dashboards, features, use cases, and demo videos.',
    to: '/products',
    cta: 'Explore Catalogue',
    icon: LayoutGrid,
  },
];

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />

      <main className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#EAF2FF] via-[#F4F8FF] to-[#F8FAFC]">
        {/* Light-blue architectural orbital backdrop (matte, calm, airy) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            viewBox="0 0 1440 780"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full opacity-90"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="skyWash" cx="50%" cy="32%" r="58%">
                <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.45" />
                <stop offset="55%" stopColor="#DBEAFE" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="arcStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            <rect width="1440" height="780" fill="url(#skyWash)" />

            {/* Subtle architectural grid lines */}
            <line x1="0" y1="180" x2="1440" y2="180" stroke="#CBD5E1" strokeOpacity="0.35" />
            <line x1="0" y1="420" x2="1440" y2="420" stroke="#CBD5E1" strokeOpacity="0.3" />
            <line x1="240" y1="0" x2="240" y2="780" stroke="#CBD5E1" strokeOpacity="0.25" />
            <line x1="1200" y1="0" x2="1200" y2="780" stroke="#CBD5E1" strokeOpacity="0.25" />

            {/* Large swept orbital arcs inspired by the reference composition */}
            <circle
              cx="790"
              cy="310"
              r="340"
              stroke="url(#arcStroke)"
              strokeWidth="1.5"
            />
            <circle
              cx="790"
              cy="310"
              r="245"
              stroke="#93C5FD"
              strokeOpacity="0.42"
              strokeWidth="1.2"
              strokeDasharray="6 8"
            />
            <path
              d="M -60 520 C 310 120, 880 60, 1500 320"
              stroke="#93C5FD"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
            <path
              d="M -40 590 C 340 200, 900 130, 1510 390"
              stroke="#BFDBFE"
              strokeOpacity="0.7"
              strokeWidth="1.2"
            />
          </svg>
        </div>

        {/* Centered Welcoming Hero */}
        <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 pt-16 pb-12 text-center sm:px-8 sm:pt-24 sm:pb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-white/85 px-4 py-1.5 text-xs font-medium tracking-wide text-[#1D4ED8]"
          >
            Welcome to Mobileum Sales Demo Portal
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: 'easeOut' }}
            className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.1]"
          >
            Explore Innovation. Experience Mobileum.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: 'easeOut' }}
            className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            Discover Mobileum&apos;s software solutions, interactive product
            presentations, and capabilities powering next-generation digital and
            telecom ecosystems.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Button asChild size="lg">
              <Link to="/products">
                Explore Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/categories">Browse Categories</Link>
            </Button>
          </motion.div>
        </section>

        {/* Bottom 3-Card Navigation Strip */}
        <section
          aria-label="Portal sections"
          className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8 sm:pb-16"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {PORTAL_AREAS.map((area, idx) => {
              const Icon = area.icon;
              return (
                <motion.div
                  key={area.to}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.18 + idx * 0.07 }}
                >
                  <Link
                    to={area.to}
                    className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-6 transition-colors duration-200 hover:border-[#93C5FD] hover:bg-[#F8FBFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                  >
                    <div>
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {area.title}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {area.description}
                      </p>
                    </div>

                    <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8]">
                      <span>{area.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
