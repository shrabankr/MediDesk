import React from 'react';
import { Shield, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@medidesk/ui';
import { RoleName } from '@medidesk/domain';

export const RbacExplorerView: React.FC = () => {
  const roleMatrices = [
    {
      role: RoleName.OWNER,
      title: 'OWNER (Business Authority)',
      badgeVariant: 'warning' as const,
      description: 'Full business control over clinic profile, user management, clinical, pharmacy, and billing operations.',
      permissions: [
        { code: 'org.manage', name: 'Organization & Clinic Settings', allowed: true },
        { code: 'auth.user.manage', name: 'User Account Administration', allowed: true },
        { code: 'patient.read / write', name: 'Patient Medical Records', allowed: true },
        { code: 'consultation.create', name: 'Clinical Consultations & Prescriptions', allowed: true },
        { code: 'sale.create', name: 'POS Billing & Invoicing', allowed: true },
        { code: 'inventory.manage', name: 'Pharmacy Stock & Batches', allowed: true },
        { code: 'audit.read', name: 'Security Audit Log Viewer', allowed: true },
        { code: 'system.diagnostics', name: 'System Diagnostics', allowed: true }
      ]
    },
    {
      role: RoleName.DOCTOR,
      title: 'DOCTOR (Clinical Practitioner)',
      badgeVariant: 'primary' as const,
      description: 'Access to patient records, clinical encounters, diagnostic history, and digital prescriptions.',
      permissions: [
        { code: 'org.manage', name: 'Organization & Clinic Settings', allowed: false },
        { code: 'auth.user.manage', name: 'User Account Administration', allowed: false },
        { code: 'patient.read / write', name: 'Patient Medical Records', allowed: true },
        { code: 'consultation.create', name: 'Clinical Consultations & Prescriptions', allowed: true },
        { code: 'sale.create', name: 'POS Billing & Invoicing', allowed: false },
        { code: 'inventory.manage', name: 'Pharmacy Stock & Batches', allowed: false },
        { code: 'audit.read', name: 'Security Audit Log Viewer', allowed: false },
        { code: 'system.diagnostics', name: 'System Diagnostics', allowed: false }
      ]
    },
    {
      role: RoleName.STAFF,
      title: 'STAFF (Front Desk & Reception)',
      badgeVariant: 'secondary' as const,
      description: 'Handles patient registration, queue triage, appointment scheduling, and POS billing receipts.',
      permissions: [
        { code: 'org.manage', name: 'Organization & Clinic Settings', allowed: false },
        { code: 'auth.user.manage', name: 'User Account Administration', allowed: false },
        { code: 'patient.read / write', name: 'Patient Medical Records (Demographics Only)', allowed: true },
        { code: 'consultation.create', name: 'Clinical Consultations & Prescriptions', allowed: false },
        { code: 'sale.create', name: 'POS Billing & Invoicing', allowed: true },
        { code: 'inventory.manage', name: 'Pharmacy Stock & Batches', allowed: false },
        { code: 'audit.read', name: 'Security Audit Log Viewer', allowed: false },
        { code: 'system.diagnostics', name: 'System Diagnostics', allowed: false }
      ]
    },
    {
      role: RoleName.DEVELOPER,
      title: 'DEVELOPER (Technical Authority Only)',
      badgeVariant: 'outline' as const,
      description: 'Technical maintenance, schema migrations, local database snapshots, and system health telemetry.',
      permissions: [
        { code: 'org.manage', name: 'Organization & Clinic Settings', allowed: false },
        { code: 'auth.user.manage', name: 'User Account Administration', allowed: false },
        { code: 'patient.read / write', name: 'Patient Medical Records', allowed: false },
        { code: 'consultation.create', name: 'Clinical Consultations & Prescriptions', allowed: false },
        { code: 'sale.create', name: 'POS Billing & Invoicing', allowed: false },
        { code: 'inventory.manage', name: 'Pharmacy Stock & Batches', allowed: false },
        { code: 'audit.read', name: 'Security Audit Log Viewer', allowed: true },
        { code: 'system.diagnostics', name: 'System Diagnostics & Migrations', allowed: true }
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="h-5 w-5 text-teal-600" />
          Role-Based Access Control (RBAC) Matrix
        </h2>
        <p className="text-xs text-slate-500">
          Enforces privilege separation between Business Authority (Owner) and Technical Authority (Developer)
        </p>
      </div>

      {/* Critical Privilege Separation Banner */}
      <div className="p-4 rounded-xl bg-teal-950/80 border border-teal-800 text-teal-100 text-xs space-y-2 shadow-sm">
        <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
          <Lock className="h-4 w-4 text-teal-400" />
          Owner vs Developer Privilege Separation Rule
        </div>
        <p className="text-[12px] leading-relaxed text-teal-200/90">
          "Developer has no default access to clinical, patient, pharmacy, or financial data. Temporary sensitive support access requires explicit Owner approval, limited scope, expiration, and audit logging."
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roleMatrices.map((matrix) => (
          <Card key={matrix.role} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{matrix.title}</CardTitle>
                <Badge variant={matrix.badgeVariant} className="text-[10px]">
                  {matrix.role}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">{matrix.description}</CardDescription>
            </CardHeader>

            <CardContent className="pt-3">
              <div className="space-y-1.5">
                {matrix.permissions.map((perm) => (
                  <div
                    key={perm.code}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{perm.name}</span>
                    <div className="flex items-center gap-1">
                      {perm.allowed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                          <XCircle className="h-3.5 w-3.5 text-slate-400" />
                          Denied
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
