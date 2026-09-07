import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, LogIn, Lock, Mail, Satellite, CheckCircle2, Loader2, ArrowRight, Info,
  Eye, EyeOff, User, UserPlus,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Shared Sub-Components ───────────────────────────────────────────────────

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.94 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#FFFFFF"
        d="M16.67 15.47l.53-3.47h-3.33v-2.25c0-.95.47-1.87 1.96-1.87h1.53V4.92s-1.37-.23-2.69-.23c-2.74 0-4.53 1.66-4.53 4.67v2.64H7.08v3.47h3.07v8.39c.62.1 1.25.15 1.89.15s1.27-.05 1.89-.15v-8.39h2.74z"
      />
    </svg>
  );
}

/** Reusable password input with integrated eye toggle */
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleVisibility,
  error,
  required,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={cn(
          'w-full h-12 pl-11 pr-12 text-sm sm:text-base rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
          error
            ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500'
            : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 focus:border-blue-500 dark:focus:border-cyan-400'
        )}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
      </button>
    </div>
  );
}

/** Password strength helper */
function getPasswordStrength(password: string): { label: string; level: 0 | 1 | 2 | 3; color: string } {
  if (!password) return { label: '', level: 0, color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', level: 1, color: 'bg-red-500' };
  if (score <= 3) return { label: 'Medium', level: 2, color: 'bg-amber-500' };
  return { label: 'Strong', level: 3, color: 'bg-emerald-500' };
}

// ─── Social Button ───────────────────────────────────────────────────────────

function SocialButton({ provider, icon, onClick }: { provider: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Continue with ${provider}`}
      className="relative w-full h-12 flex items-center justify-center px-5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-sm sm:text-[15px] font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 active:scale-[0.99]"
    >
      <span className="absolute left-5 flex items-center justify-center pointer-events-none">
        {icon}
      </span>
      <span>Continue with {provider}</span>
    </button>
  );
}

// ─── OR Divider ──────────────────────────────────────────────────────────────

function OrDivider({ text }: { text: string }) {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
      </div>
      <div className="relative bg-white dark:bg-[#0a0f1e] px-4 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
        {text}
      </div>
    </div>
  );
}

// ─── Inline Field Error ──────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400" role="alert">
      {message}
    </p>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (userData?: { name: string; email: string }) => void;
}

export function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const { t } = useTranslation();
  // View state: signin or signup
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');

  // ─── Sign In state ─────────────────────────────────────────────────
  const [email, setEmail] = useState('engineer@satquery.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);

  // ─── Sign Up state ─────────────────────────────────────────────────
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);
  const [isSignUpSuccess, setIsSignUpSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle Escape key and cleanup on close
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal closes
      setIsSuccess(false);
      setIsLoading(false);
      setSocialNotice(null);
      setIsSignUpSuccess(false);
      setIsSignUpLoading(false);
      setSignUpErrors({});
      setShowSignInPassword(false);
      setShowSignUpPassword(false);
      setShowSignUpConfirm(false);
      // Reset authView to signin for next open
      setAuthView('signin');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dismiss social demo notice after 4.5 seconds
  useEffect(() => {
    if (!socialNotice) return;
    const timer = setTimeout(() => {
      setSocialNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [socialNotice]);

  if (!isOpen) return null;

  // ─── View Switching ────────────────────────────────────────────────

  const switchToSignUp = () => {
    setAuthView('signup');
    setSocialNotice(null);
    setSignUpErrors({});
    setIsSignUpSuccess(false);
  };

  const switchToSignIn = () => {
    setAuthView('signin');
    setSocialNotice(null);
    setSignUpErrors({});
  };

  // ─── Social Demo Handler ───────────────────────────────────────────

  const handleSocialAction = (provider: 'Google' | 'Facebook') => {
    const action = authView === 'signin' ? 'sign-in' : 'sign-up';
    setSocialNotice(`${provider} ${action} is currently available in demo mode.`);
  };

  // ─── Sign In Submit ────────────────────────────────────────────────

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    }, 800);
  };

  // ─── Sign Up Validation ────────────────────────────────────────────

  const validateSignUp = (): boolean => {
    const errors: Record<string, string> = {};

    if (!signUpName.trim()) {
      errors.name = 'Full name is required.';
    }

    if (!signUpEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpEmail.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!signUpPassword) {
      errors.password = 'Password is required.';
    } else if (signUpPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (!signUpConfirm) {
      errors.confirm = 'Please confirm your password.';
    } else if (signUpConfirm !== signUpPassword) {
      errors.confirm = 'Passwords do not match.';
    }

    if (!agreedToTerms) {
      errors.terms = 'You must agree to the Terms and Privacy Policy.';
    }

    setSignUpErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Sign Up Submit ────────────────────────────────────────────────

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;

    setIsSignUpLoading(true);

    setTimeout(() => {
      setIsSignUpLoading(false);
      setIsSignUpSuccess(true);

      // Call the existing AppShell onSuccess with the demo user data
      onSuccess?.({ name: signUpName.trim(), email: signUpEmail.trim() });

      setTimeout(() => {
        onClose();
      }, 1200);
    }, 600);
  };

  // ─── Handle Terms/Privacy demo link clicks ─────────────────────────

  const handleDemoLink = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    setSocialNotice(`${label} page coming soon.`);
  };

  // ─── Password Strength ─────────────────────────────────────────────
  const strength = getPasswordStrength(signUpPassword);

  // ─── Render ────────────────────────────────────────────────────────

  const isSignIn = authView === 'signin';
  const showSuccessState = isSignIn ? isSuccess : isSignUpSuccess;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-950/40 overflow-hidden animate-in fade-in zoom-in-[0.98] duration-150 text-slate-900 dark:text-slate-100"
      >
        {/* ────── Header ────── */}
        <div className="flex items-center justify-between px-7 py-5 sm:px-8 sm:py-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0',
              isSignIn
                ? 'bg-blue-600/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border-blue-400/30 dark:border-cyan-500/30'
                : 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/30 dark:border-emerald-500/30'
            )}>
              {isSignIn ? <Satellite className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isSignIn ? t('auth.signIn') : t('auth.signUp')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isSignIn ? 'Space Intelligence Workspace' : 'Create your SatQuery AI account to get started.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ────── Body ────── */}
        <div className="p-7 sm:p-8 overflow-y-auto">
          {/* ─── Success State (shared) ─── */}
          {showSuccessState ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isSignIn ? 'Welcome back, Engineer!' : 'Account created successfully!'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isSignIn
                  ? 'Workspace credentials verified. Loading session...'
                  : 'Your SatQuery AI account is ready. Loading dashboard...'}
              </p>
            </div>
          ) : isSignIn ? (
            /* ════════════════════════════════════════════════════════════
               SIGN IN VIEW
               ════════════════════════════════════════════════════════════ */
            <div className="space-y-6">
              {/* Social Login Options */}
              <div className="space-y-3">
                <SocialButton provider="Google" icon={<GoogleIcon />} onClick={() => handleSocialAction('Google')} />
                <SocialButton provider="Facebook" icon={<FacebookIcon />} onClick={() => handleSocialAction('Facebook')} />
              </div>

              {/* Demo Mode Notice */}
              {socialNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between p-3 rounded-xl text-sm bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-400 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4.5 h-4.5 shrink-0 text-blue-500 dark:text-cyan-400" />
                    <span className="font-medium text-xs sm:text-sm">{socialNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialNotice(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-blue-500/10 transition-colors ml-2"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <OrDivider text="OR CONTINUE WITH EMAIL" />

              {/* Existing Email & Password Form */}
              <form onSubmit={handleSignInSubmit} className="space-y-5">
                <div>
                  <label htmlFor="signin-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-12 pl-11 pr-4 text-sm sm:text-base rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                      placeholder="name@organization.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signin-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Password
                  </label>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter password"
                    showPassword={showSignInPassword}
                    onToggleVisibility={() => setShowSignInPassword((p) => !p)}
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm">{t('auth.rememberMe')}</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => e.preventDefault()}
                    className="text-xs sm:text-sm font-medium text-blue-600 dark:text-cyan-400 hover:underline hover:text-blue-500 dark:hover:text-cyan-300 transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full h-12 flex items-center justify-center gap-2.5 px-5 rounded-xl text-sm sm:text-base font-semibold shadow-lg transition-all mt-2',
                    'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-600/25 dark:shadow-cyan-900/20',
                    isLoading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>{t('auth.signIn')}</span>
                      <ArrowRight className="w-5 h-5 ml-auto" />
                    </>
                  )}
                </button>
              </form>

              {/* Create Account Link */}
              <div className="text-center pt-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Don't have an account?{' '}
                </span>
                <button
                  type="button"
                  onClick={switchToSignUp}
                  className="text-sm font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-500 dark:hover:text-cyan-300 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 rounded"
                >
                  Create account
                </button>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════════
               SIGN UP VIEW
               ════════════════════════════════════════════════════════════ */
            <div className="space-y-6">
              {/* Social Sign-Up Options */}
              <div className="space-y-3">
                <SocialButton provider="Google" icon={<GoogleIcon />} onClick={() => handleSocialAction('Google')} />
                <SocialButton provider="Facebook" icon={<FacebookIcon />} onClick={() => handleSocialAction('Facebook')} />
              </div>

              {/* Demo Mode Notice */}
              {socialNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between p-3 rounded-xl text-sm bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-400 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4.5 h-4.5 shrink-0 text-blue-500 dark:text-cyan-400" />
                    <span className="font-medium text-xs sm:text-sm">{socialNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialNotice(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-blue-500/10 transition-colors ml-2"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <OrDivider text="OR CREATE AN ACCOUNT WITH EMAIL" />

              {/* Sign Up Form */}
              <form onSubmit={handleSignUpSubmit} className="space-y-5" noValidate>
                {/* Full Name */}
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth.fullName')}
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-name"
                      type="text"
                      value={signUpName}
                      onChange={(e) => {
                        setSignUpName(e.target.value);
                        if (signUpErrors.name) setSignUpErrors((p) => ({ ...p, name: '' }));
                      }}
                      className={cn(
                        'w-full h-12 pl-11 pr-4 text-sm sm:text-base rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                        signUpErrors.name
                          ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 focus:border-blue-500 dark:focus:border-cyan-400'
                      )}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <FieldError message={signUpErrors.name} />
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => {
                        setSignUpEmail(e.target.value);
                        if (signUpErrors.email) setSignUpErrors((p) => ({ ...p, email: '' }));
                      }}
                      className={cn(
                        'w-full h-12 pl-11 pr-4 text-sm sm:text-base rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                        signUpErrors.email
                          ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40 focus:border-blue-500 dark:focus:border-cyan-400'
                      )}
                      placeholder="you@example.com"
                    />
                  </div>
                  <FieldError message={signUpErrors.email} />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth.password')}
                  </label>
                  <PasswordInput
                    id="signup-password"
                    value={signUpPassword}
                    onChange={(val) => {
                      setSignUpPassword(val);
                      if (signUpErrors.password) setSignUpErrors((p) => ({ ...p, password: '' }));
                    }}
                    placeholder="Minimum 8 characters"
                    showPassword={showSignUpPassword}
                    onToggleVisibility={() => setShowSignUpPassword((p) => !p)}
                    error={signUpErrors.password}
                  />
                  <FieldError message={signUpErrors.password} />

                  {/* Password Strength Indicator */}
                  {signUpPassword.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-all duration-300',
                              strength.level >= level
                                ? strength.color
                                : 'bg-slate-200 dark:bg-slate-800'
                            )}
                          />
                        ))}
                      </div>
                      <p className={cn(
                        'text-[11px] font-medium',
                        strength.level === 1 && 'text-red-500 dark:text-red-400',
                        strength.level === 2 && 'text-amber-500 dark:text-amber-400',
                        strength.level === 3 && 'text-emerald-500 dark:text-emerald-400',
                      )}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth.confirmPassword')}
                  </label>
                  <PasswordInput
                    id="signup-confirm"
                    value={signUpConfirm}
                    onChange={(val) => {
                      setSignUpConfirm(val);
                      if (signUpErrors.confirm) setSignUpErrors((p) => ({ ...p, confirm: '' }));
                    }}
                    placeholder="Re-enter your password"
                    showPassword={showSignUpConfirm}
                    onToggleVisibility={() => setShowSignUpConfirm((p) => !p)}
                    error={signUpErrors.confirm}
                  />
                  <FieldError message={signUpErrors.confirm} />
                </div>

                {/* Terms & Privacy */}
                <div>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => {
                        setAgreedToTerms(e.target.checked);
                        if (signUpErrors.terms) setSignUpErrors((p) => ({ ...p, terms: '' }));
                      }}
                      className={cn(
                        'w-4 h-4 rounded mt-0.5 cursor-pointer focus:ring-0',
                        signUpErrors.terms
                          ? 'border-red-400 dark:border-red-500'
                          : 'border-slate-300 dark:border-slate-700 text-blue-600'
                      )}
                    />
                    <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      I agree to the{' '}
                      <a
                        href="#terms"
                        onClick={(e) => handleDemoLink(e, 'Terms of Service')}
                        className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline hover:text-blue-500 dark:hover:text-cyan-300 transition-colors"
                      >
                        Terms
                      </a>
                      {' '}and{' '}
                      <a
                        href="#privacy"
                        onClick={(e) => handleDemoLink(e, 'Privacy Policy')}
                        className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline hover:text-blue-500 dark:hover:text-cyan-300 transition-colors"
                      >
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  <FieldError message={signUpErrors.terms} />
                </div>

                {/* Create Account Button */}
                <button
                  type="submit"
                  disabled={isSignUpLoading}
                  className={cn(
                    'w-full h-12 flex items-center justify-center gap-2.5 px-5 rounded-xl text-sm sm:text-base font-semibold shadow-lg transition-all mt-2',
                    'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-600/25 dark:shadow-cyan-900/20',
                    isSignUpLoading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isSignUpLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating account…</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Create Account</span>
                      <ArrowRight className="w-5 h-5 ml-auto" />
                    </>
                  )}
                </button>
              </form>

              {/* Return to Sign In */}
              <div className="text-center pt-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Already have an account?{' '}
                </span>
                <button
                  type="button"
                  onClick={switchToSignIn}
                  className="text-sm font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-500 dark:hover:text-cyan-300 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 rounded"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ────── Footer ────── */}
        <div className="px-7 py-4 sm:px-8 sm:py-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 text-center shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isSignIn
              ? 'Protected by multimodal remote-sensing authorization tokens.'
              : 'By creating an account, you agree to our Terms and Privacy Policy.'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
