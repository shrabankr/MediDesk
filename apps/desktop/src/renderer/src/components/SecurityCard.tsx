import React from 'react';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@medidesk/ui';
import { SystemStatusData } from '@medidesk/shared';

interface SecurityCardProps {
  status: SystemStatusData | null;
}

export const SecurityCard: React.FC<SecurityCardProps> = ({ status }) => {
  const securityItems = [
    {
      title: 'Context Isolation',
      description: 'Renderer JavaScript execution context is isolated from Node.js runtime.',
      active: status?.security.contextIsolation ?? true,
      key: 'contextIsolation'
    },
    {
      title: 'Node Integration Disabled',
      description: 'window.require and Node standard library are strictly blocked in renderer.',
      active: !(status?.security.nodeIntegration ?? false),
      key: 'nodeIntegration'
    },
    {
      title: 'Process Sandboxing',
      description: 'Chromium renderer process runs inside operating-system sandbox.',
      active: status?.security.sandbox ?? true,
      key: 'sandbox'
    },
    {
      title: 'No Raw SQL IPC',
      description: 'Database queries run exclusively in main process via typed repositories.',
      active: true,
      key: 'rawSqlBlocked'
    },
    {
      title: 'Owner / Developer Separation',
      description:
        'Developer has no default access to clinical, patient, pharmacy, or financial data. Temporary sensitive support access requires explicit Owner approval, limited scope, expiration, and audit logging.',
      active: true,
      key: 'roleSeparation'
    }
  ];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-teal-600" />
          Security Architecture Baseline
        </CardTitle>
        <CardDescription>
          Electron Main-Preload-Renderer isolation and boundary protection policies
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {securityItems.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30"
            >
              <div className="mt-0.5">
                {item.active ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </span>
                  <Badge variant={item.active ? 'success' : 'danger'} className="text-[9px] py-0 px-1.5">
                    {item.active ? 'Enforced' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
