import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/shared';

interface PurchaseManagementViewProps {
  currentUser: SessionUser;
  onBack?: () => void;
}

interface InwardItemInput {
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  packQuantity: number;
  freePackQuantity: number;
  packSizeMultiplier: number;
  purchaseRatePerPack: number;
  mrpPerUnit: number;
  salePricePerUnit: number;
  taxRatePercent: number;
}

export const PurchaseManagementView: React.FC<PurchaseManagementViewProps> = ({ currentUser, onBack }) => {
  const orgId = currentUser.organizationId;
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  const [activeTab, setActiveTab] = useState<'INVOICES' | 'SUPPLIERS'>('INVOICES');

  // Lists
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Inward Purchase Form / Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [discountAmount, _setDiscountAmount] = useState(0);
  const [purchaseNotes, _setPurchaseNotes] = useState('');
  const [items, setItems] = useState<InwardItemInput[]>([]);

  // Item builder inside modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [itemBatchNumber, setItemBatchNumber] = useState('');
  const [itemExpiryDate, setItemExpiryDate] = useState('');
  const [itemPackQty, setItemPackQty] = useState(1);
  const [itemFreePackQty, setItemFreePackQty] = useState(0);
  const [itemPurchaseRate, setItemPurchaseRate] = useState(100);
  const [itemMrp, setItemMrp] = useState(15);
  const [itemSalePrice, _setItemSalePrice] = useState(14);

  // Supplier Form / Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierDl, setSupplierDl] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');

  // Status
  const [_loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const [purRes, supRes, prodRes] = await Promise.all([
        window.mediDeskBridge.listPurchases(sessionToken, 50, 0),
        window.mediDeskBridge.listSuppliers(sessionToken, 100),
        window.mediDeskBridge.searchProducts('', sessionToken, 100)
      ]);

      if (purRes.success && purRes.data) setPurchases(purRes.data);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Add Item to Inward Invoice Draft
  const handleAddItemToInvoice = () => {
    if (!selectedProduct) {
      setErrorMsg('Please select a medicine product variant.');
      return;
    }
    if (!itemBatchNumber.trim() || !itemExpiryDate.trim()) {
      setErrorMsg('Batch number and expiry date are required.');
      return;
    }
    if (itemPackQty <= 0) {
      setErrorMsg('Pack quantity must be > 0.');
      return;
    }

    const newItem: InwardItemInput = {
      productId: selectedProduct.id,
      productName: selectedProduct.brandName,
      batchNumber: itemBatchNumber.trim().toUpperCase(),
      expiryDate: itemExpiryDate.trim(),
      packQuantity: itemPackQty,
      freePackQuantity: itemFreePackQty,
      packSizeMultiplier: selectedProduct.packQuantity || 10,
      purchaseRatePerPack: itemPurchaseRate,
      mrpPerUnit: itemMrp,
      salePricePerUnit: itemSalePrice,
      taxRatePercent: selectedProduct.taxRatePercent ?? 12
    };

    setItems([...items, newItem]);
    setSelectedProduct(null);
    setItemBatchNumber('');
    setItemExpiryDate('');
    setItemPackQty(1);
    setItemFreePackQty(0);
    setErrorMsg(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Submit Inward Purchase Invoice
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !invoiceNumber.trim()) {
      setErrorMsg('Supplier and invoice number are required.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('At least one inward item must be added.');
      return;
    }

    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.createPurchase({
        organizationId: orgId,
        supplierId: selectedSupplierId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        discountAmount,
        notes: purchaseNotes.trim() || undefined,
        items
      }, sessionToken);

      if (res.success && res.data) {
        setIsPurchaseModalOpen(false);
        setSuccessMsg(`Purchase invoice #${res.data.invoiceNumber} inwarded successfully.`);
        setInvoiceNumber('');
        setItems([]);
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to save purchase invoice.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }

    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.createSupplier({
        organizationId: orgId,
        name: supplierName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: supplierPhone.trim() || undefined,
        email: supplierEmail.trim() || undefined,
        gstin: supplierGstin.trim() || undefined,
        drugLicenseNumber: supplierDl.trim() || undefined,
        address: supplierAddress.trim() || undefined
      }, sessionToken);

      if (res.success && res.data) {
        setIsSupplierModalOpen(false);
        setSuccessMsg(`Supplier "${res.data.name}" added successfully.`);
        setSupplierName('');
        setSupplierPhone('');
        setSupplierGstin('');
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to add supplier.');
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
              <Truck className="h-6 w-6 text-teal-600" />
              Purchase Inward & Supplier Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Receive inward supplier invoices, automatically calculate base units and generate batch inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'INVOICES' && (
            <Button variant="primary" size="sm" onClick={() => setIsPurchaseModalOpen(true)} className="text-xs bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Inward Purchase Invoice
            </Button>
          )}
          {activeTab === 'SUPPLIERS' && (
            <Button variant="primary" size="sm" onClick={() => setIsSupplierModalOpen(true)} className="text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Supplier
            </Button>
          )}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-2 border-b-2 ${
            activeTab === 'INVOICES'
              ? 'border-teal-600 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Inward Purchase Invoices ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`pb-2 border-b-2 ${
            activeTab === 'SUPPLIERS'
              ? 'border-teal-600 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Suppliers Master ({suppliers.length})
        </button>
      </div>

      {/* Tab 1: Inward Purchase Invoices */}
      {activeTab === 'INVOICES' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Invoice #</th>
                  <th className="p-2.5">Supplier</th>
                  <th className="p-2.5">Invoice Date</th>
                  <th className="p-2.5 text-center">Items</th>
                  <th className="p-2.5 text-right">Gross (₹)</th>
                  <th className="p-2.5 text-right">GST (₹)</th>
                  <th className="p-2.5 text-right">Net Total (₹)</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                      No purchase invoices recorded yet. Click "Inward Purchase Invoice" to receive stock.
                    </td>
                  </tr>
                ) : (
                  purchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold font-mono text-slate-800 dark:text-slate-200">{pur.invoiceNumber}</td>
                      <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{pur.supplierName}</td>
                      <td className="p-2.5 text-slate-500">{pur.invoiceDate}</td>
                      <td className="p-2.5 text-center font-mono">{pur.items?.length || 0}</td>
                      <td className="p-2.5 text-right font-mono">₹{pur.grossAmount.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">₹{pur.taxAmount.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">₹{pur.netTotal.toFixed(2)}</td>
                      <td className="p-2.5 text-right">
                        <Badge variant={pur.status === 'RECEIVED' ? 'success' : 'danger'} className="text-[10px]">
                          {pur.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Suppliers Master */}
      {activeTab === 'SUPPLIERS' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Supplier Name</th>
                  <th className="p-2.5">Contact Person</th>
                  <th className="p-2.5">Phone / Email</th>
                  <th className="p-2.5">GSTIN / Drug License</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      No suppliers registered yet. Add a supplier to begin inwarding stock.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{s.name}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{s.contactPerson || '—'}</td>
                      <td className="p-2.5 text-slate-500">{s.phone || '—'} {s.email && `• ${s.email}`}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">
                        {s.gstin || '—'} {s.drugLicenseNumber && `| DL: ${s.drugLicenseNumber}`}
                      </td>
                      <td className="p-2.5 text-right">
                        <Badge variant={s.isActive ? 'success' : 'secondary'} className="text-[10px]">
                          {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Inward Purchase Invoice Entry */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-600" />
                Inward Purchase Invoice Entry
              </h3>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Supplier *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    required
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-981"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Item Builder Box */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-700 dark:text-slate-300">Add Inward Item</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold block mb-1">Medicine Product SKU</label>
                    <select
                      value={selectedProduct?.id || ''}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        setSelectedProduct(prod || null);
                      }}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.brandName} ({p.strength} - {p.packSize})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Batch Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. BT-998"
                      value={itemBatchNumber}
                      onChange={(e) => setItemBatchNumber(e.target.value)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Expiry Date (YYYY-MM-DD) *</label>
                    <input
                      type="date"
                      value={itemExpiryDate}
                      onChange={(e) => setItemExpiryDate(e.target.value)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Pack Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={itemPackQty}
                      onChange={(e) => setItemPackQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Free Packs</label>
                    <input
                      type="number"
                      min="0"
                      value={itemFreePackQty}
                      onChange={(e) => setItemFreePackQty(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Rate per Pack (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={itemPurchaseRate}
                      onChange={(e) => setItemPurchaseRate(parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold block mb-1">MRP per Unit (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={itemMrp}
                      onChange={(e) => setItemMrp(parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="text-right pt-2">
                  <Button type="button" variant="primary" size="sm" onClick={handleAddItemToInvoice} className="text-xs h-7">
                    + Add Line Item
                  </Button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b">
                      <th className="p-2">Product</th>
                      <th className="p-2">Batch</th>
                      <th className="p-2">Expiry</th>
                      <th className="p-2 text-center">Packs (Free)</th>
                      <th className="p-2 text-right">Pack Rate (₹)</th>
                      <th className="p-2 text-right">Unit MRP (₹)</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400 italic">No line items added yet.</td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2 font-semibold">{it.productName}</td>
                          <td className="p-2 font-mono">{it.batchNumber}</td>
                          <td className="p-2 font-mono">{it.expiryDate}</td>
                          <td className="p-2 text-center font-mono">{it.packQuantity} {it.freePackQuantity > 0 && `(+${it.freePackQuantity})`}</td>
                          <td className="p-2 text-right font-mono">₹{it.purchaseRatePerPack}</td>
                          <td className="p-2 text-right font-mono">₹{it.mrpPerUnit}</td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-500 font-bold px-1">×</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" disabled={items.length === 0} className="flex-1 text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white">
                  Confirm Inward & Post to Inventory
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsPurchaseModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Add New Supplier</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Supplier Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Apollo Pharma Distributors"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Rajesh Sharma"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Phone</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="15-digit GSTIN"
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Drug License Number</label>
                  <input
                    type="text"
                    placeholder="DL No."
                    value={supplierDl}
                    onChange={(e) => setSupplierDl(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Address</label>
                <textarea
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Save Supplier
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsSupplierModalOpen(false)} className="flex-1 text-xs h-9">
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
