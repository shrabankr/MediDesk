import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Trash2,
  Receipt,
  User,
  Printer,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/shared';

interface PharmacyPOSViewProps {
  currentUser: SessionUser;
  onBack?: () => void;
}

interface CartItem {
  productId: string;
  brandName: string;
  strength: string;
  dosageForm: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  availableStock: number;
  quantity: number;
  unitSalePrice: number;
  unitMrp: number;
  taxRatePercent: number;
  discountAmount: number;
  lineTax: number;
  lineTotal: number;
}

export const PharmacyPOSView: React.FC<PharmacyPOSViewProps> = ({ currentUser, onBack }) => {
  const orgId = currentUser.organizationId;
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  // Search & Scanner
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');

  // Customer / Patient Info
  const [customerType, setCustomerType] = useState<'WALK_IN' | 'PATIENT'>('WALK_IN');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);

  // Prescription Import Modal
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([]);

  // Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search products on query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!window.mediDeskBridge) return;
        const res = await window.mediDeskBridge.searchProducts(searchQuery, sessionToken, 10);
        if (res.success && res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, sessionToken]);

  // Handle Barcode Scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.getProductByBarcode(barcodeInput.trim(), sessionToken);
      if (res.success && res.data) {
        handleSelectProduct(res.data);
        setBarcodeInput('');
      } else {
        setErrorMsg(`No product found for barcode: ${barcodeInput}`);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Select Product and load FEFO batches
  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setSearchQuery('');
    setSearchResults([]);
    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.getInventoryBatches(product.id, sessionToken);
      if (res.success && res.data) {
        const today = new Date().toISOString().split('T')[0];
        // Filter out expired batches and batches with 0 stock
        const validBatches = res.data.filter((b: any) => b.expiryDate >= today && b.currentStockQuantity > 0);
        // Sort FEFO (earliest expiry first)
        validBatches.sort((a: any, b: any) => a.expiryDate.localeCompare(b.expiryDate));
        setProductBatches(validBatches);
        if (validBatches.length > 0) {
          setSelectedBatchId(validBatches[0].id);
        } else {
          setSelectedBatchId('');
        }
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!selectedProduct || !selectedBatchId) {
      setErrorMsg('Please select an active product and valid batch.');
      return;
    }
    const batch = productBatches.find((b) => b.id === selectedBatchId);
    if (!batch) {
      setErrorMsg('Batch not found.');
      return;
    }
    if (inputQuantity <= 0) {
      setErrorMsg('Quantity must be greater than zero.');
      return;
    }
    if (inputQuantity > batch.currentStockQuantity) {
      setErrorMsg(`Cannot add ${inputQuantity}. Available stock in batch ${batch.batchNumber} is only ${batch.currentStockQuantity}.`);
      return;
    }

    const unitSalePrice = batch.salePricePerUnit;
    const taxable = unitSalePrice * inputQuantity;
    const taxRate = selectedProduct.taxRatePercent ?? 0;
    const lineTax = (taxable * taxRate) / 100;
    const lineTotal = taxable + lineTax;

    const newItem: CartItem = {
      productId: selectedProduct.id,
      brandName: selectedProduct.brandName,
      strength: selectedProduct.strength,
      dosageForm: selectedProduct.dosageForm,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      availableStock: batch.currentStockQuantity,
      quantity: inputQuantity,
      unitSalePrice,
      unitMrp: batch.mrpPerUnit,
      taxRatePercent: taxRate,
      discountAmount: 0,
      lineTax,
      lineTotal
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    setProductBatches([]);
    setSelectedBatchId('');
    setInputQuantity(1);
    setErrorMsg(null);
    barcodeInputRef.current?.focus();
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Search Patients
  useEffect(() => {
    if (customerType !== 'PATIENT' || !patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (!window.mediDeskBridge) return;
        const res = await window.mediDeskBridge.searchPatients({ organizationId: orgId, query: patientSearch }, sessionToken);
        if (res.success && res.data) {
          setPatientResults(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [patientSearch, customerType, orgId, sessionToken]);

  const handleSelectPatient = (p: any) => {
    setSelectedPatientId(p.id);
    setCustomerName(p.fullName);
    setCustomerPhone(p.mobile || '');
    setPatientSearch('');
    setPatientResults([]);
  };

  // Load Patient Prescriptions for Import
  const handleOpenRxModal = async () => {
    if (!selectedPatientId || !window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.listPrescriptionsByPatient(selectedPatientId, orgId, sessionToken);
      if (res.success && res.data) {
        // Only active/signed prescriptions
        setPatientPrescriptions(res.data.filter((rx: any) => rx.status === 'SIGNED' || rx.status === 'DRAFT'));
        setIsRxModalOpen(true);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleImportRx = async (rxId: string) => {
    if (!window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.matchPrescriptionItems(rxId, sessionToken);
      if (res.success && res.data) {
        const importedItems: CartItem[] = [];
        for (const m of res.data) {
          if (m.matchedProduct && m.suggestedFefoBatch) {
            const qty = m.prescriptionItem.quantity || 10;
            const b = m.suggestedFefoBatch;
            const unitPrice = b.salePricePerUnit;
            const taxable = unitPrice * qty;
            const taxRate = m.matchedProduct.taxRatePercent ?? 0;
            const lineTax = (taxable * taxRate) / 100;
            importedItems.push({
              productId: m.matchedProduct.id,
              brandName: m.matchedProduct.brandName,
              strength: m.matchedProduct.strength,
              dosageForm: m.matchedProduct.dosageForm,
              batchId: b.id,
              batchNumber: b.batchNumber,
              expiryDate: b.expiryDate,
              availableStock: b.currentStockQuantity,
              quantity: qty,
              unitSalePrice: unitPrice,
              unitMrp: b.mrpPerUnit,
              taxRatePercent: taxRate,
              discountAmount: 0,
              lineTax,
              lineTotal: taxable + lineTax
            });
          }
        }
        setCart([...cart, ...importedItems]);
        setSelectedPrescriptionId(rxId);
        setIsRxModalOpen(false);
        setSuccessMsg(`Imported ${importedItems.length} items from prescription.`);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Calculations
  const grossTotal = cart.reduce((acc, item) => acc + item.unitSalePrice * item.quantity, 0);
  const taxTotal = cart.reduce((acc, item) => acc + item.lineTax, 0);
  const subTotal = grossTotal + taxTotal - billDiscount;
  const roundOff = Math.round(subTotal) - subTotal;
  const netPayable = Math.round(subTotal);

  // Checkout / Create Sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Please add items to checkout.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (!window.mediDeskBridge) return;
      const salePayload = {
        organizationId: orgId,
        customerType,
        patientId: selectedPatientId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        prescribingDoctorName: doctorName.trim() || undefined,
        prescriptionId: selectedPrescriptionId || undefined,
        discountAmount: billDiscount,
        paymentMode,
        items: cart.map((i) => ({
          productId: i.productId,
          batchId: i.batchId,
          quantity: i.quantity,
          unitSalePrice: i.unitSalePrice,
          discountAmount: i.discountAmount
        }))
      };

      const res = await window.mediDeskBridge.createSale(salePayload, sessionToken);
      if (res.success && res.data) {
        setCompletedSale(res.data);
        setIsReceiptModalOpen(true);
        // Reset Cart
        setCart([]);
        setBillDiscount(0);
        setCustomerName('Walk-in Customer');
        setCustomerPhone('');
        setSelectedPatientId(null);
        setCustomerType('WALK_IN');
        setDoctorName('');
        setSelectedPrescriptionId(null);
        setSuccessMsg(`Bill #${res.data.billNumber} created successfully!`);
      } else {
        setErrorMsg(res.error?.message || 'Sale checkout failed.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
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
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
              Pharmacy Point of Sale (POS) & Billing
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fast keyboard/barcode dispensing, FEFO batch allocation, offline billing, GST compliant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300">
            ● Offline POS Active
          </Badge>
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

      {/* Main Grid: Left Scanner/Cart & Right Customer/Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Search, Product Selector, Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barcode & Fast Search Card */}
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Barcode Scanner Input */}
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Barcode Scanner
                </label>
                <div className="relative">
                  <Barcode className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan Barcode & Press Enter..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </form>

              {/* Medicine Name / Generic Search */}
              <div className="relative">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Medicine Name / Brand / Generic
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type name (e.g. Dolo, Paracetamol)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {searchResults.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectProduct(prod)}
                        className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{prod.brandName}</span>
                          <span className="text-slate-500 ml-1">({prod.strength} • {prod.dosageForm})</span>
                          <div className="text-[10px] text-slate-400 font-mono">Pack: {prod.packSize}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">Select</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Product FEFO Batch Picker Bar */}
            {selectedProduct && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                      {selectedProduct.brandName} ({selectedProduct.strength} - {selectedProduct.dosageForm})
                    </span>
                    <Badge variant="outline" className="text-[10px]">Pack: {selectedProduct.packSize}</Badge>
                    <Badge variant="outline" className="text-[10px]">GST: {selectedProduct.taxRatePercent}%</Badge>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">Cancel</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end pt-1">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Available Batches (Sorted FEFO)
                    </label>
                    {productBatches.length === 0 ? (
                      <span className="text-xs text-rose-600 font-semibold block p-1">No active unexpired stock available!</span>
                    ) : (
                      <select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="w-full text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                      >
                        {productBatches.map((b) => (
                          <option key={b.id} value={b.id}>
                            Batch: {b.batchNumber} | Exp: {b.expiryDate} | Stock: {b.currentStockQuantity} | Rate: ₹{b.salePricePerUnit}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={inputQuantity}
                      onChange={(e) => setInputQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-mono"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={productBatches.length === 0}
                    onClick={handleAddToCart}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add to Cart
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Cart Table Card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Cart Items ({cart.length})
                </h2>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear Cart
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                    <th className="p-2 font-semibold">#</th>
                    <th className="p-2 font-semibold">Medicine</th>
                    <th className="p-2 font-semibold">Batch</th>
                    <th className="p-2 font-semibold">Expiry</th>
                    <th className="p-2 font-semibold text-center">Qty</th>
                    <th className="p-2 font-semibold text-right">Price (₹)</th>
                    <th className="p-2 font-semibold text-right">Tax</th>
                    <th className="p-2 font-semibold text-right">Total (₹)</th>
                    <th className="p-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        Cart is empty. Scan a barcode or search medicines above to begin.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={`${item.productId}-${item.batchId}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                          {item.brandName}
                          <span className="text-[10px] text-slate-400 ml-1">({item.strength} • {item.dosageForm})</span>
                        </td>
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{item.batchNumber}</td>
                        <td className="p-2 text-slate-500">{item.expiryDate}</td>
                        <td className="p-2 text-center font-mono font-bold">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">₹{item.unitSalePrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-slate-500">₹{item.lineTax.toFixed(2)} ({item.taxRatePercent}%)</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">₹{item.lineTotal.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleRemoveFromCart(idx)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold px-1"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Customer Details, Totals & Checkout */}
        <div className="space-y-4">
          {/* Customer & Prescription Card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Customer & Patient Reference
                </h3>
              </div>
            </div>

            {/* Toggle: Walk-in vs Patient */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setCustomerType('WALK_IN');
                  setSelectedPatientId(null);
                  setCustomerName('Walk-in Customer');
                }}
                className={`flex-1 py-1 text-xs font-semibold rounded ${
                  customerType === 'WALK_IN' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Walk-In Customer
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('PATIENT')}
                className={`flex-1 py-1 text-xs font-semibold rounded ${
                  customerType === 'PATIENT' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Clinic Patient
              </button>
            </div>

            {/* Patient Search */}
            {customerType === 'PATIENT' && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search patient by name or phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  {patientResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-36 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-700/50 flex justify-between"
                        >
                          <span className="font-bold">{p.fullName}</span>
                          <span className="text-slate-400">{p.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedPatientId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenRxModal}
                    className="w-full text-xs h-7 flex items-center justify-center gap-1 text-blue-600 border-blue-200"
                  >
                    <FileText className="h-3.5 w-3.5" /> Import Prescriptions
                  </Button>
                )}
              </div>
            )}

            {/* Customer Name & Phone Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Customer Phone</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Prescribing Doctor</label>
              <input
                type="text"
                placeholder="Dr. Name (Optional)"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </Card>

          {/* Payment & Totals Card */}
          <Card className="p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Payment & Bill Breakdown
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Amount</span>
                <span className="font-mono">₹{grossTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total GST</span>
                <span className="font-mono">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Bill Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 text-right text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Round Off</span>
                <span className="font-mono">₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-base font-bold text-slate-900 dark:text-white">
                <span>Net Payable</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{netPayable.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">Payment Mode</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH', 'UPI', 'CARD'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-1.5 text-xs font-bold rounded border ${
                      paymentMode === mode
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              disabled={loading || cart.length === 0}
              onClick={handleCheckout}
              className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
            >
              <Receipt className="h-4 w-4" />
              {loading ? 'Processing Sale...' : `Complete Sale (₹${netPayable})`}
            </Button>
          </Card>
        </div>
      </div>

      {/* Prescription Import Modal */}
      {isRxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Select Prescription to Dispense
              </h3>
              <button onClick={() => setIsRxModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <div className="space-y-3">
              {patientPrescriptions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No active prescriptions found for this patient.</p>
              ) : (
                patientPrescriptions.map((rx) => (
                  <div key={rx.id} className="p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs">v{rx.currentVersionNumber} • {new Date(rx.createdAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{rx.currentVersion?.items?.length || 0} medication items</div>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleImportRx(rx.id)} className="text-xs h-7">
                      Import Items
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {isReceiptModalOpen && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1 border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">PHARMACY RECEIPT</h2>
              <div className="text-xs font-mono font-bold text-emerald-600">{completedSale.billNumber}</div>
              <div className="text-[11px] text-slate-500">{new Date(completedSale.saleDate).toLocaleString()}</div>
            </div>

            <div className="text-xs space-y-1 border-b pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold">{completedSale.customerName}</span>
              </div>
              {completedSale.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span>{completedSale.customerPhone}</span>
                </div>
              )}
              {completedSale.prescribingDoctorName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Doctor:</span>
                  <span>{completedSale.prescribingDoctorName}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="text-xs space-y-2 border-b pb-3">
              {completedSale.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <div>
                    <div className="font-semibold">{item.productName || 'Medicine Item'}</div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      Batch: {item.batchNumber} • Qty: {item.quantity} × ₹{item.unitSalePrice}
                    </div>
                  </div>
                  <div className="font-mono font-bold">₹{item.totalAmount.toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Gross Amount:</span>
                <span>₹{completedSale.grossAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST:</span>
                <span>₹{completedSale.taxAmount.toFixed(2)}</span>
              </div>
              {completedSale.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-₹{completedSale.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-1 border-t">
                <span>Total Paid ({completedSale.paymentMode}):</span>
                <span>₹{completedSale.netAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                onClick={() => window.print()}
                className="flex-1 text-xs h-9 bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-1"
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setCompletedSale(null);
                }}
                className="flex-1 text-xs h-9"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
