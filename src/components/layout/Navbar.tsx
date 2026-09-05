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
import { cn } from '../../utils/cn';

interface NavbarProps {
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenSystemStatus?: () => void;
  onSignIn?: () => void;
}

export function Navbar({ onToggleMobileMenu, onOpenSystemStatus, onSignIn, onToggleSidebar: _onToggleSidebar }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-white dark:bg-[#070b15] border-b border-slate-200 dark:border-slate-800/90 w-full select-none transition-colors duration-150">
      {/* Left Brand Area */}
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <BrandMark />

        {/* Center / Left-Center Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {/* Dashboard (Active Styled Tab) */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all',
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800/90 text-blue-700 dark:text-white border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800/90 text-blue-700 dark:text-white border border-slate-300 dark:border-slate-700 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            Analysis History
          </NavLink>

          <NavLink
            to="/datasets"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800/90 text-blue-700 dark:text-white border border-slate-300 dark:border-slate-700 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            Datasets
          </NavLink>

          <NavLink
            to="/documentation"
            className={({ isActive }) =>
              cn(
                'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800/90 text-blue-700 dark:text-white border border-slate-300 dark:border-slate-700 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )
            }
          >
            Documentation
          </NavLink>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* System Status Pill Dropdown Trigger */}
        <button
          onClick={onOpenSystemStatus}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors shadow-sm"
          title="Inspect System Status"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>System status</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Sign In Button */}
        <button
          type="button"
          onClick={onSignIn}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600/10 dark:bg-cyan-500/10 text-blue-700 dark:text-cyan-300 border border-blue-400/40 dark:border-cyan-500/30 hover:bg-blue-600/20 dark:hover:bg-cyan-500/20 hover:border-blue-500/60 dark:hover:border-cyan-400/50 transition-all duration-150 shadow-sm"
          title="Sign In to SatQuery AI"
        >
          <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
          <span>Sign In</span>
        </button>

        {/* Theme Mode Toggle (Light/Dark) */}
        <ThemeToggle />

        {/* Notifications Popover */}
        <NotificationPopover />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-[11px] font-bold shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            title="User Profile (Stark Visions - Lead Engineer)"
          >
            SV
          </div>
        </div>
      </div>
    </header>
  );
}
