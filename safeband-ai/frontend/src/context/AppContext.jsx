import { createContext, useContext, useReducer, useCallback } from 'react';

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
  userId: 'test-user-001',
  systemStatus: 'checking', // 'online' | 'offline' | 'checking'
  lastApiResponse: null,
  lastUpdated: null,
  logs: [],
  toasts: [],
  notifications: [],
  activeAlertCount: 0,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER_ID':
      return { ...state, userId: action.payload };

    case 'SET_SYSTEM_STATUS':
      return { ...state, systemStatus: action.payload };

    case 'SET_LAST_API_RESPONSE':
      return { ...state, lastApiResponse: action.payload, lastUpdated: new Date().toISOString() };

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        activeAlertCount: action.payload.filter(
          (n) => n.status !== 'resolved' && n.status !== 'acknowledged'
        ).length,
      };

    case 'ADD_LOG': {
      const newLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, logs: [newLog, ...state.logs].slice(0, 200) };
    }

    case 'CLEAR_LOGS':
      return { ...state, logs: [] };

    case 'ADD_TOAST': {
      const toast = { id: Date.now(), ...action.payload };
      return { ...state, toasts: [...state.toasts, toast] };
    }

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };

    case 'UPDATE_NOTIFICATION': {
      const updated = state.notifications.map((n) =>
        n.id === action.payload.id ? { ...n, ...action.payload } : n
      );
      return {
        ...state,
        notifications: updated,
        activeAlertCount: updated.filter(
          (n) => n.status !== 'resolved' && n.status !== 'acknowledged'
        ).length,
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addLog = useCallback((type, message, status = 'info') => {
    dispatch({ type: 'ADD_LOG', payload: { type, message, status } });
  }, []);

  const showToast = useCallback((message, variant = 'success', duration = 4000) => {
    const id = Date.now();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, variant, duration } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), duration + 300);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, addLog, showToast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
