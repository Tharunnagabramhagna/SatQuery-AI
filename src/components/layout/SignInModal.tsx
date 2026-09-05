import { useState, useEffect, useRef } from 'react';
import { X, LogIn, Lock, Mail, Satellite, CheckCircle2, Loader2, ArrowRight, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

function FacebookIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('engineer@satquery.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setIsLoading(false);
      setSocialNotice(null);
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

  useEffect(() => {
    if (!socialNotice) return;
    const timer = setTimeout(() => {
      setSocialNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [socialNotice]);

  if (!isOpen) return null;

  const handleSocialSignIn = (provider: 'Google' | 'Facebook') => {
    setSocialNotice(`${provider} sign-in is available in demo mode.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-150 text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-400/30 dark:border-cyan-500/30 flex items-center justify-center">
              <Satellite className="w-4 h-4" />
            </div>
            <div>
              <h2 id="sign-in-modal-title" className="text-sm font-bold tracking-tight">
                Sign In to SatQuery AI
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Space Intelligence Workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {isSuccess ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Welcome back, Engineer!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Workspace credentials verified. Loading session...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Social Login Options */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleSocialSignIn('Google')}
                  aria-label="Continue with Google"
                  className="relative w-full h-11 flex items-center justify-center px-4 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 active:scale-[0.99]"
                >
                  <span className="absolute left-4 flex items-center justify-center pointer-events-none">
                    <GoogleIcon className="w-[18px] h-[18px]" />
                  </span>
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialSignIn('Facebook')}
                  aria-label="Continue with Facebook"
                  className="relative w-full h-11 flex items-center justify-center px-4 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 active:scale-[0.99]"
                >
                  <span className="absolute left-4 flex items-center justify-center pointer-events-none">
                    <FacebookIcon className="w-[18px] h-[18px]" />
                  </span>
                  <span>Continue with Facebook</span>
                </button>
              </div>

              {/* Demo Mode Notice */}
              {socialNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-between p-2.5 rounded-lg text-xs bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-400 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-blue-500 dark:text-cyan-400" />
                    <span className="font-medium">{socialNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSocialNotice(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-blue-500/10 transition-colors"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative bg-white dark:bg-[#0a0f1e] px-3 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                  OR CONTINUE WITH EMAIL
                </div>
              </div>

              {/* Existing Email & Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-400 focus:border-blue-500 dark:focus:border-cyan-400"
                      placeholder="name@organization.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-400 focus:border-blue-500 dark:focus:border-cyan-400"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span>Remember session</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => e.preventDefault()}
                    className="text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold shadow-md transition-all mt-2',
                    'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20',
                    isLoading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 text-center shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Protected by multimodal remote-sensing authorization tokens.
          </p>
        </div>
      </div>
    </div>
  );
}

