import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@medidesk/ui';
import { AuditEvent } from '@medidesk/domain';

export const AuditLogView: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuditEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!window.mediDeskBridge) return;
      const response = await window.mediDeskBridge.getRecentAuditEvents(100);
      if (response.success && response.data) {
        setEvents(response.data as AuditEvent[]);
      }
    } catch (_err) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditEvents();
  }, [loadAuditEvents]);

  const filteredEvents = events.filter((evt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const resourceOrTarget = evt.resource || evt.target || '';
    return (
      evt.action.toLowerCase().includes(term) ||
      evt.actor.username?.toLowerCase().includes(term) ||
      resourceOrTarget.toLowerCase().includes(term) ||
      evt.result.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            Security & Operational Audit Trail
          </h2>
          <p className="text-xs text-slate-500">
            Immutable, tamper-evident record of all security authentications, system mutations, and administrative events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search audit trail..."
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-56 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAuditEvents}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Audit Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 dark:bg-slate-800/40 dark:border-slate-700">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Recorded Events ({filteredEvents.length})</span>
            <Badge variant="outline" className="text-[10px]">
              SHA256 Sanitized Persistence
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Resource</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No audit events recorded matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
                    const isExpanded = expandedId === evt.id;
                    return (
                      <React.Fragment key={evt.id}>
                        <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(evt.timestamp).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'medium'
                            })}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {evt.actor.username || 'System'}
                              </span>
                              {evt.actor.roles
                                ? evt.actor.roles.map((r: string) => (
                                    <Badge key={r} variant="outline" className="text-[9px] py-0 px-1">
                                      {r}
                                    </Badge>
                                  ))
                                : evt.actor.role
                                ? (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1">
                                      {evt.actor.role}
                                    </Badge>
                                  )
                                : null}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                evt.action.includes('FAILED') || evt.action.includes('DISABLED')
                                  ? 'danger'
                                  : evt.action.includes('LOGIN')
                                  ? 'primary'
                                  : 'secondary'
                              }
                              className="text-[10px] font-mono py-0.5 px-1.5"
                            >
                              {evt.action}
                            </Badge>
                          </td>

                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            {evt.resource || evt.target || '-'}
                          </td>

                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                evt.result === 'SUCCESS'
                                  ? 'success'
                                  : evt.result === 'DENIED'
                                  ? 'warning'
                                  : 'danger'
                              }
                              className="text-[10px]"
                            >
                              {evt.result}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                              className="text-[11px] py-0.5 px-2 h-6"
                            >
                              {isExpanded ? 'Hide' : 'Inspect'}
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-900 text-slate-200">
                            <td colSpan={6} className="py-3 px-4 text-[11px] font-mono">
                              <div className="space-y-1">
                                <div className="text-teal-400 font-semibold text-xs mb-1">
                                  Event Payload & Sanitized Metadata:
                                </div>
                                <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto text-[11px]">
                                  {JSON.stringify(
                                    {
                                      id: evt.id,
                                      timestamp: evt.timestamp,
                                      actor: evt.actor,
                                      action: evt.action,
                                      resource: evt.resource,
                                      result: evt.result,
                                      metadata: evt.metadata
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
