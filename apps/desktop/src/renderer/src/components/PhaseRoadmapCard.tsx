import React from 'react';
import { Layers, CheckCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@medidesk/ui';

export const PhaseRoadmapCard: React.FC = () => {
  const phases = [
    { phase: 1, title: 'Project Initialization & Secure Foundation', status: 'CURRENT', desc: 'Monorepo, Electron Security, SQLite Migrations, Domain/RBAC Models, IPC Contracts' },
    { phase: 2, title: 'First-Run Setup, Auth & User Management', status: 'PLANNED', desc: 'Setup Wizard, Scrypt Auth, Owner/Developer Separation, RBAC Enforcement, Audit Logging' },
    { phase: 3, title: 'Patient, Doctor & Appointment Modules', status: 'FUTURE', desc: 'Patient demographics, scheduling, queue management' },
    { phase: 4, title: 'Clinical Consultation & Prescription', status: 'FUTURE', desc: 'Medical records, diagnosis, allergies, digital prescriptions' },
    { phase: 5, title: 'Pharmacy, Inventory & POS Billing', status: 'FUTURE', desc: 'Medicine master, batch tracking, invoicing, sales' },
    { phase: 6, title: 'Printing, Backup & 60-Day Trial Licensing', status: 'FUTURE', desc: 'Native/thermal printing, Google Drive backup, license validation' }
  ];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-teal-600" />
          Engineering Roadmap & Phase Boundaries
        </CardTitle>
        <CardDescription>
          MediDesk phased roadmap alignment strictly enforcing clean architectural boundaries
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2.5">
          {phases.map((p) => (
            <div
              key={p.phase}
              className={`flex items-center justify-between rounded-lg p-3 border transition-colors ${
                p.status === 'CURRENT'
                  ? 'border-teal-300 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30'
                  : 'border-slate-100 bg-slate-50/30 dark:border-slate-800/60 dark:bg-slate-900/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${
                    p.status === 'CURRENT'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  P{p.phase}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {p.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {p.desc}
                  </div>
                </div>
              </div>

              <div>
                {p.status === 'CURRENT' && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Current Phase
                  </Badge>
                )}
                {p.status === 'PLANNED' && (
                  <Badge variant="warning" className="text-[10px] gap-1">
                    <Clock className="h-3 w-3" />
                    Next: Phase 2
                  </Badge>
                )}
                {p.status === 'FUTURE' && (
                  <Badge variant="outline" className="text-[10px]">
                    Future Phase
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
