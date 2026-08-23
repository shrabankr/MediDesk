import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Key,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@medidesk/ui';
import { SafeUser, SessionUser, RoleName } from '@medidesk/domain';

interface UserManagementViewProps {
  currentUser: SessionUser;
  sessionToken: string;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, sessionToken }) => {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<SafeUser | null>(null);

  // Create User Form State
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: RoleName.DOCTOR as RoleName
  });

  // Reset Password Form State
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!window.mediDeskBridge) return;
      const response = await window.mediDeskBridge.listUsers(currentUser.organizationId, sessionToken);
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        setFeedback({ type: 'error', message: response.error?.message || 'Failed to load users.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.organizationId, sessionToken]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    try {
      if (!window.mediDeskBridge) return;
      const response = await window.mediDeskBridge.createUser(
        {
          organizationId: currentUser.organizationId,
          username: newUser.username.trim(),
          fullName: newUser.fullName.trim(),
          email: newUser.email.trim(),
          password: newUser.password,
          roles: [newUser.role]
        },
        sessionToken
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create user');
      }

      setFeedback({ type: 'success', message: `User '${newUser.username}' created successfully.` });
      setShowCreateModal(false);
      setNewUser({
        username: '',
        fullName: '',
        email: '',
        password: '',
        role: RoleName.DOCTOR
      });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetModal) return;
    setFeedback(null);

    try {
      if (!window.mediDeskBridge) return;
      const response = await window.mediDeskBridge.resetPassword(
        {
          userId: showResetModal.id,
          newPassword
        },
        sessionToken
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to reset password');
      }

      setFeedback({ type: 'success', message: `Password for '${showResetModal.username}' was reset successfully.` });
      setShowResetModal(null);
      setNewPassword('');
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    }
  };

  const handleToggleStatus = async (user: SafeUser) => {
    setFeedback(null);
    try {
      if (!window.mediDeskBridge) return;
      const newStatus = !user.isActive;
      const response = await window.mediDeskBridge.toggleUserStatus(
        {
          userId: user.id,
          isActive: newStatus
        },
        sessionToken
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update user status');
      }

      setFeedback({
        type: 'success',
        message: `User '${user.username}' ${newStatus ? 'activated' : 'deactivated'} successfully.`
      });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    }
  };

  const isOwner = currentUser.roles.includes(RoleName.OWNER);

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            User Administration & Access Control
          </h2>
          <p className="text-xs text-slate-500">
            Manage staff accounts, assign granular role permissions, and reset credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isOwner && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs flex items-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] font-semibold underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Table Card */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 dark:bg-slate-800/40 dark:border-slate-700">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Clinic Personnel ({users.length})</span>
            <Badge variant="outline" className="text-[10px]">
              Active Scope: {currentUser.organizationName}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">User Details</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Lockout</th>
                  <th className="py-2.5 px-3">Last Login</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((user) => {
                  const isCurrent = user.id === currentUser.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {user.fullName}
                              {isCurrent && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              @{user.username} • {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={
                                r === RoleName.OWNER
                                  ? 'warning'
                                  : r === RoleName.DEVELOPER
                                  ? 'outline'
                                  : 'primary'
                              }
                              className="text-[10px] py-0.5 px-2"
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <Badge variant={user.isActive ? 'success' : 'danger'} className="text-[10px]">
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>

                      <td className="py-3 px-3">
                        {user.isLocked ? (
                          <Badge variant="danger" className="text-[10px] flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-500">Normal</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })
                          : 'Never'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isOwner && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowResetModal(user)}
                                className="text-[11px] py-1 px-2 h-7"
                              >
                                <Key className="h-3 w-3 mr-1 text-amber-500" />
                                Reset
                              </Button>

                              {!isCurrent && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleStatus(user)}
                                  className={`text-[11px] py-1 px-2 h-7 ${
                                    user.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {user.isActive ? (
                                    <>
                                      <UserX className="h-3 w-3 mr-1" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Activate
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-slate-700 bg-slate-800 text-white shadow-2xl">
            <CardHeader className="border-b border-slate-700 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-teal-400" />
                Add New Staff User
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Create user profile and assign role authority
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                    placeholder="e.g. dr_miller"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                    placeholder="e.g. Dr. Arthur Miller"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                    placeholder="dr.miller@clinic.local"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                    placeholder="Min 8 chars, uppercase, lowercase, number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Role *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as RoleName })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                  >
                    <option value={RoleName.DOCTOR}>DOCTOR (Clinical Consultations & Prescriptions)</option>
                    <option value={RoleName.STAFF}>STAFF (Reception, Queue & Appointments)</option>
                    <option value={RoleName.DEVELOPER}>DEVELOPER (Technical Diagnostics Only)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="text-xs border-slate-700 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="default" className="text-xs bg-teal-600 hover:bg-teal-500">
                    Create User
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border-slate-700 bg-slate-800 text-white shadow-2xl">
            <CardHeader className="border-b border-slate-700 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                Reset Password
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Set new password for <span className="font-semibold text-white">@{showResetModal.username}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">New Password *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-teal-500"
                    placeholder="Min 8 chars with uppercase, lowercase, number"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResetModal(null)}
                    className="text-xs border-slate-700 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="default" className="text-xs bg-amber-600 hover:bg-amber-500">
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
