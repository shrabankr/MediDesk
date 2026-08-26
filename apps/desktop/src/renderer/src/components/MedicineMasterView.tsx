import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Plus,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser, DosageForm } from '@medidesk/shared';

interface MedicineMasterViewProps {
  currentUser: SessionUser;
  onBack?: () => void;
}

export const MedicineMasterView: React.FC<MedicineMasterViewProps> = ({ currentUser, onBack }) => {
  const orgId = currentUser.organizationId;
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'GENERICS' | 'MANUFACTURERS'>('PRODUCTS');

  // Lists
  const [products, setProducts] = useState<any[]>([]);
  const [generics, setGenerics] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [isMfgModalOpen, setIsMfgModalOpen] = useState(false);

  // Form States
  const [brandName, setBrandName] = useState('');
  const [selectedGenericId, setSelectedGenericId] = useState('');
  const [selectedMfgId, setSelectedMfgId] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState<DosageForm>('TABLET');
  const [packSize, setPackSize] = useState('10 Tablets / Strip');
  const [packQuantity, setPackQuantity] = useState(10);
  const [barcode, setBarcode] = useState('');
  const [hsnCode, setHsnCode] = useState('30049060');
  const [taxRatePercent, setTaxRatePercent] = useState(12);
  const [minStockLevel, setMinStockLevel] = useState(10);

  // Generic Form
  const [genericName, setGenericName] = useState('');
  const [therapeuticClass, setTherapeuticClass] = useState('');
  const [scheduleCategory, setScheduleCategory] = useState<'GENERAL' | 'H' | 'H1' | 'X'>('GENERAL');
  const [isRxRequired, setIsRxRequired] = useState(false);

  // Manufacturer Form
  const [mfgName, setMfgName] = useState('');
  const [mfgCode, setMfgCode] = useState('');
  const [mfgCountry, setMfgCountry] = useState('India');

  // Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    setLoading(true);
    try {
      const [prodRes, genRes, mfgRes] = await Promise.all([
        window.mediDeskBridge.searchProducts(searchQuery, sessionToken, 100),
        window.mediDeskBridge.searchMedicines('', sessionToken, 100),
        window.mediDeskBridge.listManufacturers(sessionToken)
      ]);

      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (genRes.success && genRes.data) setGenerics(genRes.data);
      if (mfgRes.success && mfgRes.data) setManufacturers(mfgRes.data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sessionToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Create Product SKU
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || !selectedGenericId || !strength.trim()) {
      setErrorMsg('Brand name, generic molecule, and strength are required.');
      return;
    }
    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.createProduct({
        organizationId: orgId,
        medicineId: selectedGenericId,
        manufacturerId: selectedMfgId || undefined,
        brandName: brandName.trim(),
        strength: strength.trim(),
        dosageForm,
        packSize: packSize.trim(),
        packQuantity,
        barcode: barcode.trim() || undefined,
        hsnCode: hsnCode.trim() || undefined,
        taxRatePercent,
        minStockLevel
      }, sessionToken);

      if (res.success && res.data) {
        setIsProductModalOpen(false);
        setSuccessMsg(`Product SKU "${res.data.brandName}" created successfully.`);
        setBrandName('');
        setStrength('');
        setBarcode('');
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to create product.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Create Generic Medicine
  const handleCreateGeneric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genericName.trim()) {
      setErrorMsg('Generic chemical name is required.');
      return;
    }
    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.createMedicine({
        organizationId: orgId,
        genericName: genericName.trim(),
        therapeuticClass: therapeuticClass.trim() || undefined,
        scheduleCategory,
        isPrescriptionRequired: isRxRequired
      }, sessionToken);

      if (res.success && res.data) {
        setIsGenericModalOpen(false);
        setSuccessMsg(`Generic medicine "${res.data.genericName}" registered.`);
        setGenericName('');
        setTherapeuticClass('');
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to create generic medicine.');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // Create Manufacturer
  const handleCreateMfg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfgName.trim()) {
      setErrorMsg('Manufacturer name is required.');
      return;
    }
    try {
      if (!window.mediDeskBridge) return;
      const res = await window.mediDeskBridge.createManufacturer({
        organizationId: orgId,
        name: mfgName.trim(),
        code: mfgCode.trim() || undefined,
        country: mfgCountry.trim() || 'India'
      }, sessionToken);

      if (res.success && res.data) {
        setIsMfgModalOpen(false);
        setSuccessMsg(`Manufacturer "${res.data.name}" added.`);
        setMfgName('');
        setMfgCode('');
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to add manufacturer.');
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
              <Pill className="h-6 w-6 text-blue-600" />
              Medicine Master & Product Catalog
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage product variants, generic chemical formulas, pack sizes, barcodes, HSN & GST
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'PRODUCTS' && (
            <Button variant="primary" size="sm" onClick={() => setIsProductModalOpen(true)} className="text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Product SKU
            </Button>
          )}
          {activeTab === 'GENERICS' && (
            <Button variant="primary" size="sm" onClick={() => setIsGenericModalOpen(true)} className="text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Generic Entity
            </Button>
          )}
          {activeTab === 'MANUFACTURERS' && (
            <Button variant="primary" size="sm" onClick={() => setIsMfgModalOpen(true)} className="text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Manufacturer
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
          onClick={() => setActiveTab('PRODUCTS')}
          className={`pb-2 border-b-2 ${
            activeTab === 'PRODUCTS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Product Variants / SKUs ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('GENERICS')}
          className={`pb-2 border-b-2 ${
            activeTab === 'GENERICS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Generic Medicines ({generics.length})
        </button>
        <button
          onClick={() => setActiveTab('MANUFACTURERS')}
          className={`pb-2 border-b-2 ${
            activeTab === 'MANUFACTURERS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Manufacturers ({manufacturers.length})
        </button>
      </div>

      {/* Search Input */}
      {activeTab === 'PRODUCTS' && (
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by brand, barcode, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>
      )}

      {/* Tab 1: Product Variants Table */}
      {activeTab === 'PRODUCTS' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Brand Name</th>
                  <th className="p-2.5">Strength / Form</th>
                  <th className="p-2.5">Pack Size</th>
                  <th className="p-2.5">Barcode / HSN</th>
                  <th className="p-2.5">GST Rate</th>
                  <th className="p-2.5">Min Stock</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                      No products found. Add your first medicine SKU using the button above.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                        {p.brandName}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">
                        {p.strength} • <Badge variant="outline" className="text-[10px]">{p.dosageForm}</Badge>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{p.packSize} ({p.packQuantity} units)</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">
                        {p.barcode || '—'} {p.hsnCode && <span className="text-slate-400">| HSN:{p.hsnCode}</span>}
                      </td>
                      <td className="p-2.5 font-mono font-semibold">{p.taxRatePercent}%</td>
                      <td className="p-2.5 font-mono">{p.minStockLevel}</td>
                      <td className="p-2.5 text-right">
                        <Badge variant={p.isActive ? 'success' : 'secondary'} className="text-[10px]">
                          {p.isActive ? 'ACTIVE' : 'INACTIVE'}
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

      {/* Tab 2: Generic Medicines Table */}
      {activeTab === 'GENERICS' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Generic Molecule Name</th>
                  <th className="p-2.5">Therapeutic Class</th>
                  <th className="p-2.5">Schedule</th>
                  <th className="p-2.5">Prescription Req.</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {generics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      No generic medicines registered yet.
                    </td>
                  </tr>
                ) : (
                  generics.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{g.genericName}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{g.therapeuticClass || '—'}</td>
                      <td className="p-2.5">
                        <Badge variant={g.scheduleCategory !== 'GENERAL' ? 'warning' : 'outline'} className="text-[10px]">
                          Schedule {g.scheduleCategory}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        {g.isPrescriptionRequired ? (
                          <span className="text-rose-600 font-bold">Yes (Rx Only)</span>
                        ) : (
                          <span className="text-emerald-600">OTC</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <Badge variant={g.isActive ? 'success' : 'secondary'} className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Manufacturers Table */}
      {activeTab === 'MANUFACTURERS' && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="p-2.5">Manufacturer Name</th>
                  <th className="p-2.5">Short Code</th>
                  <th className="p-2.5">Country</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {manufacturers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                      No manufacturers added yet.
                    </td>
                  </tr>
                ) : (
                  manufacturers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{m.name}</td>
                      <td className="p-2.5 font-mono text-slate-500">{m.code || '—'}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{m.country}</td>
                      <td className="p-2.5 text-right">
                        <Badge variant={m.isActive ? 'success' : 'secondary'} className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Add Product SKU */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Add New Product Variant (SKU)</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dolo 650, Augmentin 625"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Generic Molecule *</label>
                  <select
                    value={selectedGenericId}
                    onChange={(e) => setSelectedGenericId(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    required
                  >
                    <option value="">Select Generic...</option>
                    {generics.map((g) => (
                      <option key={g.id} value={g.id}>{g.genericName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Manufacturer</label>
                  <select
                    value={selectedMfgId}
                    onChange={(e) => setSelectedMfgId(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">Select Manufacturer (Optional)...</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Strength *</label>
                  <input
                    type="text"
                    placeholder="e.g. 650mg, 500mg, 5ml"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Dosage Form</label>
                  <select
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value as DosageForm)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="SYRUP">Syrup</option>
                    <option value="INJECTION">Injection</option>
                    <option value="DROPS">Drops</option>
                    <option value="OINTMENT">Ointment</option>
                    <option value="INHALER">Inhaler</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Pack Size Label</label>
                  <input
                    type="text"
                    placeholder="e.g. 15 Tablets / Strip"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Base Units per Pack</label>
                  <input
                    type="number"
                    min="1"
                    value={packQuantity}
                    onChange={(e) => setPackQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="EAN/UPC Code"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 30049060"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Min Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Save Product SKU
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Generic Medicine */}
      {isGenericModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Register Generic Chemical Entity</h3>
              <button onClick={() => setIsGenericModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateGeneric} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Generic Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol, Amoxicillin"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Therapeutic Class</label>
                <input
                  type="text"
                  placeholder="e.g. Analgesic, Antibiotic"
                  value={therapeuticClass}
                  onChange={(e) => setTherapeuticClass(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Drug Schedule Category</label>
                <select
                  value={scheduleCategory}
                  onChange={(e) => setScheduleCategory(e.target.value as any)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="GENERAL">General (Non-Scheduled)</option>
                  <option value="H">Schedule H (Prescription Only)</option>
                  <option value="H1">Schedule H1 (High-Risk Antibiotics)</option>
                  <option value="X">Schedule X (Narcotic/Psychotropic)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rxReq"
                  checked={isRxRequired}
                  onChange={(e) => setIsRxRequired(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="rxReq" className="font-semibold">Prescription Mandatory for Dispensing</label>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Save Generic Entity
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsGenericModalOpen(false)} className="flex-1 text-xs h-9">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Manufacturer */}
      {isMfgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Add Manufacturer</h3>
              <button onClick={() => setIsMfgModalOpen(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateMfg} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Manufacturer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Micro Labs, Cipla, Sun Pharma"
                  value={mfgName}
                  onChange={(e) => setMfgName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Short Code</label>
                <input
                  type="text"
                  placeholder="e.g. ML, CIPLA"
                  value={mfgCode}
                  onChange={(e) => setMfgCode(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Country</label>
                <input
                  type="text"
                  value={mfgCountry}
                  onChange={(e) => setMfgCountry(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="primary" type="submit" className="flex-1 text-xs h-9">
                  Save Manufacturer
                </Button>
                <Button variant="outline" type="button" onClick={() => setIsMfgModalOpen(false)} className="flex-1 text-xs h-9">
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
