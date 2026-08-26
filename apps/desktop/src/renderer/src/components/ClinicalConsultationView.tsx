import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  Plus,
  Printer,
  History,
  Lock,
  Activity,
  Heart,
  User,
  Edit3
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import {
  Patient,
  Doctor,
  ClinicalVisit,
  Vitals,
  Allergy,
  MedicalHistory,
  Diagnosis,
  Prescription,
  FollowUp,
  SessionUser,
  DosageForm,
  RouteOfAdministration,
  DurationUnit
} from '@medidesk/shared';

interface ClinicalConsultationViewProps {
  currentUser: SessionUser;
  patientId?: string;
  appointmentId?: string;
  onBack?: () => void;
}

export const ClinicalConsultationView: React.FC<ClinicalConsultationViewProps> = ({
  currentUser,
  patientId: initialPatientId,
  appointmentId: initialAppointmentId,
  onBack
}) => {
  // Navigation & Patient State
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  // Active Visit State
  const [activeVisit, setActiveVisit] = useState<ClinicalVisit | null>(null);
  const [pastVisits, setPastVisits] = useState<ClinicalVisit[]>([]);
  const [vitalsList, setVitalsList] = useState<Vitals[]>([]);
  const [allergiesList, setAllergiesList] = useState<Allergy[]>([]);
  const [_historyList, _setHistoryList] = useState<MedicalHistory[]>([]);
  const [diagnosesList, setDiagnosesList] = useState<Diagnosis[]>([]);
  const [activePrescription, setActivePrescription] = useState<Prescription | null>(null);
  const [followUpsList, setFollowUpsList] = useState<FollowUp[]>([]);

  // Clinical Form Fields
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [historyOfIllness, setHistoryOfIllness] = useState<string>('');
  const [examinationNotes, setExaminationNotes] = useState<string>('');
  const [clinicalAssessment, setClinicalAssessment] = useState<string>('');

  // Vitals Input
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState<boolean>(false);
  const [temp, setTemp] = useState<string>('98.6');
  const [tempUnit, setTempUnit] = useState<'CELSIUS' | 'FAHRENHEIT'>('FAHRENHEIT');
  const [pulse, setPulse] = useState<string>('72');
  const [_respRate, _setRespRate] = useState<string>('16');
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('80');
  const [spo2, setSpo2] = useState<string>('98');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');

  // Allergy Input
  const [isAllergyModalOpen, setIsAllergyModalOpen] = useState<boolean>(false);
  const [allergyStatus, setAllergyStatus] = useState<'KNOWN' | 'DENIED' | 'UNKNOWN'>('KNOWN');
  const [allergenName, setAllergenName] = useState<string>('');
  const [allergySeverity, setAllergySeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING'>('MODERATE');
  const [allergyReaction, setAllergyReaction] = useState<string>('');

  // Diagnosis Input
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState<boolean>(false);
  const [diagnosisText, setDiagnosisText] = useState<string>('');
  const [diagnosisType, setDiagnosisType] = useState<'PRIMARY' | 'SECONDARY' | 'PROVISIONAL' | 'DIFFERENTIAL'>('PRIMARY');

  // Prescription Items Authoring
  const [rxItems, setRxItems] = useState<Array<{
    medicineName: string;
    genericName: string;
    strength: string;
    dosageForm: DosageForm;
    route: RouteOfAdministration;
    frequency: string;
    durationValue: number;
    durationUnit: DurationUnit;
    instructions: string;
    quantity: number;
    isSubstitutionAllowed: boolean;
  }>>([]);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedGeneric, setNewMedGeneric] = useState<string>('');
  const [newMedStrength, setNewMedStrength] = useState<string>('');
  const [newMedForm, setNewMedForm] = useState<DosageForm>('TABLET');
  const [newMedRoute, _setNewMedRoute] = useState<RouteOfAdministration>('ORAL');
  const [newMedFreq, setNewMedFreq] = useState<string>('1-0-1');
  const [newMedDuration, setNewMedDuration] = useState<number>(5);
  const [newMedDurationUnit, setNewMedDurationUnit] = useState<DurationUnit>('DAYS');
  const [newMedInstructions, setNewMedInstructions] = useState<string>('After meals');
  const [newMedQty, _setNewMedQty] = useState<number>(10);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpInstructions, setFollowUpInstructions] = useState<string>('');

  // Revision & Correction Modals
  const [isReviseRxModalOpen, setIsReviseRxModalOpen] = useState<boolean>(false);
  const [rxRevisionReason, setRxRevisionReason] = useState<string>('');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

  const [_loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const sessionToken = sessionStorage.getItem('medidesk_session_token') || localStorage.getItem('medidesk_session_token') || '';
  const orgId = currentUser.organizationId;

  // Load Doctors
  const loadDoctors = useCallback(async () => {
    if (!window.mediDeskBridge) return;
    try {
      const res = await window.mediDeskBridge.listDoctors(orgId, sessionToken, true);
      if (res.success && res.data) {
        setDoctors(res.data);
        if (res.data.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(res.data[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [orgId, sessionToken, selectedDoctorId]);

  // Load Patient Data
  const loadPatientData = useCallback(async (pId: string) => {
    if (!window.mediDeskBridge || !pId) return;
    setLoading(true);
    setError(null);
    try {
      const [patientRes, visitsRes, vitalsRes, allergiesRes, _historyRes, diagRes, rxRes] = await Promise.all([
        window.mediDeskBridge.getPatientById(pId, orgId, sessionToken),
        window.mediDeskBridge.listClinicalVisitsByPatient(pId, orgId, sessionToken),
        window.mediDeskBridge.getVitalsByPatient(pId, orgId, sessionToken),
        window.mediDeskBridge.listAllergiesByPatient(pId, orgId, sessionToken),
        window.mediDeskBridge.listMedicalHistoryByPatient(pId, orgId, sessionToken),
        window.mediDeskBridge.listDiagnosesByPatient(pId, orgId, sessionToken),
        window.mediDeskBridge.listPrescriptionsByPatient(pId, orgId, sessionToken)
      ]);

      if (patientRes.success && patientRes.data) {
        setPatient(patientRes.data);
      }
      if (visitsRes.success && visitsRes.data) {
        setPastVisits(visitsRes.data);
        const openVisit = visitsRes.data.find((v) => v.status === 'OPEN' || v.status === 'IN_PROGRESS');
        if (openVisit) {
          setActiveVisit(openVisit);
          setChiefComplaint(openVisit.chiefComplaint || '');
          setHistoryOfIllness(openVisit.historyOfPresentIllness || '');
          setExaminationNotes(openVisit.examinationNotes || '');
          setClinicalAssessment(openVisit.clinicalAssessment || '');
          if (openVisit.doctorId) setSelectedDoctorId(openVisit.doctorId);
        } else {
          setActiveVisit(null);
          setChiefComplaint('');
          setHistoryOfIllness('');
          setExaminationNotes('');
          setClinicalAssessment('');
        }
      }
      if (vitalsRes.success && vitalsRes.data) setVitalsList(vitalsRes.data);
      if (allergiesRes.success && allergiesRes.data) setAllergiesList(allergiesRes.data);
      if (diagRes.success && diagRes.data) setDiagnosesList(diagRes.data);
      if (rxRes.success && rxRes.data && rxRes.data.length > 0) {
        const latestRx = rxRes.data[0];
        setActivePrescription(latestRx);
        if (latestRx.currentVersion?.items) {
          setRxItems(latestRx.currentVersion.items.map((i) => ({
            medicineName: i.medicineName,
            genericName: i.genericName || '',
            strength: i.strength || '',
            dosageForm: i.dosageForm,
            route: i.route,
            frequency: i.frequency,
            durationValue: i.durationValue || 5,
            durationUnit: i.durationUnit,
            instructions: i.instructions || '',
            quantity: i.quantity || 10,
            isSubstitutionAllowed: i.isSubstitutionAllowed
          })));
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, sessionToken]);

  useEffect(() => {
    loadDoctors();
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId, loadDoctors, loadPatientData]);

  // Patient Search
  const handleSearchPatient = async (query: string) => {
    setSearchQuery(query);
    if (!window.mediDeskBridge || query.trim().length < 2) {
      setPatientSearchResults([]);
      return;
    }
    try {
      const res = await window.mediDeskBridge.searchPatients({ organizationId: orgId, query }, sessionToken);
      if (res.success && res.data) {
        setPatientSearchResults(res.data);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectPatient = (p: Patient) => {
    setPatient(p);
    setPatientId(p.id);
    setPatientSearchResults([]);
    setSearchQuery('');
  };

  // Start New Visit
  const handleStartNewVisit = async () => {
    if (!window.mediDeskBridge || !patientId || !selectedDoctorId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await window.mediDeskBridge.createClinicalVisit({
        organizationId: orgId,
        patientId,
        doctorId: selectedDoctorId,
        appointmentId: initialAppointmentId,
        chiefComplaint: chiefComplaint || undefined,
        historyOfPresentIllness: historyOfIllness || undefined,
        examinationNotes: examinationNotes || undefined,
        clinicalAssessment: clinicalAssessment || undefined
      }, sessionToken);

      if (res.success && res.data) {
        setActiveVisit(res.data);
        setSuccessMsg('Clinical visit encounter opened successfully.');
        loadPatientData(patientId);
      } else {
        setError(res.error?.message || 'Failed to start clinical visit.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Save In-Progress Visit Notes
  const handleSaveVisitNotes = async () => {
    if (!window.mediDeskBridge || !activeVisit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await window.mediDeskBridge.updateClinicalVisit({
        visitId: activeVisit.id,
        chiefComplaint,
        historyOfPresentIllness: historyOfIllness,
        examinationNotes,
        clinicalAssessment,
        status: 'IN_PROGRESS'
      }, orgId, sessionToken);

      if (res.success && res.data) {
        setActiveVisit(res.data);
        setSuccessMsg('Encounter notes saved.');
      } else {
        setError(res.error?.message || 'Failed to update visit.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Complete Visit
  const handleCompleteVisit = async () => {
    if (!window.mediDeskBridge || !activeVisit) return;
    setSaving(true);
    setError(null);
    try {
      await window.mediDeskBridge.updateClinicalVisit({
        visitId: activeVisit.id,
        chiefComplaint,
        historyOfPresentIllness: historyOfIllness,
        examinationNotes,
        clinicalAssessment
      }, orgId, sessionToken);

      const res = await window.mediDeskBridge.completeClinicalVisit(activeVisit.id, orgId, sessionToken);
      if (res.success && res.data) {
        setActiveVisit(res.data);
        setSuccessMsg('Clinical visit completed and locked.');
        loadPatientData(patientId);
      } else {
        setError(res.error?.message || 'Failed to complete visit.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Add Medication Item
  const handleAddMedication = () => {
    if (!newMedName.trim()) return;
    setRxItems([
      ...rxItems,
      {
        medicineName: newMedName.trim(),
        genericName: newMedGeneric.trim(),
        strength: newMedStrength.trim(),
        dosageForm: newMedForm,
        route: newMedRoute,
        frequency: newMedFreq,
        durationValue: newMedDuration,
        durationUnit: newMedDurationUnit,
        instructions: newMedInstructions,
        quantity: newMedQty,
        isSubstitutionAllowed: true
      }
    ]);
    setNewMedName('');
    setNewMedGeneric('');
    setNewMedStrength('');
  };

  const handleRemoveMedication = (index: number) => {
    setRxItems(rxItems.filter((_, i) => i !== index));
  };

  // Sign Prescription
  const handleSignPrescription = async () => {
    if (!window.mediDeskBridge || !patientId || !selectedDoctorId || rxItems.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      let rxId = activePrescription?.id;
      if (!rxId) {
        const createRes = await window.mediDeskBridge.createPrescription({
          organizationId: orgId,
          patientId,
          doctorId: selectedDoctorId,
          clinicalVisitId: activeVisit?.id,
          items: rxItems
        }, sessionToken);

        if (createRes.success && createRes.data) {
          rxId = createRes.data.id;
          setActivePrescription(createRes.data);
        } else {
          setError(createRes.error?.message || 'Failed to create prescription.');
          setSaving(false);
          return;
        }
      }

      const signRes = await window.mediDeskBridge.signPrescription(rxId, orgId, sessionToken);
      if (signRes.success && signRes.data) {
        setActivePrescription(signRes.data);
        setSuccessMsg('Prescription signed and locked.');
      } else {
        setError(signRes.error?.message || 'Failed to sign prescription.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Revise Prescription
  const handleRevisePrescription = async () => {
    if (!window.mediDeskBridge || !activePrescription || !rxRevisionReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await window.mediDeskBridge.revisePrescription({
        prescriptionId: activePrescription.id,
        reasonForChange: rxRevisionReason.trim(),
        items: rxItems
      }, orgId, sessionToken);

      if (res.success && res.data) {
        setActivePrescription(res.data);
        setIsReviseRxModalOpen(false);
        setRxRevisionReason('');
        setSuccessMsg(`Prescription revised to version ${res.data.currentVersionNumber}.`);
      } else {
        setError(res.error?.message || 'Failed to revise prescription.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Submit Clinical Correction
  const handleSubmitCorrection = async () => {
    if (!window.mediDeskBridge || !activeVisit || !correctionReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await window.mediDeskBridge.correctClinicalVisit({
        visitId: activeVisit.id,
        reason: correctionReason.trim(),
        correctedPayload: {
          chiefComplaint,
          historyOfPresentIllness: historyOfIllness,
          examinationNotes,
          clinicalAssessment
        }
      }, orgId, sessionToken);

      if (res.success && res.data) {
        setActiveVisit(res.data);
        setIsCorrectionModalOpen(false);
        setCorrectionReason('');
        setSuccessMsg('Audited clinical correction applied successfully.');
        loadPatientData(patientId);
      } else {
        setError(res.error?.message || 'Failed to apply clinical correction.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Record Vitals Submit
  const handleRecordVitals = async () => {
    if (!window.mediDeskBridge || !patientId) return;
    setSaving(true);
    try {
      const res = await window.mediDeskBridge.recordVitals({
        organizationId: orgId,
        patientId,
        clinicalVisitId: activeVisit?.id,
        temperature: temp ? parseFloat(temp) : undefined,
        temperatureUnit: tempUnit,
        pulseRate: pulse ? parseInt(pulse, 10) : undefined,
        systolicBp: systolicBp ? parseInt(systolicBp, 10) : undefined,
        diastolicBp: diastolicBp ? parseInt(diastolicBp, 10) : undefined,
        oxygenSaturationSpo2: spo2 ? parseFloat(spo2) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined
      }, sessionToken);

      if (res.success && res.data) {
        setIsVitalsModalOpen(false);
        setVitalsList([res.data, ...vitalsList]);
        setSuccessMsg('Vitals recorded successfully.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Record Allergy Submit
  const handleRecordAllergy = async () => {
    if (!window.mediDeskBridge || !patientId) return;
    setSaving(true);
    try {
      const res = await window.mediDeskBridge.recordAllergy({
        organizationId: orgId,
        patientId,
        status: allergyStatus,
        allergenName: allergyStatus === 'KNOWN' ? allergenName : undefined,
        severity: allergySeverity,
        reaction: allergyReaction
      }, sessionToken);

      if (res.success && res.data) {
        setIsAllergyModalOpen(false);
        setAllergiesList([res.data, ...allergiesList]);
        setAllergenName('');
        setAllergyReaction('');
        setSuccessMsg('Allergy status recorded.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Record Diagnosis Submit
  const handleRecordDiagnosis = async () => {
    if (!window.mediDeskBridge || !patientId || !selectedDoctorId || !diagnosisText.trim()) return;
    setSaving(true);
    try {
      const res = await window.mediDeskBridge.recordDiagnosis({
        organizationId: orgId,
        patientId,
        doctorId: selectedDoctorId,
        clinicalVisitId: activeVisit?.id,
        diagnosisText: diagnosisText.trim(),
        type: diagnosisType
      }, sessionToken);

      if (res.success && res.data) {
        setIsDiagnosisModalOpen(false);
        setDiagnosesList([...diagnosesList, res.data]);
        setDiagnosisText('');
        setSuccessMsg('Diagnosis added.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Schedule Follow-Up Submit
  const handleScheduleFollowUp = async () => {
    if (!window.mediDeskBridge || !patientId || !selectedDoctorId || !followUpDate) return;
    setSaving(true);
    try {
      const res = await window.mediDeskBridge.scheduleFollowUp({
        organizationId: orgId,
        patientId,
        doctorId: selectedDoctorId,
        clinicalVisitId: activeVisit?.id,
        followUpDate,
        instructions: followUpInstructions
      }, sessionToken);

      if (res.success && res.data) {
        setFollowUpsList([...followUpsList, res.data]);
        setSuccessMsg('Follow-up scheduled.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const knownAllergies = allergiesList.filter((a) => a.status === 'KNOWN');
  const deniedAllergies = allergiesList.filter((a) => a.status === 'DENIED');
  const latestVitals = vitalsList[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Patient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="outline" size="sm" onClick={onBack} className="h-8 px-2">
                ← Back
              </Button>
            )}
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-blue-600" />
              Clinical Consultation & Medical Records
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standardized clinical intake, telemetry vitals, allergy guardrails and versioned prescriptions.
          </p>
        </div>

        {/* Patient Search & Selector */}
        {!patient && (
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search patient by name, mobile, #..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchPatient(e.target.value)}
              className="w-full text-xs h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {patientSearchResults.length > 0 && (
              <div className="absolute top-10 left-0 right-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {patientSearchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.fullName}</span>
                      <span className="text-slate-400 ml-2">({p.patientNumber})</span>
                    </div>
                    <span className="text-slate-500 font-mono">{p.mobile || 'No Phone'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {patient && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPatient(null);
                setPatientId('');
              }}
              className="text-xs h-8"
            >
              Switch Patient
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {!patient && (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Patient Selected</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Search and select a patient to open their clinical encounter, view history, record vitals, and author prescriptions.
          </p>
        </Card>
      )}

      {patient && (
        <>
          {/* Patient Safety & Demographic Header */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg border border-white/20">
                  {patient.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{patient.fullName}</h2>
                    <Badge variant="outline" className="text-[10px] text-blue-200 border-blue-400/40">
                      {patient.patientNumber}
                    </Badge>
                  </div>
                  <div className="text-xs text-blue-200 flex items-center gap-3 mt-0.5">
                    <span>{patient.age ? `${patient.age} Yrs` : 'Age N/A'} • {patient.sex}</span>
                    <span>• Mobile: {patient.mobile || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* ALLERGY SAFETY BADGE */}
              <div className="flex items-center gap-2 bg-black/20 p-2.5 rounded-lg border border-white/10">
                {knownAllergies.length > 0 ? (
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                    <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
                    <div>
                      <div>KNOWN ALLERGIES:</div>
                      <div className="text-[11px] font-normal text-rose-200">
                        {knownAllergies.map((a) => a.allergenName).join(', ')}
                      </div>
                    </div>
                  </div>
                ) : deniedAllergies.length > 0 ? (
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <div>
                      <div>NO KNOWN DRUG ALLERGIES (NKDA)</div>
                      <div className="text-[10px] font-normal text-emerald-200">Explicitly Verified</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <div>
                      <div>ALLERGIES NOT RECORDED</div>
                      <div className="text-[10px] font-normal text-amber-200">Assessment Required</div>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAllergyModalOpen(true)}
                  className="text-[10px] h-7 px-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Edit Allergies
                </Button>
              </div>
            </div>

            {/* Doctor & Encounter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-blue-200 font-medium">Attending Doctor:</span>
                <select
                  value={selectedDoctorId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDoctorId(e.target.value)}
                  disabled={activeVisit?.status === 'COMPLETED'}
                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id} className="text-slate-900">
                      Dr. {d.displayName} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              {activeVisit ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={activeVisit.status === 'COMPLETED' ? 'success' : 'primary'}
                    className="text-xs flex items-center gap-1"
                  >
                    {activeVisit.status === 'COMPLETED' && <Lock className="h-3 w-3" />}
                    Encounter {activeVisit.status}
                  </Badge>
                  {activeVisit.status === 'COMPLETED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCorrectionModalOpen(true)}
                      className="text-xs h-7 bg-white/10 hover:bg-white/20 text-white border-white/20"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Request Correction
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartNewVisit}
                  disabled={saving || !selectedDoctorId}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Start Consultation Encounter
                </Button>
              )}
            </div>
          </div>

          {/* Two-Column Clinical Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: History, Vitals & Timeline */}
            <div className="space-y-6">
              {/* Vitals Telemetry Card */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-rose-500" />
                    Vitals Telemetry
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVitalsModalOpen(true)}
                    className="text-[11px] h-7 px-2"
                  >
                    + Record Vitals
                  </Button>
                </div>

                {latestVitals ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block">Temperature</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {latestVitals.temperature ? `${latestVitals.temperature}° ${latestVitals.temperatureUnit === 'CELSIUS' ? 'C' : 'F'}` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block">Blood Pressure</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {latestVitals.systolicBp && latestVitals.diastolicBp ? `${latestVitals.systolicBp}/${latestVitals.diastolicBp} mmHg` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block">Pulse Rate</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {latestVitals.pulseRate ? `${latestVitals.pulseRate} bpm` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block">SpO2</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {latestVitals.oxygenSaturationSpo2 ? `${latestVitals.oxygenSaturationSpo2}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Weight / Height</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {latestVitals.weightKg ? `${latestVitals.weightKg} kg` : '—'} / {latestVitals.heightCm ? `${latestVitals.heightCm} cm` : '—'}
                        </span>
                      </div>
                      {latestVitals.bmi && (
                        <Badge variant="secondary" className="text-[11px]">
                          BMI: {latestVitals.bmi}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-2">No vitals recorded today.</p>
                )}
              </Card>

              {/* Past Encounters Timeline */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-blue-500" />
                    Past Encounters ({pastVisits.length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {pastVisits.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">No previous encounters recorded.</p>
                  ) : (
                    pastVisits.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setActiveVisit(v);
                          setChiefComplaint(v.chiefComplaint || '');
                          setHistoryOfIllness(v.historyOfPresentIllness || '');
                          setExaminationNotes(v.examinationNotes || '');
                          setClinicalAssessment(v.clinicalAssessment || '');
                        }}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          activeVisit?.id === v.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {new Date(v.visitDateTime).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <Badge variant={v.status === 'COMPLETED' ? 'success' : 'primary'} className="text-[9px]">
                            {v.status}
                          </Badge>
                        </div>
                        {v.chiefComplaint && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">
                            {v.chiefComplaint}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMN: Clinical Notes, Diagnoses, Prescription & Follow-up */}
            <div className="lg:col-span-2 space-y-6">
              {/* Clinical Notes Card */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Clinical Encounter Notes
                  </h3>
                  {activeVisit?.status === 'COMPLETED' && (
                    <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Locked Encounter
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Chief Complaint & Duration
                    </label>
                    <textarea
                      rows={2}
                      value={chiefComplaint}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setChiefComplaint(e.target.value)}
                      disabled={activeVisit?.status === 'COMPLETED'}
                      placeholder="e.g. Fever with productive cough for 3 days, throat pain..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        History of Present Illness
                      </label>
                      <textarea
                        rows={3}
                        value={historyOfIllness}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHistoryOfIllness(e.target.value)}
                        disabled={activeVisit?.status === 'COMPLETED'}
                        placeholder="Onset, progression, aggravating factors..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Clinical Examination
                      </label>
                      <textarea
                        rows={3}
                        value={examinationNotes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExaminationNotes(e.target.value)}
                        disabled={activeVisit?.status === 'COMPLETED'}
                        placeholder="Throat congestion, chest clear, tenderness..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Clinical Assessment / Working Summary
                    </label>
                    <textarea
                      rows={2}
                      value={clinicalAssessment}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setClinicalAssessment(e.target.value)}
                      disabled={activeVisit?.status === 'COMPLETED'}
                      placeholder="Clinical synthesis and evaluation..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Diagnoses Section */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Diagnoses ({diagnosesList.length})
                    </label>
                    {activeVisit?.status !== 'COMPLETED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDiagnosisModalOpen(true)}
                        className="text-[11px] h-6 px-2"
                      >
                        + Add Diagnosis
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {diagnosesList.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No diagnosis recorded yet.</span>
                    ) : (
                      diagnosesList.map((d) => (
                        <Badge
                          key={d.id}
                          variant={d.type === 'PRIMARY' ? 'primary' : 'secondary'}
                          className="text-xs py-1 px-2"
                        >
                          <span className="font-semibold">[{d.type}]</span> {d.diagnosisText}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              {/* Versioned Prescription Authoring Card */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Prescription Authoring
                    </h3>
                    {activePrescription && (
                      <Badge
                        variant={activePrescription.status === 'SIGNED' ? 'success' : 'secondary'}
                        className="text-[10px]"
                      >
                        v{activePrescription.currentVersionNumber} • {activePrescription.status}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activePrescription?.status === 'SIGNED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsReviseRxModalOpen(true)}
                        className="text-xs h-7"
                      >
                        Revise Rx
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPrintPreviewOpen(true)}
                      className="text-xs h-7 flex items-center gap-1"
                    >
                      <Printer className="h-3 w-3" />
                      Print Rx
                    </Button>
                  </div>
                </div>

                {/* Medication Items Table */}
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Medicine / Strength</th>
                          <th className="p-2">Form & Route</th>
                          <th className="p-2">Frequency</th>
                          <th className="p-2">Duration</th>
                          <th className="p-2">Instructions</th>
                          <th className="p-2">Qty</th>
                          {activePrescription?.status !== 'SIGNED' && <th className="p-2 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rxItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                              No medications added yet. Add items below.
                            </td>
                          </tr>
                        ) : (
                          rxItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-2 font-medium text-slate-800 dark:text-slate-200">
                                {item.medicineName} {item.strength}
                                {item.genericName && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    ({item.genericName})
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-300">
                                {item.dosageForm} • {item.route}
                              </td>
                              <td className="p-2 font-semibold text-blue-600 dark:text-blue-400">
                                {item.frequency}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-300">
                                {item.durationValue} {item.durationUnit.toLowerCase()}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-300">
                                {item.instructions || '—'}
                              </td>
                              <td className="p-2 font-mono text-slate-800 dark:text-slate-200">
                                {item.quantity}
                              </td>
                              {activePrescription?.status !== 'SIGNED' && (
                                <td className="p-2 text-right">
                                  <button
                                    onClick={() => handleRemoveMedication(idx)}
                                    className="text-rose-600 hover:text-rose-700 text-xs font-bold px-1"
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Medication Row */}
                  {activePrescription?.status !== 'SIGNED' && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        + Add Medication Item
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          placeholder="Medicine Name *"
                          value={newMedName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedName(e.target.value)}
                          className="text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          placeholder="Generic Name"
                          value={newMedGeneric}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedGeneric(e.target.value)}
                          className="text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          placeholder="Strength (e.g. 500mg)"
                          value={newMedStrength}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedStrength(e.target.value)}
                          className="text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <select
                          value={newMedForm}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMedForm(e.target.value as DosageForm)}
                          className="text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          placeholder="Frequency (1-0-1)"
                          value={newMedFreq}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedFreq(e.target.value)}
                          className="text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <div className="flex gap-1">
                          <input
                            type="number"
                            placeholder="Duration"
                            value={newMedDuration.toString()}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedDuration(parseInt(e.target.value, 10) || 1)}
                            className="text-xs h-8 w-16 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                          <select
                            value={newMedDurationUnit}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMedDurationUnit(e.target.value as DurationUnit)}
                            className="text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 flex-1"
                          >
                            <option value="DAYS">Days</option>
                            <option value="WEEKS">Weeks</option>
                            <option value="MONTHS">Months</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder="Instructions (After meals)"
                          value={newMedInstructions}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMedInstructions(e.target.value)}
                          className="text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleAddMedication}
                          className="text-xs h-8"
                        >
                          Add Item
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sign Prescription Button */}
                {activePrescription?.status !== 'SIGNED' && rxItems.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSignPrescription}
                      disabled={saving}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                      Sign Prescription
                    </Button>
                  </div>
                )}
              </Card>

              {/* Follow-up Scheduling Card */}
              <Card className="p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Follow-Up Scheduling
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFollowUpDate(e.target.value)}
                      className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Instructions
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Review blood test reports, check BP..."
                        value={followUpInstructions}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFollowUpInstructions(e.target.value)}
                        className="text-xs h-8 px-2 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleScheduleFollowUp}
                        disabled={saving || !followUpDate}
                        className="text-xs h-8"
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Action Bar (Save / Complete) */}
              {activeVisit && activeVisit.status !== 'COMPLETED' && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-xs text-slate-500">
                    Auto-saved changes to local encounter record.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveVisitNotes}
                      disabled={saving}
                      className="text-xs h-8"
                    >
                      Save In-Progress
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCompleteVisit}
                      disabled={saving}
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Complete Consultation
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Record Vitals Modal Overlay */}
      {isVitalsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Record Patient Vitals Telemetry</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Temperature
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={temp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemp(e.target.value)}
                    className="text-xs h-8 px-2 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <select
                    value={tempUnit}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTempUnit(e.target.value as 'CELSIUS' | 'FAHRENHEIT')}
                    className="text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                  >
                    <option value="FAHRENHEIT">°F</option>
                    <option value="CELSIUS">°C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Blood Pressure (mmHg)
                </label>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    placeholder="Sys"
                    value={systolicBp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSystolicBp(e.target.value)}
                    className="text-xs h-8 px-2 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    placeholder="Dia"
                    value={diastolicBp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiastolicBp(e.target.value)}
                    className="text-xs h-8 px-2 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Pulse Rate (bpm)
                </label>
                <input
                  type="number"
                  value={pulse}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPulse(e.target.value)}
                  className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpo2(e.target.value)}
                  className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeightKg(e.target.value)}
                  className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeightCm(e.target.value)}
                  className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsVitalsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleRecordVitals} disabled={saving}>
                Save Vitals
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Allergy Modal Overlay */}
      {isAllergyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Record Allergy / Safety Alert</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Allergy Assessment Status *
              </label>
              <select
                value={allergyStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAllergyStatus(e.target.value as 'KNOWN' | 'DENIED' | 'UNKNOWN')}
                className="w-full text-xs h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5"
              >
                <option value="KNOWN">KNOWN ALLERGY (Active Drug/Food Allergen)</option>
                <option value="DENIED">DENIED (No Known Drug Allergies - NKDA)</option>
                <option value="UNKNOWN">UNKNOWN (Not Assessed)</option>
              </select>
            </div>

            {allergyStatus === 'KNOWN' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Allergen Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Paracetamol, Sulfa, Peanuts"
                    value={allergenName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllergenName(e.target.value)}
                    className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Severity
                    </label>
                    <select
                      value={allergySeverity}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAllergySeverity(e.target.value as 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING')}
                      className="w-full text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                    >
                      <option value="MILD">Mild</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="SEVERE">Severe</option>
                      <option value="LIFE_THREATENING">Life Threatening</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Reaction
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Skin Rash, Anaphylaxis"
                      value={allergyReaction}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllergyReaction(e.target.value)}
                      className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsAllergyModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleRecordAllergy} disabled={saving}>
                Save Allergy Status
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Diagnosis Modal Overlay */}
      {isDiagnosisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Clinical Diagnosis</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Diagnosis Text *
              </label>
              <input
                type="text"
                placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI)"
                value={diagnosisText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiagnosisText(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Diagnosis Classification
              </label>
              <select
                value={diagnosisType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDiagnosisType(e.target.value as 'PRIMARY' | 'SECONDARY' | 'PROVISIONAL' | 'DIFFERENTIAL')}
                className="w-full text-xs h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
              >
                <option value="PRIMARY">Primary Diagnosis</option>
                <option value="SECONDARY">Secondary Diagnosis</option>
                <option value="PROVISIONAL">Provisional Diagnosis</option>
                <option value="DIFFERENTIAL">Differential Diagnosis</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsDiagnosisModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleRecordDiagnosis} disabled={saving || !diagnosisText.trim()}>
                Add Diagnosis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revise Prescription Modal Overlay */}
      {isReviseRxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revise Prescription</h3>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <strong>Traceability Requirement:</strong> Revising will mark version {activePrescription?.currentVersionNumber} as <code>SUPERSEDED</code> and generate version {(activePrescription?.currentVersionNumber || 1) + 1}.
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Reason for Revision *
              </label>
              <textarea
                rows={3}
                value={rxRevisionReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRxRevisionReason(e.target.value)}
                placeholder="e.g. Changed antibiotic due to gastric intolerance, adjusted dosage..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsReviseRxModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRevisePrescription}
                disabled={saving || !rxRevisionReason.trim()}
              >
                Sign & Save Revised Version
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Correction Modal Overlay */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audited Clinical Correction Request</h3>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300">
              <strong>Clinical Safety Invariant:</strong> Completed clinical encounters cannot be silently modified. All changes require an explicit justification and generate an immutable audit record.
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Mandatory Reason for Correction *
              </label>
              <textarea
                rows={3}
                value={correctionReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Corrected typo in clinical assessment, added omitted physical examination finding..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsCorrectionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitCorrection}
                disabled={saving || !correctionReason.trim()}
              >
                Submit & Apply Correction
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Print Preview Modal Overlay */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Prescription Print Preview</h3>
            <div className="p-6 bg-white text-slate-900 border border-slate-300 rounded-lg space-y-4">
              <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold tracking-tight">{currentUser.organizationName || 'CLINIC'}</h2>
                  <p className="text-[10px] text-slate-500">MediDesk Clinical Management System</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    Dr. {doctors.find((d) => d.id === selectedDoctorId)?.displayName || 'Attending Physician'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {doctors.find((d) => d.id === selectedDoctorId)?.qualification || ''} ({doctors.find((d) => d.id === selectedDoctorId)?.specialization || ''})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                <div>
                  <strong>Patient:</strong> {patient?.fullName} ({patient?.patientNumber})
                </div>
                <div>
                  <strong>Age/Sex:</strong> {patient?.age ? `${patient.age} Y` : 'N/A'} / {patient?.sex}
                </div>
                <div>
                  <strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}
                </div>
                <div>
                  <strong>Rx Version:</strong> v{activePrescription?.currentVersionNumber || 1} ({activePrescription?.status || 'DRAFT'})
                </div>
              </div>

              {diagnosesList.length > 0 && (
                <div>
                  <strong className="text-[11px] block text-slate-700">Diagnosis:</strong>
                  <p className="text-[11px]">{diagnosesList.map((d) => d.diagnosisText).join(', ')}</p>
                </div>
              )}

              <div>
                <strong className="text-sm font-serif block mb-2">℞</strong>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="py-1">Medicine</th>
                      <th className="py-1">Dosage & Frequency</th>
                      <th className="py-1">Duration</th>
                      <th className="py-1">Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-1.5 font-semibold">
                          {item.medicineName} {item.strength}
                        </td>
                        <td className="py-1.5">{item.frequency}</td>
                        <td className="py-1.5">{item.durationValue} {item.durationUnit.toLowerCase()}</td>
                        <td className="py-1.5">{item.instructions || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {followUpDate && (
                <div className="pt-2 border-t border-slate-200">
                  <strong>Follow Up:</strong> {followUpDate} ({followUpInstructions || 'Review in clinic'})
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPrintPreviewOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
