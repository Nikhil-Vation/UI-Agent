// Simple state manager with subscription support — keeps UI state in-memory while popup is open

class StateManager {
  constructor() {
    this.state = {
      isLoading: false,
      url: '',
      timestamp: null,
      accessibilityIssues: [],
      uiIssues: [],
      summary: { totalAccessibilityIssues: 0, totalUiIssues: 0 },
      expanded: { access: true, ui: true },
      error: null
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    // immediately call with current state
    try { fn(this.state); } catch (e) { /* ignore listener failures */ }
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of Array.from(this.listeners)) {
      try { fn(this.state); } catch (e) { console.warn('[state] listener threw', e); }
    }
  }

  setLoading(isLoading) {
    this.state.isLoading = !!isLoading;
    if (isLoading) this.state.error = null;
    this._emit();
  }

  setResults({ url, timestamp, accessibilityIssues, uiIssues, summary } = {}) {
    this.state.url = url || this.state.url || '';
    this.state.timestamp = timestamp || Date.now();
    this.state.accessibilityIssues = Array.isArray(accessibilityIssues) ? accessibilityIssues : [];
    this.state.uiIssues = Array.isArray(uiIssues) ? uiIssues : [];
    this.state.summary = Object.assign({}, this.state.summary, summary || {
      totalAccessibilityIssues: this.state.accessibilityIssues.length,
      totalUiIssues: this.state.uiIssues.length
    });
    this.state.isLoading = false;
    this._emit();
  }

  mergeBackendEnrichment(payload = {}) {
    // payload may contain summary, accessibilityIssues, uiIssues
    if (payload.summary) this.state.summary = Object.assign({}, this.state.summary, payload.summary);
    if (Array.isArray(payload.accessibilityIssues)) this.state.accessibilityIssues = payload.accessibilityIssues;
    if (Array.isArray(payload.uiIssues)) this.state.uiIssues = payload.uiIssues;
    this.state.isLoading = false;
    this._emit();
  }

  toggleSection(key) {
    this.state.expanded[key] = !this.state.expanded[key];
    this._emit();
  }

  setError(msg) {
    this.state.error = msg || 'Unknown error';
    this.state.isLoading = false;
    this._emit();
  }

  clear() {
    this.state.url = '';
    this.state.timestamp = null;
    this.state.accessibilityIssues = [];
    this.state.uiIssues = [];
    this.state.summary = { totalAccessibilityIssues: 0, totalUiIssues: 0 };
    this.state.error = null;
    this._emit();
  }

  getState() {
    return Object.assign({}, this.state);
  }
}

const State = new StateManager();
export default State;
