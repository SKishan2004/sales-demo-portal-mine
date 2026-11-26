import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react';
import { loginSchema } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { MobileumBrand } from '@/components/MobileumBrand';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

const REMEMBERED_IDENTIFIER_KEY = 'mobileum_admin_remembered_identifier';

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession, enterUiPreview } = useAuth();

  const [identifier, setIdentifier] = useState<string>(() => {
    try {
      return localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(REMEMBERED_IDENTIFIER_KEY));
    } catch {
      return false;
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        identifier: flat.identifier?.[0],
        password: flat.password?.[0],
      });
      return;
    }

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, parsed.data.identifier);
      } else {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      }
    } catch {
      // Ignore storage errors
    }

    setIsSubmitting(true);
    try {
      const result = await adminApi.login({
        identifier: parsed.data.identifier,
        password: parsed.data.password,
        rememberMe,
      });

      if (!result.ok) {
        setAuthError(
          result.error ??
            'Unable to verify credentials. Please check your email/username and password.',
        );
        return;
      }

      await refreshSession();
      navigate('/dashboard', { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenUiReview = () => {
    enterUiPreview('super_admin');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-b from-[#EAF2FF] via-[#F4F8FF] to-[#F8FAFC] text-slate-900">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-7">
        <MobileumBrand size="md" />
        <span className="hidden items-center gap-2 rounded-full border border-[#BFDBFE] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1D4ED8] sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          Authorized Access
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full rounded-2xl border border-slate-200 bg-white p-7 sm:p-8"
        >
          <div className="mb-7 space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="pt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Administrator Sign In
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Sign in with your Mobileum Sales Demo Portal administrator account
              to manage products, categories, and media.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="admin-identifier"
                className="block text-xs font-medium text-slate-700"
              >
                Email or Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="name@mobileum.com or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10"
                  aria-invalid={Boolean(fieldErrors.identifier)}
                />
              </div>
              {fieldErrors.identifier && (
                <p className="text-xs text-rose-600">{fieldErrors.identifier}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-medium text-[#1D4ED8] transition-colors hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-11"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-rose-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#2563EB]"
                />
                Remember my username on this device
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
                Phase 3 UI Inspection (Dev Only — No Backend Session):
              </p>
              <Button
                type="button"
                variant="secondary"
                size="default"
                onClick={handleOpenUiReview}
                className="w-full"
              >
                <LayoutDashboard className="h-4 w-4" />
                Inspect Admin CMS Interface
              </Button>
            </div>
          )}
        </motion.section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-6 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} Mobileum. All rights reserved.</span>
        <a
          href="/sales-demo/"
          className="font-medium text-[#1D4ED8] transition-colors hover:underline"
        >
          Go to Sales Demo Portal
        </a>
      </footer>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogTitle>Administrator Password Reset</DialogTitle>
          <DialogDescription>
            Administrator password resets are managed by a Super Admin through
            the Admin Management console or the internal VM bootstrap procedure.
            Contact your Portal Super Admin to request a password reset.
          </DialogDescription>
          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={() => setForgotOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
