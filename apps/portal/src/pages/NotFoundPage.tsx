import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1D4ED8]">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The requested page does not exist in the Mobileum Sales Demo Portal.
        </p>
        <Button asChild className="mt-7">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Return to Home
          </Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
