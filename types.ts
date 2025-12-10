
export interface AutomationSuggestion {
  id: string;
  title: string;
  estimatedTimeSavings: string;
  tools: string[];
  description: string;
  relevanceScore: number; // 1-100
}

export interface GuideStep {
  stepNumber: number;
  instruction: string;
  selectorDescription?: string; // e.g., "The blue button in the top right"
  codeSnippet?: string;
  tip?: string; // Contextual tooltip content
}

export interface DetailedGuide {
  suggestionId: string;
  title: string;
  prerequisites: string[];
  steps: GuideStep[];
}

export interface HistoryItem {
  id: string;
  guide: DetailedGuide;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  SUGGESTING = 'SUGGESTING',
  VIEWING_GUIDE = 'VIEWING_GUIDE',
  GUIDE_LOADING = 'GUIDE_LOADING',
  HISTORY = 'HISTORY'
}
