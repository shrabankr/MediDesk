import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  Clock,
  ArrowDownRight,
  Plus,
  RefreshCw,
  TrendingDown,
  History,
  CheckCircle,
  AlertCircle
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

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'EXPIRY' | 'LOW_STOCK' | 'MOVEMENTS'>('BATCHES');

  // Lists
  const [batches, setBatches] = useState<any[]>([]);
  const [expiringSoon30, setExpiringSoon30] = useState<any[]>([]);
  const [expiringSoon90, setExpiringSoon90] = useState<any[]>([]);
  const [expiredList, setExpiredList] = useState<any[]>([]);
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);

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
      const [exp30, exp90, expired, low, movs] = await Promise.all([
        window.mediDeskBridge.getExpiringSoon(30, sessionToken),
        window.mediDeskBridge.getExpiringSoon(90, sessionToken),
        window.mediDeskBridge.getExpiredStock(sessionToken),
        window.mediDeskBridge.getLowStock(sessionToken),
        window.mediDeskBridge.getStockMovements(undefined, sessionToken)
      ]);

      if (exp30.success && exp30.data) setExpiringSoon30(exp30.data);
      if (exp90.success && exp90.data) setExpiringSoon90(exp90.data);
      if (expired.success && expired.data) setExpiredList(expired.data);
      if (low.success && low.data) setLowStockList(low.data);
      if (movs.success && movs.data) setMovementsList(movs.data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

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
            Real-time batch tracking, FEFO management, automated expiry alerts, and immutable stock movement ledger
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
          <History className="h-7 w-7 text-indigo-500" />
          <div>
            <div className="text-xs text-slate-500">Recent Movements</div>
            <div className="text-lg font-bold text-indigo-600 font-mono">{movementsList.length}</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`pb-2 border-b-2 ${
            activeTab === 'BATCHES'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Active Batches ({expiringSoon90.length})
        </button>
        <button
          onClick={() => setActiveTab('EXPIRY')}
          className={`pb-2 border-b-2 ${
            activeTab === 'EXPIRY'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Expiry Alerts ({expiringSoon30.length + expiredList.length})
        </button>
        <button
          onClick={() => setActiveTab('LOW_STOCK')}
          className={`pb-2 border-b-2 ${
            activeTab === 'LOW_STOCK'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Low Stock Alerts ({lowStockList.length})
        </button>
        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-2 border-b-2 ${
            activeTab === 'MOVEMENTS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Stock Movement Ledger ({movementsList.length})
        </button>
      </div>

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
          {/* Expired Batches (Hard Block) */}
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

          {/* Expiring Soon (30 Days) */}
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
