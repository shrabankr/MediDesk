import React from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Shield,
  LogOut,
  Building,
  WifiOff
} from 'lucide-react';
import { Button, Badge } from '@medidesk/ui';
import { SessionUser, RoleName } from '@medidesk/domain';

export type NavTab = 'status' | 'users' | 'audit' | 'rbac';

interface AppLayoutProps {
  currentUser: SessionUser;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onLogout,
  children
}) => {

  const tabs: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'status', label: 'System Status', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
    { id: 'rbac', label: 'RBAC Policy', icon: Shield }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Branding & Org */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-600 rounded-lg text-white shadow-sm">
                  <Activity className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">MediDesk</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  v1.0 (Phase 2)
                </Badge>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <Building className="h-3.5 w-3.5 text-teal-600" />
                <span className="font-semibold">{currentUser.organizationName || 'Clinic'}</span>
              </div>
            </div>

            {/* Right: Badges, User Profile & Logout */}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-[10px] flex items-center gap-1 border-teal-700/50 text-teal-700 dark:text-teal-400">
                <WifiOff className="h-3 w-3" />
                Offline-First Mode
              </Badge>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

              {/* Active User */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {currentUser.fullName}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {currentUser.roles.map((role) => (
                      <Badge
                        key={role}
                        variant={role === RoleName.OWNER ? 'warning' : 'primary'}
                        className="text-[9px] py-0 px-1 font-mono"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-slate-200 dark:border-slate-700 flex items-center gap-1 h-8 px-2.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-100 dark:border-slate-800/80 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 py-2.5 px-3.5 text-xs font-medium border-b-2 transition-all ${
                    active
                      ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-3 text-center text-[11px] text-slate-400">
        MediDesk © 2026 • Offline-First Single-PC Architecture • Phase 2 Verified Auth & RBAC
      </footer>
    </div>
  );
};
