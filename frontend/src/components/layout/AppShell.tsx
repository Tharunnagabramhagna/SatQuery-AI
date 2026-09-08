import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { SignInModal } from './SignInModal';
import { SystemStatusModal } from '../dashboard/SystemStatusModal';
import { useSidebar } from '../../hooks/useSidebar';
import { getUserProfile, updateUserProfile, API_BASE } from '../../services/api';
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

  const handleAuthSuccess = (userData?: { name: string; email: string; avatar?: string }) => {
    setIsSignedIn(true);
    if (userData) {
      setDemoUser(userData);
      updateUserProfile(userData);
    }
  };

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile) {
        setDemoUser(profile);
      }
    });

    // Handle OAuth Callback code from Google / Facebook
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get('oauth_code');
    const authError = urlParams.get('error');

    if (oauthCode) {
      fetch(`${API_BASE}/auth/oauth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to exchange OAuth code');
          return res.json();
        })
        .then((data) => {
          if (data.access_token) {
            localStorage.setItem('satquery_token', data.access_token);
          }
          if (data.user) {
            const userProfile: UserProfile = {
              name: data.user.display_name || data.user.name || data.user.email.split('@')[0],
              email: data.user.email,
              avatar: data.user.avatar_url,
            };
            handleAuthSuccess(userProfile);
          }
        })
        .catch((err) => {
          console.error('OAuth exchange error:', err);
        })
        .finally(() => {
          urlParams.delete('oauth_code');
          urlParams.delete('error');
          const remainingQuery = urlParams.toString();
          const cleanUrl =
            window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        });
    } else if (authError) {
      console.warn('OAuth authorization error:', authError);
      urlParams.delete('error');
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }

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


  return (
    <div className="relative flex flex-col min-h-screen bg-slate-50 dark:bg-[#060a14] text-slate-900 dark:text-slate-100 selection:bg-blue-600/30 selection:text-blue-600 dark:selection:text-blue-200 transition-colors duration-150 overflow-x-hidden">

      {/* Atmospheric visual layer */}
      <div className="satquery-atmosphere" aria-hidden="true" />

      {/* Existing application */}
      <div className="relative z-10 flex flex-col min-h-screen">
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

        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {isWorkspacePage ? (
            children
          ) : (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
              {children}
            </div>
          )}
        </main>
      </div>

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />

      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
