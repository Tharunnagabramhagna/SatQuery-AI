import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { SignInModal } from './SignInModal';
import { SystemStatusModal } from '../dashboard/SystemStatusModal';
import { useSidebar } from '../../hooks/useSidebar';
import { getUserProfile, updateUserProfile } from '../../services/api';
import type { UserProfile } from '../../types';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { toggleMobile } = useSidebar();
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);

  // Minimal demo user data — only name and email, no passwords or tokens
  const [demoUser, setDemoUser] = useState<UserProfile>({
    name: 'Stark Visions',
    email: 'engineer@satquery.ai',
  });

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile) {
        setDemoUser(profile);
      }
    });

    const handleUserUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UserProfile>;
      if (customEvent.detail) {
        setDemoUser(customEvent.detail);
      }
    };

    window.addEventListener('satquery-user-update', handleUserUpdate);
    return () => window.removeEventListener('satquery-user-update', handleUserUpdate);
  }, []);

  const location = useLocation();

  const isWorkspacePage =
    location.pathname === '/dashboard' ||
    location.pathname === '/' ||
    location.pathname === '/analysis';

  const handleAuthSuccess = (userData?: { name: string; email: string }) => {
    setIsSignedIn(true);
    if (userData) {
      setDemoUser(userData);
      updateUserProfile(userData);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#060a14] text-slate-900 dark:text-slate-100 selection:bg-blue-600/30 selection:text-blue-600 dark:selection:text-blue-200 transition-colors duration-150">
      {/* Top Full-Width Navbar matching reference screenshot */}
      <Navbar
        onToggleMobileMenu={toggleMobile}
        onOpenSystemStatus={() => setIsStatusModalOpen(true)}
        onSignIn={() => setIsSignInModalOpen(true)}
        isSignedIn={isSignedIn}
        onSignOut={() => setIsSignedIn(false)}
        userName={demoUser.name}
        userEmail={demoUser.email}
        userAvatar={demoUser.avatar}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {isWorkspacePage ? (
          children
        ) : (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
            {children}
          </div>
        )}
      </main>

      {/* Global System Architecture Status Modal */}
      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />

      {/* Sign In / Sign Up Modal */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
