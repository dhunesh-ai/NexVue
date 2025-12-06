export enum SafetyLevel {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION',
  DANGER = 'DANGER'
}

export interface RoadSign {
  type: string;
  meaning: string;
  location: string;
}

export interface Hazard {
  type: string; // e.g., Pothole, Pedestrian, Debris
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface AnalysisResult {
  signs: RoadSign[];
  hazards: Hazard[];
  safetyLevel: SafetyLevel;
  recommendation: string;
  timestamp: string;
}

export interface AnalysisHistoryItem extends AnalysisResult {
  id: string;
  thumbnail?: string; // Base64 thumbnail
}