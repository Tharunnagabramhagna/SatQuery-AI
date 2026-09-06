import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  LogOut,
  LogIn,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { ProfileModal } from './ProfileModal';

interface ProfileDropdownProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function ProfileDropdown({
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  onClose: externalOnClose,
  isSignedIn,
  onSignIn,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
}: ProfileDropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const displayName = userName || 'Stark Visions';
  const displayEmail = userEmail || 'engineer@satquery.ai';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'SV';

  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;

  const toggleDropdown = () => {
    if (isControlled) {
      externalOnToggle?.();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const closeDropdown = () => {
    if (isControlled) {
      externalOnClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  // Click outside and Escape key handler for the dropdown popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isControlled]);

  const handleOpenProfile = () => {
    closeDropdown();
    setIsProfileModalOpen(true);
  };

  const handleOpenSettings = () => {
    closeDropdown();
    navigate('/settings');
  };

  const handleSignOutClick = () => {
    closeDropdown();
    onSignOut();
  };

  const handleSignInClick = () => {
    closeDropdown();
    onSignIn();
  };

  return (
    <>
      <div ref={dropdownRef} className="relative inline-block text-left">
        {/* Interactive Avatar Button */}
        <button
          type="button"
          onClick={toggleDropdown}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Open user profile menu"
          className={cn(
            'w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-[11px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-cyan-400/70 cursor-pointer overflow-hidden',
            isOpen ? 'ring-2 ring-blue-500 dark:ring-cyan-400 shadow-md' : 'hover:ring-2 hover:ring-blue-500'
          )}
          title={`User Profile (${displayName} - Lead Engineer)`}
        >
          {userAvatar ? (
            <img src={userAvatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </button>

        {/* Anchored Profile Dropdown Popover */}
        {isOpen && (
          <div
            role="menu"
            aria-label="User Profile Menu"
            className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800/90 shadow-2xl shadow-slate-900/15 dark:shadow-cyan-950/20 z-50 overflow-hidden animate-in fade-in zoom-in-[0.98] duration-100 select-none text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-[11px] font-bold shadow-sm shrink-0 overflow-hidden">
                  {userAvatar ? (
                    <img src={userAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-cyan-400 font-medium truncate">
                    Lead Engineer
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    {displayEmail}
                  </div>
                </div>
              </div>
              {!isSignedIn && (
                <div className="mt-2 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-center">
                  Demo session signed out
                </div>
              )}
            </div>

            {/* Menu Options */}
            <div className="p-1 space-y-0.5 text-xs">
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenProfile}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-colors text-left focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Profile</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenSettings}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 transition-colors text-left focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Account Settings</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              {isSignedIn ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOutClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition-colors text-left focus:outline-none focus:bg-rose-50 dark:focus:bg-rose-950/30"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignInClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-cyan-400 transition-colors text-left focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30"
                >
                  <LogIn className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User-Focused Profile Information Modal with Functional Subviews */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        userName={displayName}
        userEmail={displayEmail}
        userAvatar={userAvatar}
      />
    </>
  );
}
