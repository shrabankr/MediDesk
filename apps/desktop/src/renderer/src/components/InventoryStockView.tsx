import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  Clock,
  RefreshCw,
  TrendingDown,
  History,
  CheckCircle,
  AlertCircle,
  ClipboardCheck,
  Plus,
  Scale,
  Trash2,
  Eye,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/shared';

interface InventoryStockViewProps {
  currentUser: SessionUser;
  onBack?: () => void;
}

export const InventoryStockView: React.FC<InventoryStockViewProps> = ({ currentUser, onBack }) => {
  const orgId = currentUser.organizationId;
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';
  const isOwner = currentUser.roles.includes('OWNER');

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'EXPIRY' | 'LOW_STOCK' | 'MOVEMENTS' | 'RECONCILIATION'>('BATCHES');

  // Lists
  const [batches, setBatches] = useState<any[]>([]);
  const [expiringSoon30, setExpiringSoon30] = useState<any[]>([]);
  const [expiringSoon90, setExpiringSoon90] = useState<any[]>([]);
  const [expiredList, setExpiredList] = useState<any[]>([]);
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);

  // Reconciliation State
  const [reconciliationsList, setReconciliationsList] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedBatchForCount, setSelectedBatchForCount] = useState<any | null>(null);
  const [countedQuantity, setCountedQuantity] = useState<number>(0);
  const [varianceReason, setVarianceReason] = useState<string>('AUDIT_CORRECTION');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [packagingUnitName, setPackagingUnitName] = useState<string>('');
  const [packagingUnitQty, setPackagingUnitQty] = useState<number>(0);
  const [availablePackagingUnits, setAvailablePackagingUnits] = useState<any[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedBatchForAdjust, setSelectedBatchForAdjust] = useState<any | null>(null);
  const [newStockQuantity, setNewStockQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'EXPIRED_DISCARD' | 'DAMAGED_WRITE_OFF'>('ADJUSTMENT_IN');

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const [exp30, exp90, expired, low, movs, recons] = await Promise.all([
        window.mediDeskBridge.getExpiringSoon(30, sessionToken),
        window.mediDeskBridge.getExpiringSoon(90, sessionToken),
        window.mediDeskBridge.getExpiredStock(sessionToken),
        window.mediDeskBridge.getLowStock(sessionToken),
        window.mediDeskBridge.getStockMovements(undefined, sessionToken),
        window.mediDeskBridge.listReconciliationSessions(sessionToken, 50)
      ]);

      if (exp30.success && exp30.data) setExpiringSoon30(exp30.data);
      if (exp90.success && exp90.data) {
        setExpiringSoon90(exp90.data);
        setBatches(exp90.data);
      }
      if (expired.success && expired.data) setExpiredList(expired.data);
      if (low.success && low.data) setLowStockList(low.data);
      if (movs.success && movs.data) setMovementsList(movs.data);
      if (recons.success && recons.data) setReconciliationsList(recons.data);

      if (activeSession) {
        const refreshedSession = await window.mediDeskBridge.getReconciliationSession(activeSession.id, sessionToken);
        if (refreshedSession.success && refreshedSession.data) {
          setActiveSession(refreshedSession.data);
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, activeSession?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdjust = (batch: any) => {
    setSelectedBatchForAdjust(batch);
    setNewStockQuantity(batch.currentStockQuantity);
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForAdjust || !adjustReason.trim()) {
      setErrorMsg('Batch and mandatory adjustment reason are required.');
      return;
    }

    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.adjustStock({
        organizationId: orgId,
        productId: selectedBatchForAdjust.productId,
        batchId: selectedBatchForAdjust.id,
        adjustedQuantity: newStockQuantity,
        isDelta: false,
        reason: adjustReason.trim(),
        movementType: adjustType,
        adjustedBy: currentUser.id
      }, sessionToken);

      if (res.success) {
        setIsAdjustModalOpen(false);
        setSuccessMsg(`Stock adjusted for batch ${selectedBatchForAdjust.batchNumber} to ${newStockQuantity}.`);
        setSelectedBatchForAdjust(null);
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Stock adjustment failed.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Reconciliation Handlers
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.createReconciliationSession({ notes: newSessionNotes }, sessionToken);
      if (res.success && res.data) {
        setIsNewSessionModalOpen(false);
        setNewSessionNotes('');
        setActiveSession(res.data);
        setSuccessMsg(`Stock count session ${res.data.sessionNumber} started.`);
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to create count session.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleOpenAddItem = async (batch?: any) => {
    const targetBatch = batch || batches[0] || (expiringSoon90.length > 0 ? expiringSoon90[0] : null);
    setSelectedBatchForCount(targetBatch);
    setCountedQuantity(targetBatch ? targetBatch.currentStockQuantity : 0);
    setVarianceReason('AUDIT_CORRECTION');
    setItemNotes('');
    setPackagingUnitName('');
    setPackagingUnitQty(0);

    if (targetBatch && window.mediDeskBridge?.getPackagingUnitsByProduct) {
      const pkgRes = await window.mediDeskBridge.getPackagingUnitsByProduct(targetBatch.productId);
      if (pkgRes.success && pkgRes.data) {
        setAvailablePackagingUnits(pkgRes.data);
      } else {
        setAvailablePackagingUnits([]);
      }
    }

    setIsAddItemModalOpen(true);
  };

  const handleBatchSelectChange = async (batchId: string) => {
    const all = [...expiringSoon90, ...expiredList];
    const b = all.find((x) => x.id === batchId) || null;
    setSelectedBatchForCount(b);
    if (b) {
      setCountedQuantity(b.currentStockQuantity);
      if (window.mediDeskBridge?.getPackagingUnitsByProduct) {
        const pkgRes = await window.mediDeskBridge.getPackagingUnitsByProduct(b.productId);
        if (pkgRes.success && pkgRes.data) {
          setAvailablePackagingUnits(pkgRes.data);
        } else {
          setAvailablePackagingUnits([]);
        }
      }
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !selectedBatchForCount || !window.mediDeskBridge) return;

    try {
      let finalQty = countedQuantity;
      if (packagingUnitName && packagingUnitQty > 0) {
        const unit = availablePackagingUnits.find((u) => u.unitName === packagingUnitName);
        if (unit) {
          finalQty = packagingUnitQty * unit.conversionFactor;
        }
      }

      const res = await window.mediDeskBridge.addReconciliationItem(
        {
          sessionId: activeSession.id,
          productId: selectedBatchForCount.productId,
          batchId: selectedBatchForCount.id,
          physicalStockQuantity: finalQty,
          varianceReason,
          notes: itemNotes,
          packagingUnitName: packagingUnitName || undefined,
          packagingUnitQuantity: packagingUnitQty > 0 ? packagingUnitQty : undefined
        },
        sessionToken
      );

      if (res.success) {
        setIsAddItemModalOpen(false);
        setSuccessMsg(`Recorded count for batch ${selectedBatchForCount.batchNumber}.`);
        const refreshed = await window.mediDeskBridge.getReconciliationSession(activeSession.id, sessionToken);
        if (refreshed.success && refreshed.data) {
          setActiveSession(refreshed.data);
        }
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to record count.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeSession || !window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.deleteReconciliationItem(itemId, activeSession.id, sessionToken);
      if (res.success) {
        const refreshed = await window.mediDeskBridge.getReconciliationSession(activeSession.id, sessionToken);
        if (refreshed.success && refreshed.data) {
          setActiveSession(refreshed.data);
        }
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to delete item.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleSubmitSession = async () => {
    if (!activeSession || !window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.submitReconciliationSession({ sessionId: activeSession.id }, sessionToken);
      if (res.success && res.data) {
        setActiveSession(res.data);
        setSuccessMsg(`Count session ${res.data.sessionNumber} submitted for Owner review.`);
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to submit count session.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.reviewReconciliationSession(
        {
          sessionId: activeSession.id,
          action: reviewAction,
          reviewNotes
        },
        sessionToken
      );

      if (res.success && res.data) {
        setIsReviewModalOpen(false);
        setActiveSession(res.data);
        setSuccessMsg(
          reviewAction === 'APPROVE'
            ? `Stock reconciliation ${res.data.sessionNumber} approved! Compensating adjustments posted to ledger.`
            : `Stock reconciliation ${res.data.sessionNumber} rejected. No stock changes applied.`
        );
        loadData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to process review.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack} className="h-8 px-2">
                ← Back
              </Button>
            )}
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="h-6 w-6 text-indigo-600" />
              Inventory, Batch & Stock Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time batch tracking, FEFO management, automated expiry alerts, physical stock count & variance audit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh Stock
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto font-bold">×</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-rose-500">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
          <div>
            <div className="text-xs text-slate-500">Expired Batches</div>
            <div className="text-lg font-bold text-rose-600 font-mono">{expiredList.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-amber-500">
          <Clock className="h-7 w-7 text-amber-500" />
          <div>
            <div className="text-xs text-slate-500">Expiring in 30 Days</div>
            <div className="text-lg font-bold text-amber-600 font-mono">{expiringSoon30.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
          <TrendingDown className="h-7 w-7 text-blue-500" />
          <div>
            <div className="text-xs text-slate-500">Low Stock SKUs</div>
            <div className="text-lg font-bold text-blue-600 font-mono">{lowStockList.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-indigo-500">
          <Scale className="h-7 w-7 text-indigo-500" />
          <div>
            <div className="text-xs text-slate-500">Stock Audits</div>
            <div className="text-lg font-bold text-indigo-600 font-mono">{reconciliationsList.length}</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => { setActiveTab('BATCHES'); setActiveSession(null); }}
          className={`pb-2 border-b-2 ${
            activeTab === 'BATCHES'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Active Batches ({expiringSoon90.length})
        </button>
        <button
          onClick={() => { setActiveTab('RECONCILIATION'); }}
          className={`pb-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'RECONCILIATION'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" /> Physical Stock Count & Audit ({reconciliationsList.length})
        </button>
        <button
          onClick={() => { setActiveTab('EXPIRY'); setActiveSession(null); }}
          className={`pb-2 border-b-2 ${
            activeTab === 'EXPIRY'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Expiry Alerts ({expiringSoon30.length + expiredList.length})
        </button>
        <button
          onClick={() => { setActiveTab('LOW_STOCK'); setActiveSession(null); }}
          className={`pb-2 border-b-2 ${
            activeTab === 'LOW_STOCK'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Low Stock Alerts ({lowStockList.length})
        </button>
        <button
          onClick={() => { setActiveTab('MOVEMENTS'); setActiveSession(null); }}
          className={`pb-2 border-b-2 ${
            activeTab === 'MOVEMENTS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Stock Movement Ledger ({movementsList.length})
        </button>
      </div>

      {/* Tab: Physical Stock Count & Audit (Phase 9A) */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-4">
          {!activeSession ? (
            /* Reconciliation Session History / List */
            <Card className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-indigo-600" /> Physical Stock Count Sessions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Conduct physical counts, record variances, and submit for Owner approval to update inventory.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setIsNewSessionModalOpen(true)} className="text-xs">
                  <Plus className="h-4 w-4 mr-1" /> New Stock Count
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                      <th className="p-2.5">Session #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Counted By</th>
                      <th className="p-2.5 text-center">Items Counted</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reconciliationsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                          No stock count sessions found. Click &quot;New Stock Count&quot; to begin physical shelf verification.
                        </td>
                      </tr>
                    ) : (
                      reconciliationsList.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {session.sessionNumber}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">
                            {session.countedByName || 'Staff Member'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            {session.items?.length || 0}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge
                              variant={
                                session.status === 'POSTED'
                                  ? 'success'
                                  : session.status === 'SUBMITTED'
                                  ? 'warning'
                                  : session.status === 'REJECTED'
                                  ? 'danger'
                                  : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {session.status}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-slate-500 truncate max-w-xs">{session.notes || '—'}</td>
                          <td className="p-2.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveSession(session)}
                              className="text-[11px] h-6 px-2"
                            >
                              <Eye className="h-3 w-3 mr-1" /> View / Count
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Active Reconciliation Session Detail View */
            <div className="space-y-4">
              <Card className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setActiveSession(null)} className="h-8 px-2">
                      <ArrowLeft className="h-4 w-4 mr-1" /> All Sessions
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {activeSession.sessionNumber}
                        </h2>
                        <Badge
                          variant={
                            activeSession.status === 'POSTED'
                              ? 'success'
                              : activeSession.status === 'SUBMITTED'
                              ? 'warning'
                              : activeSession.status === 'REJECTED'
                              ? 'danger'
                              : 'secondary'
                          }
                        >
                          {activeSession.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        Counted by <span className="font-semibold">{activeSession.countedByName || 'Staff'}</span> on {new Date(activeSession.createdAt).toLocaleString()}
                        {activeSession.notes && ` • Notes: ${activeSession.notes}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(activeSession.status === 'DRAFT' || activeSession.status === 'COUNTED') && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenAddItem()} className="text-xs">
                          <Plus className="h-4 w-4 mr-1" /> Count Medicine
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSubmitSession}
                          disabled={!activeSession.items || activeSession.items.length === 0}
                          className="text-xs"
                        >
                          Submit for Review →
                        </Button>
                      </>
                    )}

                    {activeSession.status === 'SUBMITTED' && isOwner && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setReviewAction('APPROVE');
                          setReviewNotes('');
                          setIsReviewModalOpen(true);
                        }}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" /> Review & Approve Variance
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status Guidance Banner */}
                {activeSession.status === 'SUBMITTED' && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Awaiting Owner Review:</strong> Physical counts are submitted. The Owner must approve the discrepancies before the stock adjustment is posted to the ledger.
                      </span>
                    </div>
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewAction('REJECT');
                          setReviewNotes('');
                          setIsReviewModalOpen(true);
                        }}
                        className="text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                )}

                {activeSession.status === 'POSTED' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Stock Adjustment Completed:</strong> Approved and posted to the inventory ledger. All variance changes are recorded with permanent audit traceability.
                    </span>
                  </div>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                        <th className="p-2.5">Medicine Product</th>
                        <th className="p-2.5">Batch</th>
                        <th className="p-2.5">Expiry</th>
                        <th className="p-2.5 text-center">System Stock</th>
                        <th className="p-2.5 text-center">Physical Count</th>
                        <th className="p-2.5 text-center">Difference</th>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5">Notes</th>
                        {(activeSession.status === 'DRAFT' || activeSession.status === 'COUNTED') && (
                          <th className="p-2.5 text-right">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {!activeSession.items || activeSession.items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                            No medicines counted yet in this session. Click &quot;Count Medicine&quot; to add physical counts.
                          </td>
                        </tr>
                      ) : (
                        activeSession.items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                              {item.productName || 'Medicine'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">{item.batchNumber}</td>
                            <td className="p-2.5 font-mono text-slate-500">{item.expiryDate}</td>
                            <td className="p-2.5 text-center font-mono text-slate-600">
                              {item.systemStockQuantity} units
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-900 dark:text-white">
                              {item.physicalStockQuantity} units
                              {item.packagingUnitName && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  ({item.packagingUnitQuantity} {item.packagingUnitName})
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold">
                              {item.varianceQuantity === 0 ? (
                                <span className="text-slate-400">0 (Match)</span>
                              ) : item.varianceQuantity > 0 ? (
                                <span className="text-emerald-600">+{item.varianceQuantity}</span>
                              ) : (
                                <span className="text-rose-600">{item.varianceQuantity}</span>
                              )}
                              {item.isLargeVariance && (
                                <Badge variant="danger" className="ml-1.5 text-[9px] px-1 py-0">
                                  LARGE VARIANCE
                                </Badge>
                              )}
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[10px]">
                                {item.varianceReason}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-slate-500 truncate max-w-xs">{item.notes || '—'}</td>
                            {(activeSession.status === 'DRAFT' || activeSession.status === 'COUNTED') && (
                              <td className="p-2.5 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-rose-600 hover:bg-rose-50 border-rose-200 h-6 px-2 text-[10px]"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: All Active Batches */}
      {activeTab === 'BATCHES' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Medicine Product</th>
                  <th className="p-2.5">Batch Number</th>
                  <th className="p-2.5">Expiry Date</th>
                  <th className="p-2.5 text-center">Available Stock</th>
                  <th className="p-2.5 text-right">Purchase Rate (₹)</th>
                  <th className="p-2.5 text-right">MRP (₹)</th>
                  <th className="p-2.5 text-right">Sale Price (₹)</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expiringSoon90.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                      No active stock batches found. Inward a purchase invoice to receive stock.
                    </td>
                  </tr>
                ) : (
                  expiringSoon90.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {b.productName}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{b.batchNumber}</td>
                      <td className="p-2.5 font-mono">
                        <Badge variant="outline" className="text-[10px]">{b.expiryDate}</Badge>
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {b.currentStockQuantity}
                      </td>
                      <td className="p-2.5 text-right font-mono">₹{b.purchasePricePerUnit.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono">₹{b.mrpPerUnit.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">₹{b.salePricePerUnit.toFixed(2)}</td>
                      <td className="p-2.5 text-right">
                        <Button variant="outline" size="sm" onClick={() => handleOpenAdjust(b)} className="text-[11px] h-6 px-2">
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Expiry Alerts */}
      {activeTab === 'EXPIRY' && (
        <div className="space-y-4">
          <Card className="p-4 border-l-4 border-l-rose-600">
            <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Expired Stock (Selling Forbidden by Rule)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-rose-50/50 dark:bg-rose-950/20 text-rose-700">
                    <th className="p-2">Product</th>
                    <th className="p-2">Batch</th>
                    <th className="p-2">Expired On</th>
                    <th className="p-2 text-center">Remaining Stock</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">Zero expired batches in active inventory.</td>
                    </tr>
                  ) : (
                    expiredList.map((b) => (
                      <tr key={b.id} className="border-b border-rose-100 dark:border-rose-900/30">
                        <td className="p-2 font-bold">{b.productName}</td>
                        <td className="p-2 font-mono">{b.batchNumber}</td>
                        <td className="p-2 font-mono text-rose-600 font-bold">{b.expiryDate}</td>
                        <td className="p-2 text-center font-mono font-bold">{b.currentStockQuantity}</td>
                        <td className="p-2 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenAdjust(b)} className="text-[10px] h-6 text-rose-600 border-rose-200">
                            Write Off
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" /> Expiring Within 30 Days (Priority FEFO Clearance)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-700">
                    <th className="p-2">Product</th>
                    <th className="p-2">Batch</th>
                    <th className="p-2">Expiry Date</th>
                    <th className="p-2 text-center">Current Stock</th>
                    <th className="p-2 text-right">MRP (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringSoon30.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">No batches expiring in next 30 days.</td>
                    </tr>
                  ) : (
                    expiringSoon30.map((b) => (
                      <tr key={b.id} className="border-b border-amber-100 dark:border-amber-900/30">
                        <td className="p-2 font-bold">{b.productName}</td>
                        <td className="p-2 font-mono">{b.batchNumber}</td>
                        <td className="p-2 font-mono text-amber-600 font-bold">{b.expiryDate}</td>
                        <td className="p-2 text-center font-mono font-bold">{b.currentStockQuantity}</td>
                        <td className="p-2 text-right font-mono">₹{b.mrpPerUnit.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Low Stock Alerts */}
      {activeTab === 'LOW_STOCK' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Product SKU</th>
                  <th className="p-2.5">Strength / Form</th>
                  <th className="p-2.5">Pack Size</th>
                  <th className="p-2.5 text-center">Current Total Units</th>
                  <th className="p-2.5 text-center">Min Stock Threshold</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStockList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                      All products have adequate stock levels above minimum thresholds.
                    </td>
                  </tr>
                ) : (
                  lowStockList.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{item.product.brandName}</td>
                      <td className="p-2.5 text-slate-600">{item.product.strength} ({item.product.dosageForm})</td>
                      <td className="p-2.5 text-slate-500">{item.product.packSize}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-rose-600">{item.totalStock}</td>
                      <td className="p-2.5 text-center font-mono text-slate-500">{item.minStock}</td>
                      <td className="p-2.5 text-right">
                        <Badge variant="danger" className="text-[10px]">REORDER REQUIRED</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Stock Movement Ledger */}
      {activeTab === 'MOVEMENTS' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Date & Time</th>
                  <th className="p-2.5">Movement Type</th>
                  <th className="p-2.5 text-center">Qty Change</th>
                  <th className="p-2.5 text-center">Balance After</th>
                  <th className="p-2.5">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {movementsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movementsList.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 text-slate-500 font-mono">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="p-2.5">
                        <Badge
                          variant={
                            m.movementType === 'PURCHASE' || m.movementType === 'SALE_RETURN'
                              ? 'success'
                              : m.movementType === 'SALE'
                              ? 'secondary'
                              : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {m.movementType}
                        </Badge>
                      </td>
                      <td className={`p-2.5 text-center font-mono font-bold ${m.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {m.balanceAfter}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{m.notes || m.referenceType || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: New Stock Count Session */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" /> Start Physical Stock Count
              </h3>
              <button onClick={() => setIsNewSessionModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Session Notes (Optional)</label>
                <textarea
                  placeholder="e.g. Monthly inventory physical audit, Rack A/B count..."
                  value={newSessionNotes}
                  onChange={(e) => setNewSessionNotes(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Create Count Session
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsNewSessionModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Record Item Count */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-600" /> Record Physical Count
              </h3>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Select Medicine Batch *</label>
                <select
                  value={selectedBatchForCount?.id || ''}
                  onChange={(e) => handleBatchSelectChange(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                >
                  {[...expiringSoon90, ...expiredList].map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.productName} — Batch {b.batchNumber} (System: {b.currentStockQuantity} units, Exp: {b.expiryDate})
                    </option>
                  ))}
                </select>
              </div>

              {availablePackagingUnits.length > 0 && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="font-semibold block mb-1">Count by Packaging Unit</label>
                    <select
                      value={packagingUnitName}
                      onChange={(e) => setPackagingUnitName(e.target.value)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">Direct Base Units (Tablets/Pieces)</option>
                      {availablePackagingUnits.map((u) => (
                        <option key={u.id} value={u.unitName}>
                          {u.unitName} ({u.conversionFactor} units/pack)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Pack Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={packagingUnitQty}
                      onChange={(e) => setPackagingUnitQty(parseInt(e.target.value, 10) || 0)}
                      disabled={!packagingUnitName}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              {!packagingUnitName && (
                <div>
                  <label className="font-semibold block mb-1">Counted Physical Stock (Base Units) *</label>
                  <input
                    type="number"
                    min="0"
                    value={countedQuantity}
                    onChange={(e) => setCountedQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    required
                  />
                </div>
              )}

              {/* Calculated Difference Preview */}
              {selectedBatchForCount && (
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">System Stock:</span>
                    <span className="font-bold">{selectedBatchForCount.currentStockQuantity} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Physical Stock Count:</span>
                    <span className="font-bold">
                      {packagingUnitName && packagingUnitQty > 0
                        ? `${packagingUnitQty * (availablePackagingUnits.find(u => u.unitName === packagingUnitName)?.conversionFactor || 1)} units`
                        : `${countedQuantity} units`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span className="text-slate-500">Calculated Difference:</span>
                    <span className={`font-bold ${
                      (packagingUnitName && packagingUnitQty > 0
                        ? packagingUnitQty * (availablePackagingUnits.find(u => u.unitName === packagingUnitName)?.conversionFactor || 1)
                        : countedQuantity) - selectedBatchForCount.currentStockQuantity >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}>
                      {((packagingUnitName && packagingUnitQty > 0
                        ? packagingUnitQty * (availablePackagingUnits.find(u => u.unitName === packagingUnitName)?.conversionFactor || 1)
                        : countedQuantity) - selectedBatchForCount.currentStockQuantity) > 0 ? '+' : ''}
                      {(packagingUnitName && packagingUnitQty > 0
                        ? packagingUnitQty * (availablePackagingUnits.find(u => u.unitName === packagingUnitName)?.conversionFactor || 1)
                        : countedQuantity) - selectedBatchForCount.currentStockQuantity} units
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">Reason for Variance</label>
                <select
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="AUDIT_CORRECTION">Audit Correction (Routine stock verification)</option>
                  <option value="DAMAGE">Damage (Broken / Unusable items)</option>
                  <option value="EXPIRY_DISPOSAL">Expiry Disposal (Discarded expired medicine)</option>
                  <option value="SHRINKAGE">Shrinkage (Unaccounted shortage)</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Notes / Audit Remarks</label>
                <textarea
                  placeholder="Optional details or explanation..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Record Count
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsAddItemModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Owner Review & Approval */}
      {isReviewModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Review Stock Reconciliation
              </h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded border text-slate-600 dark:text-slate-300 space-y-1">
                <div>Session: <span className="font-mono font-bold text-slate-900 dark:text-white">{activeSession.sessionNumber}</span></div>
                <div>Counted Items: <span className="font-mono font-bold">{activeSession.items?.length || 0}</span></div>
                <div>Action: <strong className={reviewAction === 'APPROVE' ? 'text-emerald-600' : 'text-rose-600'}>{reviewAction}</strong></div>
              </div>

              {reviewAction === 'APPROVE' && (
                <p className="text-slate-500 text-[11px]">
                  Approving this reconciliation will create immutable compensating stock adjustment entries in the ledger and update live batch quantities.
                </p>
              )}

              <div>
                <label className="font-semibold block mb-1">Owner Review Remarks</label>
                <textarea
                  placeholder="State review approval or reason for rejection..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="primary"
                  type="submit"
                  className={`flex-1 text-xs h-9 ${reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                >
                  {reviewAction === 'APPROVE' ? 'Approve & Post to Ledger' : 'Confirm Rejection'}
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedBatchForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Adjust Stock (Batch {selectedBatchForAdjust.batchNumber})</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded text-slate-600 dark:text-slate-300 space-y-1">
                <div>Product: <span className="font-bold">{selectedBatchForAdjust.productName}</span></div>
                <div>Current Stock: <span className="font-mono font-bold">{selectedBatchForAdjust.currentStockQuantity} units</span></div>
                <div>Expiry: <span className="font-mono">{selectedBatchForAdjust.expiryDate}</span></div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="ADJUSTMENT_IN">Adjustment IN (Stock Increase / Correction)</option>
                  <option value="ADJUSTMENT_OUT">Adjustment OUT (Stock Decrease / Correction)</option>
                  <option value="EXPIRED_DISCARD">Discard Expired Stock</option>
                  <option value="DAMAGED_WRITE_OFF">Write Off Damaged Stock</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">New Absolute Stock Quantity *</label>
                <input
                  type="number"
                  min="0"
                  value={newStockQuantity}
                  onChange={(e) => setNewStockQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Mandatory Audit Reason *</label>
                <textarea
                  placeholder="State reason for physical stock count mismatch, damage, or discard..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Confirm Adjustment
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsAdjustModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
