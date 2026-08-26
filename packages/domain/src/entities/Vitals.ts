export type TemperatureUnit = 'CELSIUS' | 'FAHRENHEIT';

export interface Vitals {
  id: string;
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  temperature?: number;
  temperatureUnit: TemperatureUnit;
  pulseRate?: number; // bpm
  respiratoryRate?: number; // breaths/min
  systolicBp?: number; // mmHg
  diastolicBp?: number; // mmHg
  oxygenSaturationSpo2?: number; // %
  weightKg?: number; // kg
  heightCm?: number; // cm
  bmi?: number; // calculated kg/m^2
  notes?: string;
  recordedAt: Date;
  recordedBy?: string;
}

export type RecordVitalsDTO = {
  id?: string;
  organizationId: string;
  patientId: string;
  clinicalVisitId?: string;
  temperature?: number;
  temperatureUnit?: TemperatureUnit;
  pulseRate?: number;
  respiratoryRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  oxygenSaturationSpo2?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  notes?: string;
  recordedBy?: string;
};
