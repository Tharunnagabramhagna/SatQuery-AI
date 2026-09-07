import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  User,
  X,
  UserRound,
  Languages,
  CircleHelp,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  BookOpen,
  LogOut,
  LogIn,
  ExternalLink,
  Check,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  getUserProfile,
  updateUserProfile,
} from '../../services/api';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, useTranslation } from '../../i18n';

// ─── Avatar Resizing & Processing Helper ──────────────────────────────────────

export function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return reject(new Error('Unsupported format. Please select a PNG, JPEG, or WEBP image.'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('File exceeds 5MB. Please choose a smaller image.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 160x160 to keep base64 string lightweight (<25KB)
        const canvas = document.createElement('canvas');
        const maxSize = 160;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context initialization failed.'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load selected image.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// ─── Password Strength Helper ────────────────────────────────────────────────

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


// ─── Component Props ─────────────────────────────────────────────────────────

export type ProfileModalView = 'menu' | 'edit-profile' | 'language' | 'help-support' | 'privacy-security';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function ProfileModal({
  isOpen,
  onClose,
  isSignedIn,
  onSignIn,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
}: ProfileModalProps) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useTranslation();
  const [activeView, setActiveView] = useState<ProfileModalView>('menu');

  // Local state for user details
  const [name, setName] = useState(userName || 'Stark Visions');
  const [email] = useState(userEmail || 'engineer@satquery.ai');
  const [avatar, setAvatar] = useState<string | undefined>(userAvatar);

  // Edit Profile Form State
  const [editName, setEditName] = useState(name);
  const [editAvatar, setEditAvatar] = useState<string | undefined>(avatar);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editSuccessNotice, setEditSuccessNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Language State
  const [languageNotice, setLanguageNotice] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityErrors, setSecurityErrors] = useState<Record<string, string>>({});
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [clearDataNotice, setClearDataNotice] = useState(false);

  // Synchronize with external props and API on open
  useEffect(() => {
    if (isOpen) {
      setActiveView('menu');
      setEditSuccessNotice(false);
      setSecurityNotice(null);
      setAvatarError(null);
      setNameError(null);
      setSecurityErrors({});

      getUserProfile().then((profile) => {
        if (profile) {
          setName(profile.name);
          setAvatar(profile.avatar);
          setEditName(profile.name);
          setEditAvatar(profile.avatar);
        }
      });
    }
  }, [isOpen, userName, userAvatar]);

  // Compute initials dynamically from active display name
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'SV';

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeView !== 'menu') {
          setActiveView('menu');
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeView, onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // ─── Edit Profile Handlers ─────────────────────────────────────────────────

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAvatarError(null);
      const dataUrl = await processAvatarFile(file);
      setEditAvatar(dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to load avatar image.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setEditAvatar(undefined);
    setAvatarError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setNameError('Full name cannot be empty.');
      return;
    }
    setNameError(null);
    setIsEditSaving(true);

    try {
      const updated = await updateUserProfile({
        name: editName.trim(),
        avatar: editAvatar,
      });

      setName(updated.name);
      setAvatar(updated.avatar);
      setEditSuccessNotice(true);
      setTimeout(() => {
        setEditSuccessNotice(false);
        setActiveView('menu');
      }, 1200);
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(name);
    setEditAvatar(avatar);
    setAvatarError(null);
    setNameError(null);
    setActiveView('menu');
  };

  // ─── Language Handler ──────────────────────────────────────────────────────

  const handleSelectLanguage = async (code: SupportedLanguage) => {
    await setLanguage(code);
    setLanguageNotice(null);
  };

  // ─── Security Handlers ─────────────────────────────────────────────────────

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

  const handleClearDemoData = () => {
    try {
      localStorage.removeItem('satquery-user');
      localStorage.removeItem('satquery-preferences');
      localStorage.removeItem('satquery-language');
      localStorage.removeItem('satquery-last-mode');
    } catch {
      // ignore
    }
    setName('Stark Visions');
    setAvatar(undefined);
    setEditName('Stark Visions');
    setEditAvatar(undefined);
    setClearDataNotice(true);
    updateUserProfile({ name: 'Stark Visions', avatar: undefined });
    setTimeout(() => setClearDataNotice(false), 3000);
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // ─── View Titles ───────────────────────────────────────────────────────────

  const getViewTitle = () => {
    switch (activeView) {
      case 'edit-profile':
        return t('profileModal.editProfile');
      case 'language':
        return t('profileModal.language');
      case 'help-support':
        return t('profileModal.helpSupport');
      case 'privacy-security':
        return t('profileModal.privacySecurity');
      default:
        return t('profileModal.menuTitle');
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0a0f1e] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-150 text-slate-900 dark:text-slate-100"
      >
        {/* ── Modal Header with Back navigation ────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeView !== 'menu' && (
              <button
                type="button"
                onClick={() => setActiveView('menu')}
                className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
                aria-label="Back to profile menu"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3
              id="profile-modal-title"
              className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate"
            >
              {getViewTitle()}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            aria-label="Close profile modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* ══════════════════════════════════════════════════════════════════
              VIEW 1: MAIN PROFILE INFORMATION MENU (FOCUSED)
             ══════════════════════════════════════════════════════════════════ */}
          {activeView === 'menu' && (
            <div className="space-y-4">
              {/* User Identity Header Card */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-blue-600/15 shrink-0 overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {name}
                    </h4>
                    <span className="text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-cyan-400 shrink-0">
                      DEMO
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {email}
                  </p>
                </div>
              </div>

              {/* Focused Menu Entries (Preferences, Appearance, Notifications REMOVED) */}
              <div className="space-y-1 pt-1">
                {/* 1. Edit Profile */}
                <button
                  type="button"
                  onClick={() => setActiveView('edit-profile')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:border-blue-300 dark:group-hover:border-cyan-500/40 transition-colors shrink-0">
                      <UserRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                        {t('profileModal.editProfile')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t('profileModal.updateProfileDesc')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-3" />
                </button>

                {/* 2. Language */}
                <button
                  type="button"
                  onClick={() => setActiveView('language')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:border-blue-300 dark:group-hover:border-cyan-500/40 transition-colors shrink-0">
                      <Languages className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                        {t('profileModal.language')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t('profileModal.chooseLanguage')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'English'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>

                {/* 3. Help & Support */}
                <button
                  type="button"
                  onClick={() => setActiveView('help-support')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:border-blue-300 dark:group-hover:border-cyan-500/40 transition-colors shrink-0">
                      <CircleHelp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                        {t('profileModal.helpSupport')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t('profileModal.helpSupportDesc')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-3" />
                </button>

                {/* 4. Privacy & Security */}
                <button
                  type="button"
                  onClick={() => setActiveView('privacy-security')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:border-blue-300 dark:group-hover:border-cyan-500/40 transition-colors shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                        {t('profileModal.privacySecurity')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t('profileModal.privacySecurityDesc')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-3" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 2: EDIT PROFILE (FUNCTIONAL AVATAR & NAME EDITING)
             ══════════════════════════════════════════════════════════════════ */}
          {activeView === 'edit-profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Uploader Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('profileModal.avatarLabel')}
                </label>

                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 overflow-hidden">
                    {editAvatar ? (
                      <img src={editAvatar} alt="Avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                      id="avatar-file-input"
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

                      {editAvatar && (
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
                      {t('profileModal.avatarHint')}
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
                  htmlFor="modal-edit-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="modal-edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter your full name"
                    maxLength={60}
                    className={cn(
                      'w-full h-10 pl-9 pr-3 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      nameError
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/40 dark:focus:ring-cyan-400/40'
                    )}
                  />
                </div>
                {nameError && (
                  <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              {/* Email Address (Read-only) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-edit-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="modal-edit-email"
                    type="email"
                    value={email}
                    disabled
                    readOnly
                    className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>{t('profileModal.emailHint')}</span>
                </p>
              </div>

              {/* Inline Save Notice */}
              {editSuccessNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('profileModal.profileUpdated')}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {isEditSaving ? t('profileModal.saving') : t('profileModal.saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium transition-colors"
                >
                  {t('profileModal.cancel')}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 3: LANGUAGE (FUNCTIONAL SELECTION WITH LOCAL PERSISTENCE)
             ══════════════════════════════════════════════════════════════════ */}
          {activeView === 'language' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('profileModal.chooseLanguage')}
              </p>

              {languageNotice && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-cyan-400 text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{languageNotice}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 text-left transition-colors',
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-cyan-950/25'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {lang.name}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            ({lang.nativeName})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {t('profileModal.currentSupported')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="p-1 rounded-full bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 4: HELP & SUPPORT (PRACTICAL GUIDES + DOCS LINK)
             ══════════════════════════════════════════════════════════════════ */}
          {activeView === 'help-support' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Explore guides, documentation, and query formulating resources.
              </p>

              {/* Documentation Center Link Card */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-cyan-300">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <h4 className="text-sm font-bold">Technical Documentation Center</h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Access all 13 architecture guides, multimodal workflows, 11-stage AI execution trace, and system specifications.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/documentation');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Open Documentation</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Guidance Items */}
              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Getting Started</span>
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Type natural-language questions in the Query Agent or pick presets in Datasets to trigger automated remote-sensing workflows.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                    <CircleHelp className="w-3.5 h-3.5 text-blue-500" />
                    <span>Analysis Capabilities</span>
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Supports 6 capabilities: Single Image VQA, Scene Captioning, Object Grounding, Bi-Temporal Change Detection, Change VQA, and Optical+SAR.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-[11px] text-slate-500 dark:text-slate-400">
                Evaluation notice: For Hackathon (SIH26167) technical evaluation, all data models and services are documented in the Technical Documentation Center.
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 5: PRIVACY & SECURITY (TRUTHFUL DEMO DISCLOSURE & PWD CHECK)
             ══════════════════════════════════════════════════════════════════ */}
          {activeView === 'privacy-security' && (
            <div className="space-y-4">
              {/* Honest Demo Privacy Statement */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs leading-relaxed space-y-1">
                <strong className="font-semibold block flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Privacy & Demonstration Sandbox</span>
                </strong>
                <p>
                  SatQuery AI is currently running in frontend demo mode. Persistent account security and backend data controls will be connected when the authentication backend is deployed.
                </p>
              </div>

              {/* Local Storage Controls */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2">
                <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('profileModal.localSandbox')}
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('profileModal.localSandboxDesc')}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClearDemoData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('profileModal.resetLocalData')}</span>
                  </button>
                  {clearDataNotice && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                      {t('profileModal.demoResetSuccess')}
                    </span>
                  )}
                </div>
              </div>

              {/* Change Password Form (Frontend Validation Only) */}
              <form onSubmit={handleSecuritySubmit} className="space-y-3 pt-1">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Account Password
                </h5>

                {/* Current Password */}
                <div className="space-y-1">
                  <label
                    htmlFor="privacy-current-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t('profileModal.currentPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="privacy-current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (securityErrors.currentPassword) {
                          setSecurityErrors({ ...securityErrors, currentPassword: '' });
                        }
                      }}
                      placeholder="Enter current password"
                      className="w-full h-9 pl-8 pr-9 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {securityErrors.currentPassword && (
                    <p className="text-[11px] text-red-500">{securityErrors.currentPassword}</p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label
                    htmlFor="privacy-new-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t('profileModal.newPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="privacy-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (securityErrors.newPassword) {
                          setSecurityErrors({ ...securityErrors, newPassword: '' });
                        }
                      }}
                      placeholder="Min. 8 characters"
                      className="w-full h-9 pl-8 pr-9 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {securityErrors.newPassword && (
                    <p className="text-[11px] text-red-500">{securityErrors.newPassword}</p>
                  )}

                  {newPassword && (
                    <div className="flex items-center gap-2 pt-0.5 text-[10px]">
                      <span className="text-slate-400">Strength:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {passwordStrength.label}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex gap-0.5">
                        <div className={cn('h-full flex-1', passwordStrength.level >= 1 ? passwordStrength.color : 'bg-transparent')} />
                        <div className={cn('h-full flex-1', passwordStrength.level >= 2 ? passwordStrength.color : 'bg-transparent')} />
                        <div className={cn('h-full flex-1', passwordStrength.level >= 3 ? passwordStrength.color : 'bg-transparent')} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label
                    htmlFor="privacy-confirm-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t('profileModal.confirmNewPassword')}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="privacy-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (securityErrors.confirmPassword) {
                          setSecurityErrors({ ...securityErrors, confirmPassword: '' });
                        }
                      }}
                      placeholder="Repeat new password"
                      className="w-full h-9 pl-8 pr-9 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {securityErrors.confirmPassword && (
                    <p className="text-[11px] text-red-500">{securityErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Transparent Notice on Submit */}
                {securityNotice && (
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-cyan-300 text-xs font-medium leading-snug flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    <span>{securityNotice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-semibold shadow-sm transition-all"
                >
                  {t('profileModal.updatePassword')}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Modal Footer: Sign Out (shown on main menu) ─────────────────── */}
        {activeView === 'menu' && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/50 shrink-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('profileMenu.signOut')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <LogIn className="w-4 h-4" />
                <span>{t('profileMenu.signIn')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
