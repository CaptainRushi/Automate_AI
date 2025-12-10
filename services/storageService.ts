import { DetailedGuide, HistoryItem } from '../types';

const STORAGE_KEY = 'automate_ai_history';

/**
 * Saves a generated guide to local storage history.
 * Adds a timestamp and unique ID.
 * Limits history to 50 items to preserve space.
 */
export const saveGuideToHistory = (guide: DetailedGuide) => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    let history: HistoryItem[] = existing ? JSON.parse(existing) : [];

    // Create new history item
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      guide,
      timestamp: Date.now()
    };

    // Add to beginning of list
    history.unshift(newItem);

    // Limit to 50 items
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history to localStorage", e);
  }
};

/**
 * Retrieves the full history list.
 */
export const getHistory = (): HistoryItem[] => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

/**
 * Clears all history.
 */
export const clearHistory = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear history", e);
    }
}
