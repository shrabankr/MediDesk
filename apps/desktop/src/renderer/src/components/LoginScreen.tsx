import React, { useState } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/domain';

interface LoginScreenProps {
  onLoginSuccess: (user: SessionUser, sessionToken: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('clinic_owner');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsLocked(false);

    try {
      if (!window.mediDeskBridge) {
        throw new Error('Desktop Bridge is not available');
      }

      const response = await window.mediDeskBridge.login({
        username: username.trim(),
        password
      });

      if (!response.success) {
        if (response.error?.code === 'AccountLockedError') {
          setIsLocked(true);
        }
        throw new Error(response.error?.message || 'Login failed. Please verify credentials.');
      }

      if (response.data) {
        onLoginSuccess(response.data.user, response.data.sessionToken);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
    setIsLocked(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 mb-3 shadow-lg shadow-teal-500/5">
            <ShieldCheck className="h-8 w-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MediDesk Login</h1>
          <p className="text-slate-400 text-xs mt-1">
            Clinical & Pharmacy Management Platform • Single-PC Offline Core
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-800/90 backdrop-blur-sm shadow-2xl text-slate-100">
          <CardHeader className="border-b border-slate-700/60 pb-4">
            <CardTitle className="text-base text-white flex items-center justify-between">
              <span>Sign In</span>
              <Badge variant="outline" className="text-[10px] text-teal-300 border-teal-800 bg-teal-950/40">
                Local RBAC
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Authenticate using your assigned clinic credentials
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMessage && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    isLocked
                      ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                      : 'bg-amber-950/60 border-amber-800/60 text-amber-200'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold block">{isLocked ? 'Account Locked' : 'Authentication Failed'}</span>
                    <span className="text-[11px] leading-tight opacity-90">{errorMessage}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Enter password"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                disabled={isLoading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2 text-xs shadow-md"
              >
                {isLoading ? 'Verifying Credentials...' : 'Sign In to MediDesk'}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </form>

            {/* Quick test credentials shortcut */}
            <div className="mt-5 pt-4 border-t border-slate-700/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-2">
                Quick Test Credentials (Dev Mode)
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fillQuickCredentials('clinic_owner', 'Password123!')}
                  className="text-[11px] py-1 px-2.5 border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-700 flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3 text-amber-400" />
                  Owner (`clinic_owner`)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Security Note */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3 text-teal-500" />
          <span>Local password verification via scrypt cryptographic hashing</span>
        </div>
      </div>
    </div>
  );
};
