import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  ChevronDown,
  LayoutDashboard,
  LogIn,
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { NotificationPopover } from './NotificationPopover';
import { ProfileDropdown } from './ProfileDropdown';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../i18n';

interface NavbarProps {
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenSystemStatus?: () => void;
  onSignIn?: () => void;
  isSignedIn?: boolean;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function Navbar({
  onToggleMobileMenu,
  onOpenSystemStatus,
  onSignIn,
  isSignedIn = true,
  onSignOut,
  onToggleSidebar: _onToggleSidebar,
  userName,
  userEmail,
  userAvatar,
}: NavbarProps) {
  const { t } = useTranslation();
  const [activePopover, setActivePopover] = useState<'notifications' | 'profile' | null>(null);

  const handleToggleNotifications = () => {
    setActivePopover((prev) => (prev === 'notifications' ? null : 'notifications'));
  };

  const handleToggleProfile = () => {
    setActivePopover((prev) => (prev === 'profile' ? null : 'profile'));
  };

  const handleClosePopovers = () => {
    setActivePopover(null);
  };
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-white/75 dark:bg-[#070b15]/55 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/70 dark:border-white/[0.07] shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.16)] w-full select-none transition-colors duration-150">
      {/* Left Brand Area */}
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <BrandMark />
        </div>

        {/* Center / Left-Center Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {/* Dashboard (Active Styled Tab) */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all',
                isActive
                  ? 'bg-white/10 dark:bg-white/[0.06] text-blue-700 dark:text-white border border-slate-300/50 dark:border-white/[0.08] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.10)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{t('nav.dashboard')}</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-white/10 dark:bg-white/[0.06] text-blue-700 dark:text-white border border-slate-300/50 dark:border-white/[0.08] backdrop-blur-md font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            {t('nav.history')}
          </NavLink>

          <NavLink
            to="/datasets"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-white/10 dark:bg-white/[0.06] text-blue-700 dark:text-white border border-slate-300/50 dark:border-white/[0.08] backdrop-blur-md font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            {t('nav.datasets')}
          </NavLink>

          <NavLink
            to="/documentation"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-white/10 dark:bg-white/[0.06] text-blue-700 dark:text-white border border-slate-300/50 dark:border-white/[0.08] backdrop-blur-md font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            {t('nav.documentation')}
          </NavLink>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* System Status Pill Dropdown Trigger */}
        <button
          onClick={onOpenSystemStatus}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 dark:bg-white/[0.045] backdrop-blur-md border border-slate-200/60 dark:border-white/[0.07] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          title={t('nav.systemStatus')}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{t('nav.systemStatus')}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Sign In Button */}
        <button
          type="button"
          onClick={onSignIn}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600/10 dark:bg-cyan-500/10 text-blue-700 dark:text-cyan-300 border border-blue-400/25 dark:border-cyan-500/25 backdrop-blur-md hover:bg-blue-600/15 dark:hover:bg-cyan-500/20 hover:border-blue-500/60 dark:hover:border-cyan-400/50 transition-all duration-150 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          title={t('nav.signIn')}
        >
          <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
          <span>{t('nav.signIn')}</span>
        </button>

        {/* Theme Mode Toggle (Light/Dark) */}
        <ThemeToggle />

        {/* Notifications Popover */}
        <NotificationPopover
          isOpen={activePopover === 'notifications'}
          onToggle={handleToggleNotifications}
          onClose={handleClosePopovers}
        />

        {/* User Profile Avatar / Dropdown */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200/60 dark:border-white/[0.06]">
          <ProfileDropdown
            isOpen={activePopover === 'profile'}
            onToggle={handleToggleProfile}
            onClose={handleClosePopovers}
            isSignedIn={isSignedIn}
            onSignIn={onSignIn || (() => { })}
            onSignOut={onSignOut || (() => { })}
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
          />
        </div>
      </div>
    </header>
  );
}
