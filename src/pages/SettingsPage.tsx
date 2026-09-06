import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  SunMoon,
  Bell,
  SlidersHorizontal,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Laptop,
  Save,
  RotateCcw,
  AlertCircle,
  Info,
  Camera,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { processAvatarFile } from '../components/layout/ProfileModal';
import {
  getUserProfile,
  updateUserProfile,
  getUserPreferences,
  updateUserPreferences,
  DEFAULT_USER_PREFERENCES,
} from '../services/api';
import type { UserProfile, UserPreferences } from '../types';
import { cn } from '../utils/cn';

// ─── Accessible Switch Component ──────────────────────────────────────────────

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}

function Switch({ id, checked, onChange, disabled = false, ariaLabel }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-cyan-400/50',
        checked ? 'bg-blue-600 dark:bg-cyan-500' : 'bg-slate-200 dark:bg-slate-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ─── Password Strength Helper (consistent with SignInModal) ───────────────────

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

// ─── Settings Tabs Definition ─────────────────────────────────────────────────

type SettingsTab = 'profile' | 'appearance' | 'notifications' | 'analysis' | 'security';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SETTINGS_TABS: TabItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Personal details and demonstration session credentials.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: SunMoon,
    description: 'Theme customization and visual display modes.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Task completion alerts and system notifications.',
  },
  {
    id: 'analysis',
    label: 'Analysis Preferences',
    icon: SlidersHorizontal,
    description: 'Default capabilities, viewer state, and evidence overlays.',
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    description: 'Password verification and demo authentication status.',
  },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { theme, themeMode, setThemeMode } = useTheme();

  // ─── Profile State ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Stark Visions',
    email: 'engineer@satquery.ai',
  });
  const [initialProfile, setInitialProfile] = useState<UserProfile>({
    name: 'Stark Visions',
    email: 'engineer@satquery.ai',
  });
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Preferences State ─────────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [initialPreferences, setInitialPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [notificationsSavedNotice, setNotificationsSavedNotice] = useState(false);
  const [analysisSavedNotice, setAnalysisSavedNotice] = useState(false);

  // ─── Security State ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityErrors, setSecurityErrors] = useState<Record<string, string>>({});
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // ─── Load Initial Profile & Preferences ────────────────────────────────────
  useEffect(() => {
    getUserProfile().then((data) => {
      setProfile(data);
      setInitialProfile(data);
    });

    getUserPreferences().then((data) => {
      setPreferences(data);
      setInitialPreferences(data);
    });

    const handleUserUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UserProfile>;
      if (customEvent.detail) {
        setProfile(customEvent.detail);
        setInitialProfile(customEvent.detail);
      }
    };

    window.addEventListener('satquery-user-update', handleUserUpdate);
    return () => window.removeEventListener('satquery-user-update', handleUserUpdate);
  }, []);

  // ─── Profile Actions ───────────────────────────────────────────────────────
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAvatarError(null);
      const dataUrl = await processAvatarFile(file);
      setProfile((prev) => ({ ...prev, avatar: dataUrl }));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to load avatar image.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => ({ ...prev, avatar: undefined }));
    setAvatarError(null);
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile.name.trim()) {
      setNameError('Full name cannot be empty.');
      return;
    }
    setNameError(null);
    const updated = await updateUserProfile({
      name: profile.name.trim(),
      avatar: profile.avatar,
    });
    setProfile(updated);
    setInitialProfile(updated);
    setProfileSavedNotice(true);
    setTimeout(() => setProfileSavedNotice(false), 3500);
  };

  const handleResetProfile = () => {
    setProfile(initialProfile);
    setNameError(null);
    setAvatarError(null);
  };

  // ─── Notifications Actions ─────────────────────────────────────────────────
  const handleSaveNotifications = async () => {
    const updated = await updateUserPreferences({
      notifications: preferences.notifications,
    });
    setPreferences(updated);
    setInitialPreferences(updated);
    setNotificationsSavedNotice(true);
    setTimeout(() => setNotificationsSavedNotice(false), 3500);
  };

  const handleResetNotifications = () => {
    setPreferences((prev) => ({
      ...prev,
      notifications: initialPreferences.notifications,
    }));
  };

  // ─── Analysis Preferences Actions ──────────────────────────────────────────
  const handleSaveAnalysis = async () => {
    const updated = await updateUserPreferences({
      analysis: preferences.analysis,
    });
    setPreferences(updated);
    setInitialPreferences(updated);
    setAnalysisSavedNotice(true);
    setTimeout(() => setAnalysisSavedNotice(false), 3500);
  };

  const handleResetAnalysis = () => {
    setPreferences((prev) => ({
      ...prev,
      analysis: initialPreferences.analysis,
    }));
  };

  // ─── Security Actions ──────────────────────────────────────────────────────
  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!currentPassword) {
      errors.currentPassword = 'Please enter your current password.';
    }
    if (!newPassword) {
      errors.newPassword = 'Please enter a new password.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'New passwords do not match.';
    }

    setSecurityErrors(errors);

    if (Object.keys(errors).length === 0) {
      // Clear password fields safely (DO NOT store or hash passwords)
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Display explicit user-requested message
      setSecurityNotice('Password changes will be available when account authentication is connected.');
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Account Settings
            </h1>
            <span
              title="Settings are persisted locally in browser storage. No credentials are transmitted to remote servers."
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-cyan-300 select-none cursor-help"
            >
              FRONTEND DEMO
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal profile, workspace theme, notification alerts, and analysis preferences.
          </p>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all select-none',
                isActive
                  ? 'bg-blue-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── SECTION 1: PROFILE ─────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Profile Information
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Your identity and demonstration account details across the workspace.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Profile Avatar */}
              <div className="space-y-2 max-w-lg">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  Profile Avatar
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 overflow-hidden">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt="Profile avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile.name
                        .split(' ')
                        .filter(Boolean)
                        .map((p) => p[0]?.toUpperCase())
                        .slice(0, 2)
                        .join('') || 'SV'
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                      id="settings-avatar-input"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Change Avatar</span>
                      </button>
                      {profile.avatar && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium text-red-600 dark:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      PNG, JPG, or WEBP. Automatically optimized for client-side storage.
                    </span>
                  </div>
                </div>
                {avatarError && (
                  <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{avatarError}</span>
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-name"
                  className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative max-w-lg">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profile-name"
                    type="text"
                    value={profile.name}
                    onChange={(e) => {
                      setProfile({ ...profile, name: e.target.value });
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter your full name"
                    maxLength={60}
                    className={cn(
                      'w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      nameError
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40'
                    )}
                  />
                </div>
                {nameError && (
                  <p className="text-xs font-medium text-red-500 dark:text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-email"
                  className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative max-w-lg">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    disabled
                    readOnly
                    className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Email is linked to your demo authentication session and cannot be modified without backend identity verification.
                  </span>
                </p>
              </div>

              {/* Buttons and Inline Confirmation */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.99]"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetProfile}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>

                {profileSavedNotice && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Changes saved.</span>
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Demonstration Session Context Card */}
          <div className="bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800/70 rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Session Metadata
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Account ID</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">usr_demo_sih26167</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Session Tier</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Local Sandbox (SIH26167)</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Storage Mode</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Browser localStorage</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2: APPEARANCE ──────────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                <SunMoon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Workspace Appearance
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Choose how SatQuery AI appears across the workspace.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Option */}
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={cn(
                  'flex flex-col items-start p-5 rounded-2xl border text-left transition-all relative',
                  themeMode === 'light'
                    ? 'border-blue-600 dark:border-cyan-400 bg-blue-50/50 dark:bg-cyan-950/20 ring-2 ring-blue-500/20 dark:ring-cyan-400/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                )}
              >
                {themeMode === 'light' && (
                  <span className="absolute top-4 right-4 text-blue-600 dark:text-cyan-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                )}
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3">
                  <Sun className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Light Mode
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Clean daylight contrast optimized for reports, documentation, and daytime workstations.
                </p>
              </button>

              {/* Dark Option */}
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={cn(
                  'flex flex-col items-start p-5 rounded-2xl border text-left transition-all relative',
                  themeMode === 'dark'
                    ? 'border-blue-600 dark:border-cyan-400 bg-blue-50/50 dark:bg-cyan-950/20 ring-2 ring-blue-500/20 dark:ring-cyan-400/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                )}
              >
                {themeMode === 'dark' && (
                  <span className="absolute top-4 right-4 text-blue-600 dark:text-cyan-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                )}
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 mb-3">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Dark Aerospace
                  </h3>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                    Default
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Deep space dark theme calibrated for multi-spectral contrast and low eye fatigue.
                </p>
              </button>

              {/* System Option */}
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={cn(
                  'flex flex-col items-start p-5 rounded-2xl border text-left transition-all relative',
                  themeMode === 'system'
                    ? 'border-blue-600 dark:border-cyan-400 bg-blue-50/50 dark:bg-cyan-950/20 ring-2 ring-blue-500/20 dark:ring-cyan-400/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                )}
              >
                {themeMode === 'system' && (
                  <span className="absolute top-4 right-4 text-blue-600 dark:text-cyan-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                )}
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-3">
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  System Sync
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automatically syncs with your operating system color scheme preferences.
                </p>
              </button>
            </div>

            <div className="mt-5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Effective Active Theme: <strong className="text-slate-900 dark:text-slate-100 capitalize">{theme}</strong>
                {themeMode === 'system' && ' (synchronized via OS)'}
              </span>
              <span className="font-mono text-[11px] text-blue-600 dark:text-cyan-400">
                {themeMode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: NOTIFICATIONS ───────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Notification Preferences
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Configure alerts and updates for satellite analysis workflows.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 space-y-4">
              {/* Option 1: Analysis Completion */}
              <div className="flex items-start justify-between gap-4 pt-4 first:pt-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Analysis Finished Alerts
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                    Receive in-app status notification when an automated satellite imagery query or change detection run finishes.
                  </p>
                </div>
                <Switch
                  id="notify-completion"
                  checked={preferences.notifications.analysisCompletion}
                  onChange={(val) =>
                    setPreferences({
                      ...preferences,
                      notifications: { ...preferences.notifications, analysisCompletion: val },
                    })
                  }
                  ariaLabel="Toggle analysis finished alerts"
                />
              </div>

              {/* Option 2: Report Ready */}
              <div className="flex items-start justify-between gap-4 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Dossier & Report Ready
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                    Notify when downloadable PDF briefings, machine-readable JSON artifacts, or ASCII summaries are compiled.
                  </p>
                </div>
                <Switch
                  id="notify-reports"
                  checked={preferences.notifications.reportReady}
                  onChange={(val) =>
                    setPreferences({
                      ...preferences,
                      notifications: { ...preferences.notifications, reportReady: val },
                    })
                  }
                  ariaLabel="Toggle dossier and report alerts"
                />
              </div>

              {/* Option 3: Product Updates */}
              <div className="flex items-start justify-between gap-4 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Product & Testbed Updates
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                    Alerts when new benchmark datasets (e.g., SpaceNet, LEVIR-CD) or Sentinel demonstration scenes are published.
                  </p>
                </div>
                <Switch
                  id="notify-updates"
                  checked={preferences.notifications.productUpdates}
                  onChange={(val) =>
                    setPreferences({
                      ...preferences,
                      notifications: { ...preferences.notifications, productUpdates: val },
                    })
                  }
                  ariaLabel="Toggle product and testbed updates"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/70 mt-6">
              <button
                type="button"
                onClick={handleSaveNotifications}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.99]"
              >
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </button>
              <button
                type="button"
                onClick={handleResetNotifications}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Defaults</span>
              </button>

              {notificationsSavedNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Preferences saved.</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                Preferences are saved locally in your browser sandbox. Push and email notification webhooks connect when backend services are deployed.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── SECTION 4: ANALYSIS PREFERENCES ─────────────────────────────────── */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Analysis & Workspace Preferences
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Customize default behaviors for satellite intelligence workflows and canvas tools.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Group 1: Default Analysis Experience */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Default Analysis Experience
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-1 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Remember Last Analysis Mode
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg">
                        Automatically restores your last active capability (e.g., Object Grounding, Bi-Temporal Change) upon returning to the dashboard.
                      </p>
                    </div>
                    <Switch
                      id="pref-remember-mode"
                      checked={preferences.analysis.rememberLastMode}
                      onChange={(val) =>
                        setPreferences({
                          ...preferences,
                          analysis: { ...preferences.analysis, rememberLastMode: val },
                        })
                      }
                      ariaLabel="Toggle remember last analysis mode"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Open Latest Analysis on Return
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg">
                        Pre-populates the workspace with the most recently inspected query and findings when re-entering the dashboard.
                      </p>
                    </div>
                    <Switch
                      id="pref-open-latest"
                      checked={preferences.analysis.openLatestOnReturn}
                      onChange={(val) =>
                        setPreferences({
                          ...preferences,
                          analysis: { ...preferences.analysis, openLatestOnReturn: val },
                        })
                      }
                      ariaLabel="Toggle open latest analysis on return"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Viewer Preferences */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Viewer Preferences
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-1 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Preserve Canvas Viewport
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg">
                        Maintains zoom level and coordinate pan position when toggling between Single, Swipe Comparison, and Optical+SAR views.
                      </p>
                    </div>
                    <Switch
                      id="pref-preserve-viewport"
                      checked={preferences.analysis.preserveViewerState}
                      onChange={(val) =>
                        setPreferences({
                          ...preferences,
                          analysis: { ...preferences.analysis, preserveViewerState: val },
                        })
                      }
                      ariaLabel="Toggle preserve canvas viewport"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 py-3.5">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Show Evidence Overlays by Default
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-lg">
                        Displays spatial bounding box highlights and change polygon overlays automatically upon analysis completion.
                      </p>
                    </div>
                    <Switch
                      id="pref-show-evidence"
                      checked={preferences.analysis.showEvidenceByDefault}
                      onChange={(val) =>
                        setPreferences({
                          ...preferences,
                          analysis: { ...preferences.analysis, showEvidenceByDefault: val },
                        })
                      }
                      ariaLabel="Toggle show evidence overlays by default"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/70 mt-6">
              <button
                type="button"
                onClick={handleSaveAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.99]"
              >
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </button>
              <button
                type="button"
                onClick={handleResetAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Defaults</span>
              </button>

              {analysisSavedNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Preferences saved.</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 5: SECURITY ────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Security & Credentials
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Manage password credentials and review account security.
                </p>
              </div>
            </div>

            {/* Transparent Demo Sandbox Alert */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs sm:text-sm leading-relaxed mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Frontend Demonstration Sandbox</strong>
                Password changes and credential management are validated locally for interface preview. In this demonstration release, no real credentials are stored, modified, or transmitted to external authentication servers.
              </div>
            </div>

            <form onSubmit={handleSecuritySubmit} className="space-y-5 max-w-lg">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="current-password"
                  className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (securityErrors.currentPassword) {
                        setSecurityErrors({ ...securityErrors, currentPassword: '' });
                      }
                    }}
                    placeholder="Enter current password"
                    className={cn(
                      'w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      securityErrors.currentPassword
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {securityErrors.currentPassword && (
                  <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1">
                    {securityErrors.currentPassword}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (securityErrors.newPassword) {
                        setSecurityErrors({ ...securityErrors, newPassword: '' });
                      }
                    }}
                    placeholder="Minimum 8 characters"
                    className={cn(
                      'w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      securityErrors.newPassword
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {securityErrors.newPassword && (
                  <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1">
                    {securityErrors.newPassword}
                  </p>
                )}

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Password strength:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex gap-1">
                      <div
                        className={cn(
                          'h-full flex-1 transition-all duration-300',
                          passwordStrength.level >= 1 ? passwordStrength.color : 'bg-transparent'
                        )}
                      />
                      <div
                        className={cn(
                          'h-full flex-1 transition-all duration-300',
                          passwordStrength.level >= 2 ? passwordStrength.color : 'bg-transparent'
                        )}
                      />
                      <div
                        className={cn(
                          'h-full flex-1 transition-all duration-300',
                          passwordStrength.level >= 3 ? passwordStrength.color : 'bg-transparent'
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (securityErrors.confirmPassword) {
                        setSecurityErrors({ ...securityErrors, confirmPassword: '' });
                      }
                    }}
                    placeholder="Repeat new password"
                    className={cn(
                      'w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      securityErrors.confirmPassword
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {securityErrors.confirmPassword && (
                  <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1">
                    {securityErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Notice Banner upon submission */}
              {securityNotice && (
                <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-cyan-300 text-xs sm:text-sm font-medium leading-snug flex items-start gap-2.5 animate-in fade-in duration-200">
                  <Info className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <span>{securityNotice}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
