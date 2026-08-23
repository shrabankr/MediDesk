import React, { useState } from 'react';
import { Building2, User, CheckCircle, ArrowRight, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@medidesk/ui';

interface SetupWizardProps {
  onCompleted: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onCompleted }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clinic Form
  const [orgData, setOrgData] = useState({
    name: 'Metro City Healthcare',
    code: 'METRO01',
    address: '123 Health Avenue, Medical District',
    phone: '+91 98765 43210',
    email: 'contact@metrohealthcare.local',
    currency: 'INR',
    timezone: 'Asia/Kolkata'
  });

  // Owner Form
  const [ownerData, setOwnerData] = useState({
    username: 'clinic_owner',
    fullName: 'Dr. Sarah Jenkins (Owner)',
    email: 'sarah.jenkins@metrohealthcare.local',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  });

  // Developer token for first-run authorization
  const [developerToken, setDeveloperToken] = useState('dev-token-initial-setup-2026');

  const handleNextStep = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (!orgData.name.trim() || !orgData.code.trim()) {
        setErrorMessage('Please provide clinic name and code.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!ownerData.username.trim() || !ownerData.fullName.trim() || !ownerData.email.trim()) {
        setErrorMessage('All owner details are required.');
        return;
      }
      if (ownerData.password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (ownerData.password !== ownerData.confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      setStep(3);
    }
  };

  const handleInitialize = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!window.mediDeskBridge) {
        throw new Error('Desktop Bridge is not available');
      }

      const response = await window.mediDeskBridge.initializeSystem({
        organization: orgData,
        initialOwner: {
          username: ownerData.username,
          fullName: ownerData.fullName,
          email: ownerData.email,
          password: ownerData.password
        },
        developerToken
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'System initialization failed');
      }

      onCompleted();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 mb-3">
            <ShieldCheck className="h-8 w-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MediDesk First-Run Setup</h1>
          <p className="text-slate-400 text-xs mt-1">
            Initialize your local clinical database, organization profile, and initial Owner authority account
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { num: 1, label: 'Clinic Details', icon: Building2 },
            { num: 2, label: 'Owner Profile', icon: User },
            { num: 3, label: 'Initialize System', icon: Sparkles }
          ].map((item) => {
            const Icon = item.icon;
            const active = step === item.num;
            const completed = step > item.num;
            return (
              <div key={item.num} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-500/40'
                      : completed
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </div>
                {item.num < 3 && <div className="w-4 h-0.5 bg-slate-700" />}
              </div>
            );
          })}
        </div>

        {/* Card Form */}
        <Card className="border-slate-800 bg-slate-800/80 backdrop-blur-sm shadow-xl text-slate-100">
          <CardHeader className="border-b border-slate-700/60 pb-4">
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span>
                {step === 1 && 'Step 1: Clinic Profile & Configuration'}
                {step === 2 && 'Step 2: Initial Clinic Owner Account'}
                {step === 3 && 'Step 3: Review & Finalize Initialization'}
              </span>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">
                Offline-First Local DB
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              {step === 1 && 'Configure your healthcare facility profile and regional settings.'}
              {step === 2 && 'Create the primary Owner account holding business authority.'}
              {step === 3 && 'Confirm database setup parameters and execute system initialization.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <span className="font-semibold">Error:</span> {errorMessage}
              </div>
            )}

            {/* STEP 1: CLINIC PROFILE */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Clinic / Hospital Name *</label>
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="e.g. Metro City Clinic"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Organization Code *</label>
                  <input
                    type="text"
                    value={orgData.code}
                    onChange={(e) => setOrgData({ ...orgData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="e.g. METRO01"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Address</label>
                  <input
                    type="text"
                    value={orgData.address}
                    onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Street, City, State, PIN Code"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={orgData.phone}
                    onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={orgData.email}
                    onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="clinic@domain.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                  <input
                    type="text"
                    value={orgData.currency}
                    onChange={(e) => setOrgData({ ...orgData, currency: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={orgData.timezone}
                    onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: OWNER ACCOUNT */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Owner Username *</label>
                    <input
                      type="text"
                      value={ownerData.username}
                      onChange={(e) => setOwnerData({ ...ownerData, username: e.target.value.toLowerCase() })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="e.g. clinic_owner"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Owner Full Name *</label>
                    <input
                      type="text"
                      value={ownerData.fullName}
                      onChange={(e) => setOwnerData({ ...ownerData, fullName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="e.g. Dr. Jane Doe"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Owner Email *</label>
                    <input
                      type="email"
                      value={ownerData.email}
                      onChange={(e) => setOwnerData({ ...ownerData, email: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="owner@domain.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
                    <input
                      type="password"
                      value={ownerData.password}
                      onChange={(e) => setOwnerData({ ...ownerData, password: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      value={ownerData.confirmPassword}
                      onChange={(e) => setOwnerData({ ...ownerData, confirmPassword: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/80 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Security Requirement:</span> Password will be securely hashed with scrypt and a cryptographically random salt. The Owner role holds full administrative and clinical authority.
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW & INITIALIZE */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900/80 rounded-lg border border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CLINIC NAME</span>
                    <span className="font-semibold text-white">{orgData.name} ({orgData.code})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">OFFICIAL EMAIL</span>
                    <span className="font-semibold text-white">{orgData.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">OWNER USERNAME</span>
                    <span className="font-semibold text-teal-400">{ownerData.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">OWNER FULL NAME</span>
                    <span className="font-semibold text-white">{ownerData.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">REGIONAL SETTINGS</span>
                    <span className="text-white">{orgData.currency} • {orgData.timezone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PERSISTENCE ENGINE</span>
                    <span className="text-white">SQLite WAL + Foreign Keys</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Developer Initialization Token</label>
                  <input
                    type="text"
                    value={developerToken}
                    onChange={(e) => setDeveloperToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Pre-filled with development environment initialization key.</p>
                </div>
              </div>
            )}

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setStep((step - 1) as 1 | 2)}
                  disabled={isSubmitting}
                  className="border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button
                  variant="default"
                  onClick={handleNextStep}
                  className="bg-teal-600 hover:bg-teal-500 text-white"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={handleInitialize}
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {isSubmitting ? 'Initializing Database & Owner...' : 'Execute System Initialization'}
                  <CheckCircle className="h-4 w-4 ml-1.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
