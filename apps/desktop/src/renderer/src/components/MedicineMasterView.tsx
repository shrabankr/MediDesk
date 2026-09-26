import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  Download,
  RefreshCw,
  FlaskConical,
  Building2,
  Package,
  Eye,
  Pencil,
  XCircle,
  X,
  ArrowLeft
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser, DosageForm } from '@medidesk/shared';
import { SearchableSelect } from './common/SearchableSelect.js';
import { DataExportModal, ExportColumn } from './common/DataExportModal.js';

interface MedicineMasterViewProps {
  currentUser: SessionUser;
  onBack?: () => void;
  onNavigate?: (tab: string) => void;
}

export const MedicineMasterView: React.FC<MedicineMasterViewProps> = ({
  currentUser,
  onBack,
  onNavigate
}) => {
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [viewProductDetails, setViewProductDetails] = useState<any | null>(null);

  // Form States (Product SKU)
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

  // Generic Molecule Form
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
        window.mediDeskBridge.searchMedicines('', sessionToken, 200),
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

  // Create Generic Molecule
  const handleCreateGeneric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genericName.trim()) {
      setErrorMsg('Generic molecule name is required.');
      return;
    }

    // Check duplicate
    const existing = generics.find(
      (g) => g.genericName.toLowerCase().trim() === genericName.toLowerCase().trim()
    );
    if (existing) {
      setSelectedGenericId(existing.id);
      setIsGenericModalOpen(false);
      setSuccessMsg(`Selected existing generic molecule "${existing.genericName}".`);
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
        setSuccessMsg(`Generic molecule "${res.data.genericName}" registered.`);
        setSelectedGenericId(res.data.id); // Auto-select in form
        setGenericName('');
        setTherapeuticClass('');
        loadAll();
      } else {
        setErrorMsg(res.error?.message || 'Failed to create generic molecule.');
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

    // Check duplicate
    const existing = manufacturers.find(
      (m) => m.name.toLowerCase().trim() === mfgName.toLowerCase().trim()
    );
    if (existing) {
      setSelectedMfgId(existing.id);
      setIsMfgModalOpen(false);
      setSuccessMsg(`Selected existing manufacturer "${existing.name}".`);
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
        setSelectedMfgId(res.data.id); // Auto-select in form
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

  // Export Columns Definition
  const productExportColumns: ExportColumn[] = [
    { key: 'brandName', header: 'Brand Name' },
    { key: 'strength', header: 'Strength' },
    { key: 'dosageForm', header: 'Dosage Form' },
    { key: 'packSize', header: 'Pack Size' },
    { key: 'packQuantity', header: 'Base Units / Pack' },
    { key: 'barcode', header: 'Barcode / EAN' },
    { key: 'hsnCode', header: 'HSN Code' },
    { key: 'taxRatePercent', header: 'GST Rate (%)', format: (val) => `${val}%` },
    { key: 'minStockLevel', header: 'Min Stock Alert Level' },
    { key: 'isActive', header: 'Status', format: (val) => (val ? 'ACTIVE' : 'INACTIVE') }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header with Icon-First Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack} className="h-8 px-2">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Medicine Master & Product Catalog
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage product variants, generic chemical formulas, pack sizes, barcodes, HSN & GST
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            className="flex items-center gap-1.5 text-xs"
            title="Refresh medicine list"
            aria-label="Refresh medicine list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
            title="Export medicines to CSV or JSON"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>

          {onNavigate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('import')}
              className="flex items-center gap-1.5 text-xs text-blue-600 border-blue-200 dark:border-blue-800 hover:bg-blue-50"
              title="Bulk import medicines from CSV"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Import</span>
            </Button>
          )}

          {activeTab === 'PRODUCTS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Product SKU</span>
            </Button>
          )}
          {activeTab === 'GENERICS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsGenericModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Molecule</span>
            </Button>
          )}
          {activeTab === 'MANUFACTURERS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsMfgModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Company</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded font-bold">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded font-bold">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'PRODUCTS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Pill className="h-4 w-4" />
          <span>Product Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('GENERICS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'GENERICS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          <span>Generic Molecules ({generics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MANUFACTURERS')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'MANUFACTURERS'
              ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Companies & Manufacturers ({manufacturers.length})</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by brand name, molecule, barcode, or HSN code..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        {searchQuery && (
          <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="text-xs">
            Clear
          </Button>
        )}
      </div>

      {/* Tab 1: Product SKUs Table */}
      {activeTab === 'PRODUCTS' && (
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3">Brand Name / Product</th>
                  <th className="p-3">Strength & Form</th>
                  <th className="p-3">Pack Specification</th>
                  <th className="p-3">Barcode / HSN</th>
                  <th className="p-3">GST Rate</th>
                  <th className="p-3">Min Stock</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      No products found. Add your first medicine SKU using the button above.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {p.brandName}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {p.strength} • <Badge variant="outline" className="text-[10px]">{p.dosageForm}</Badge>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{p.packSize} ({p.packQuantity} units)</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {p.barcode || '—'} {p.hsnCode && <span className="text-slate-400">| HSN:{p.hsnCode}</span>}
                      </td>
                      <td className="p-3 font-mono font-semibold">{p.taxRatePercent}%</td>
                      <td className="p-3 font-mono">{p.minStockLevel}</td>
                      <td className="p-3">
                        <Badge variant={p.isActive ? 'success' : 'secondary'} className="text-[10px]">
                          {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewProductDetails(p)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg transition"
                            title="View product details"
                            aria-label="View product details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Generic Molecules Table */}
      {activeTab === 'GENERICS' && (
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3">Generic Molecule Name</th>
                  <th className="p-3">Therapeutic Class</th>
                  <th className="p-3">Drug Schedule</th>
                  <th className="p-3">Prescription Required</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {generics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                      No generic molecules registered yet.
                    </td>
                  </tr>
                ) : (
                  generics.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FlaskConical className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{g.genericName}</span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{g.therapeuticClass || '—'}</td>
                      <td className="p-3">
                        <Badge variant={g.scheduleCategory !== 'GENERAL' ? 'warning' : 'outline'} className="text-[10px]">
                          Schedule {g.scheduleCategory}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {g.isPrescriptionRequired ? (
                          <span className="text-rose-600 font-bold">Yes (Rx Only)</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">OTC (Over the Counter)</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
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
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3">Company / Manufacturer Name</th>
                  <th className="p-3">Short Code</th>
                  <th className="p-3">Country</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {manufacturers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                      No manufacturers added yet.
                    </td>
                  </tr>
                ) : (
                  manufacturers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-teal-500" />
                        <span>{m.name}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{m.code || '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{m.country}</td>
                      <td className="p-3 text-right">
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

      {/* Modal: Add Product SKU with Searchable Selectors */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add New Medicine Product Variant (SKU)</h3>
              </div>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dolo 650, Augmentin 625 Duo, Pan-D"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                {/* Searchable Molecule / Generic Selector */}
                <div>
                  <SearchableSelect
                    label="Generic Molecule"
                    icon={<FlaskConical className="h-3.5 w-3.5 text-indigo-500" />}
                    options={generics.map((g) => ({
                      value: g.id,
                      label: g.genericName,
                      subLabel: g.therapeuticClass,
                      badge: g.scheduleCategory !== 'GENERAL' ? `Sch ${g.scheduleCategory}` : undefined
                    }))}
                    value={selectedGenericId}
                    onChange={setSelectedGenericId}
                    placeholder="Search molecule/salt..."
                    searchPlaceholder="Type chemical name (e.g. Paracetamol)..."
                    onAddNew={() => setIsGenericModalOpen(true)}
                    addNewLabel="Add Molecule"
                    required
                  />
                </div>

                {/* Searchable Manufacturer / Company Selector */}
                <div>
                  <SearchableSelect
                    label="Manufacturer / Company"
                    icon={<Building2 className="h-3.5 w-3.5 text-teal-500" />}
                    options={manufacturers.map((m) => ({
                      value: m.id,
                      label: m.name,
                      subLabel: m.country,
                      badge: m.code
                    }))}
                    value={selectedMfgId}
                    onChange={setSelectedMfgId}
                    placeholder="Search company (optional)..."
                    searchPlaceholder="Type company name (e.g. Micro Labs)..."
                    onAddNew={() => setIsMfgModalOpen(true)}
                    addNewLabel="Add Company"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Strength *</label>
                  <input
                    type="text"
                    placeholder="e.g. 650mg, 500mg, 5ml"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Dosage Form</label>
                  <select
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value as DosageForm)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="SYRUP">Syrup</option>
                    <option value="INJECTION">Injection</option>
                    <option value="DROPS">Drops</option>
                    <option value="OINTMENT">Ointment</option>
                    <option value="CREAM">Cream</option>
                    <option value="GEL">Gel</option>
                    <option value="INHALER">Inhaler</option>
                    <option value="POWDER">Powder</option>
                    <option value="LOTION">Lotion</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Pack Size Label</label>
                  <input
                    type="text"
                    placeholder="e.g. 15 Tablets / Strip"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Base Units per Pack</label>
                  <input
                    type="number"
                    min="1"
                    value={packQuantity}
                    onChange={(e) => setPackQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Barcode / EAN</label>
                  <input
                    type="text"
                    placeholder="8901234567890"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">HSN Tax Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 30049060"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">GST Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Min Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 text-xs">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button variant="primary" type="submit" className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Product SKU</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Generic Molecule */}
      {isGenericModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register Generic Molecule</h3>
              </div>
              <button onClick={() => setIsGenericModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGeneric} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Generic / Chemical Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol, Amoxicillin + Clavulanic Acid"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Therapeutic Class</label>
                <input
                  type="text"
                  placeholder="e.g. Analgesic, Antibiotic, Antipyretic"
                  value={therapeuticClass}
                  onChange={(e) => setTherapeuticClass(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Drug Schedule Category</label>
                <select
                  value={scheduleCategory}
                  onChange={(e) => setScheduleCategory(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="GENERAL">General (Non-Scheduled / OTC)</option>
                  <option value="H">Schedule H (Prescription Mandatory)</option>
                  <option value="H1">Schedule H1 (High-Risk Antibiotics)</option>
                  <option value="X">Schedule X (Narcotic / Psychotropic)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rxReq"
                  checked={isRxRequired}
                  onChange={(e) => setIsRxRequired(e.target.checked)}
                  className="rounded text-blue-600 h-4 w-4"
                />
                <label htmlFor="rxReq" className="font-semibold text-slate-700 dark:text-slate-300">
                  Prescription Mandatory for Dispensing
                </label>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsGenericModalOpen(false)} className="flex-1 text-xs">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Molecule</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Manufacturer */}
      {isMfgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Manufacturer / Company</h3>
              </div>
              <button onClick={() => setIsMfgModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMfg} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Manufacturer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Micro Labs Ltd, Cipla, Sun Pharma"
                  value={mfgName}
                  onChange={(e) => setMfgName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Short Code</label>
                <input
                  type="text"
                  placeholder="e.g. MICRO, CIPLA, SUN"
                  value={mfgCode}
                  onChange={(e) => setMfgCode(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Country</label>
                <input
                  type="text"
                  value={mfgCountry}
                  onChange={(e) => setMfgCountry(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsMfgModalOpen(false)} className="flex-1 text-xs">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" className="flex-1 text-xs bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span>Save Company</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: View Product Details */}
      {viewProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{viewProductDetails.brandName}</h3>
              </div>
              <button onClick={() => setViewProductDetails(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Strength</span>
                <span className="font-semibold">{viewProductDetails.strength}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Dosage Form</span>
                <span className="font-semibold">{viewProductDetails.dosageForm}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Pack Size</span>
                <span className="font-semibold">{viewProductDetails.packSize} ({viewProductDetails.packQuantity} units)</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Barcode / EAN</span>
                <span className="font-mono font-semibold">{viewProductDetails.barcode || '—'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">HSN Code</span>
                <span className="font-mono font-semibold">{viewProductDetails.hsnCode || '—'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 block text-[10px]">GST Rate</span>
                <span className="font-semibold">{viewProductDetails.taxRatePercent}%</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setViewProductDetails(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Export Modal */}
      <DataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Medicine Product Catalog"
        entityName="Medicines"
        data={products}
        columns={productExportColumns}
        currentUser={currentUser}
        defaultFilename={`medicines_catalog_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};
