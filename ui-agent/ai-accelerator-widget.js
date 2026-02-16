/**
 * AI Accelerator Widget - Modern Dashboard
 * A beautiful, human-friendly accessibility & UI quality dashboard
 */

class AIAcceleratorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = null;
    this._loading = false;
    this._error = null;
    this._expandedIssues = new Set();
  }

  connectedCallback() {
    this._render();
    
    // Auto-load if we have URL and endpoint
    const targetUrl = this.getAttribute('target-url');
    const endpoint = this.getAttribute('api-endpoint');
    
    if (targetUrl && endpoint) {
      this.runAnalysis(targetUrl, endpoint);
    }
  }

  static get observedAttributes() {
    return ['target-url', 'api-endpoint'];
  }

  /**
   * Run accessibility analysis on a URL
   */
  async runAnalysis(url, apiEndpoint = 'http://localhost:3000/run') {
    // Cancel any previous enrichment SSE
    this._stopEnrichmentSSE?.();

    this._loading = true;
    this._error = null;
    this._render();

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      this._data = data;
      this._render();

      // If server returned a fast-mode indicator, open an SSE to receive LLM-enriched final analysis
      const reportId = data?.report?.id;
      const asyncLLM = data?.analysis && data.analysis.asyncLLM;
      if (reportId && asyncLLM) {
        if (typeof window !== 'undefined' && window.EventSource) {
          this._startEnrichmentSSE(reportId, apiEndpoint);
        } else {
          // No EventSource support; fallback is not implemented (older browsers).
          console.warn('EventSource not available in this environment — LLM push updates will not be received automatically.');
        }
      }
    } catch (err) {
      this._error = err.message;
      this._render();
    } finally {
      this._loading = false;
      this._render();
    }
  }

  /**
   * Load existing analysis data
   */
  loadData(data) {
    console.debug('Widget loadData received:', data);
    this._data = data;
    this._loading = false;
    this._error = null;
    this._render();
  }

  /**
   * Alias for loadData (backwards compatibility)
   */
  setReport(data) {
    this.loadData(data);
  }

  /**
   * Main render method
   */
  _render() {
    const styles = `<link rel="stylesheet" href="ai-accelerator-widget.css">`;
    
    let content = '';
    
    if (this._loading) {
      content = this._renderLoading();
    } else if (this._error) {
      content = this._renderError();
    } else if (this._data) {
      content = this._renderDashboard();
    } else {
      content = this._renderEmpty();
    }

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="aa-widget-wrapper">
        ${content}
      </div>
    `;

    // Re-attach event listeners after render
    this._attachEventListeners();
  }

  _renderLoading() {
    return `
      <div class="aa-loading">
        <div class="aa-spinner"></div>
        <p class="aa-loading-text">Analyzing accessibility and UI quality...</p>
      </div>
    `;
  }

  _renderError() {
    return `
      <div class="aa-error">
        <div class="aa-error-icon">⚠️</div>
        <p class="aa-error-message">${this._escapeHtml(this._error)}</p>
      </div>
    `;
  }

  _renderEmpty() {
    return `
      <div class="aa-loading">
        <p class="aa-loading-text">No analysis data. Use runAnalysis(url) or loadData(data) to begin.</p>
      </div>
    `;
  }

  /**
   * Render the full dashboard
   */
  _renderDashboard() {
    const data = this._data;
    console.debug('Widget rendering data:', data);
    
    // Handle both flat and nested data structures
    const summary = data.summary || {};
    const issues = data.issues || summary.issues || [];
    const uiIssues = data.uiIssues || summary.uiIssues || [];
    const recommendations = data.recommendations || summary.recommendations || [];
    const topFixes = data.topFixes || summary.topFixes || [];
    const actionPlan = data.actionPlan || summary.actionPlan || {};
    const bestPractices = data.bestPractices || summary.bestPractices || [];
    
    // Score can be at top level or nested in summary
    const score = data.auditScore ?? summary.auditScore ?? 0;
    const compliance = data.complianceStatus || summary.complianceStatus || 'Unknown';
    const counts = data.counts || summary.counts || {};
    
    // Derive counts from issues if not provided
    const derivedCounts = {
      critical: counts.critical ?? issues.filter(i => i.severity === 'Critical').length,
      serious: counts.serious ?? issues.filter(i => i.severity === 'Serious').length,
      moderate: counts.moderate ?? issues.filter(i => i.severity === 'Moderate').length,
      minor: counts.minor ?? issues.filter(i => i.severity === 'Minor').length
    };
    
    return `
      ${this._renderHeader(data)}
      ${this._renderExportButtons()}
      ${this._renderWaveSummary(data)}
      ${this._renderScoreAndStats(score, derivedCounts, compliance)}
      ${this._renderComplianceStatus(data)}
      ${issues.length > 0 ? this._renderIssuesSection(issues) : this._renderNoIssues()}
      ${uiIssues.length > 0 ? this._renderUIIssuesSection(uiIssues) : ''}
      ${topFixes.length > 0 ? this._renderTopFixes(topFixes) : ''}
      ${recommendations.length > 0 ? this._renderRecommendations(recommendations) : ''}
      ${Object.keys(actionPlan).length > 0 ? this._renderActionPlan(actionPlan) : ''}
      ${bestPractices.length > 0 ? this._renderBestPractices(bestPractices) : ''}
      ${this._renderFooter()}
    `;
  }
  
  _renderNoIssues() {
    return `
      <div class="aa-no-issues">
        <div class="aa-no-issues-icon">🎉</div>
        <h3>No Accessibility Issues Found</h3>
        <p>Great job! This page passed all automated accessibility checks.</p>
      </div>
    `;
  }
  
  _renderExportButtons() {
    return `
      <div class="aa-export-bar">
        <button class="aa-export-btn" data-action="export-json">
          <span class="icon">📄</span> Export JSON
        </button>
        <button class="aa-export-btn" data-action="export-csv">
          <span class="icon">📊</span> Export CSV
        </button>
        <button class="aa-export-btn" data-action="print">
          <span class="icon">🖨️</span> Print Report
        </button>
      </div>
    `;
  }

  _renderHeader(data) {
    const url = data.url || data.summary?.url || 'Unknown URL';
    const enrichmentPending = (data && data.analysis && data.analysis.asyncLLM) || this._enrichmentSSE;
    return `
      <header class="aa-header">
        <h1>Accessibility & UI Quality Report</h1>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="aa-url-badge">${this._escapeHtml(url)}</span>
          ${enrichmentPending ? '<span class="aa-llm-pending">LLM enrichment in progress…</span>' : ''}
        </div>
      </header>
    `;
  }

  /**
   * Render WAVE-style summary panel with categories
   */
  _renderWaveSummary(data) {
    const issues = data.issues || data.summary?.issues || [];
    const uiIssues = data.uiIssues || data.summary?.uiIssues || [];
    
    // Categorize issues like WAVE does
    const errors = issues.filter(i => 
      (i.severity === 'Critical' || i.severity === 'Serious') && 
      !i.ruleId?.includes('color-contrast')
    );
    
    const contrastErrors = issues.filter(i => 
      i.ruleId?.includes('color-contrast') || 
      i.title?.toLowerCase().includes('contrast')
    );
    
    const alerts = issues.filter(i => 
      i.severity === 'Moderate' || i.severity === 'Minor'
    );
    
    // Count structural elements from page (headings, landmarks, etc.)
    const structuralCount = issues.filter(i => 
      i.ruleId?.includes('heading') || 
      i.ruleId?.includes('landmark') || 
      i.ruleId?.includes('region')
    ).length || 0;
    
    // Count ARIA issues
    const ariaCount = issues.filter(i => 
      i.ruleId?.includes('aria') || 
      i.title?.toLowerCase().includes('aria')
    ).length || 0;
    
    // Features are positive - approximate from passed checks
    const featuresCount = Math.max(0, 10 - Math.floor(errors.length / 2));
    
    // Calculate AIM-style score (1-10)
    const aimScore = Math.max(1, Math.min(10, 10 - Math.floor(errors.length / 2) - Math.floor(contrastErrors.length / 5)));
    
    return `
      <div class="aa-wave-summary">
        <div class="aa-wave-score">
          <div class="aa-wave-score-circle ${aimScore >= 7 ? 'good' : aimScore >= 4 ? 'warning' : 'bad'}">
            <span class="score-number">${aimScore}</span>
            <span class="score-max">/ 10</span>
          </div>
          <div class="aa-wave-score-label">Accessibility Score</div>
        </div>
        
        <div class="aa-wave-categories">
          <div class="aa-wave-category errors ${errors.length > 0 ? 'has-issues clickable' : ''}" 
               ${errors.length > 0 ? 'data-category="errors"' : ''}>
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <circle cx="12" cy="12" r="10" fill="#e53935"/>
                <path d="M12 6v6M12 14v4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="category-count">${errors.length}</div>
            <div class="category-label">Errors</div>
          </div>
          
          <div class="aa-wave-category contrast ${contrastErrors.length > 0 ? 'has-issues clickable' : ''}"
               ${contrastErrors.length > 0 ? 'data-category="contrast"' : ''}>
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <circle cx="12" cy="12" r="10" fill="#e53935"/>
                <text x="12" y="16" text-anchor="middle" fill="#fff" font-weight="bold" font-size="12">C</text>
              </svg>
            </div>
            <div class="category-count">${contrastErrors.length}</div>
            <div class="category-label">Contrast</div>
          </div>
          
          <div class="aa-wave-category alerts ${alerts.length > 0 ? 'has-issues clickable' : ''}"
               ${alerts.length > 0 ? 'data-category="alerts"' : ''}>
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <polygon points="12,2 22,22 2,22" fill="#fdd835"/>
                <text x="12" y="18" text-anchor="middle" fill="#000" font-weight="bold" font-size="12">!</text>
              </svg>
            </div>
            <div class="category-count">${alerts.length}</div>
            <div class="category-label">Alerts</div>
          </div>
          
          <div class="aa-wave-category features">
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <circle cx="12" cy="12" r="10" fill="#43a047"/>
                <path d="M7 12l3 3 7-7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="category-count">${featuresCount}</div>
            <div class="category-label">Features</div>
          </div>
          
          <div class="aa-wave-category structural ${structuralCount > 0 ? 'has-issues clickable' : ''}"
               ${structuralCount > 0 ? 'data-category="structural"' : ''}>
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <rect x="2" y="2" width="20" height="20" rx="3" fill="#7c4dff"/>
                <path d="M6 8h12M6 12h8M6 16h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="category-count">${structuralCount}</div>
            <div class="category-label">Structure</div>
          </div>
          
          <div class="aa-wave-category aria ${ariaCount > 0 ? 'has-issues clickable' : ''}"
               ${ariaCount > 0 ? 'data-category="aria"' : ''}>
            <div class="category-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <rect x="2" y="2" width="20" height="20" rx="3" fill="#7c4dff"/>
                <text x="12" y="16" text-anchor="middle" fill="#fff" font-weight="bold" font-size="9">ARIA</text>
              </svg>
            </div>
            <div class="category-count">${ariaCount}</div>
            <div class="category-label">ARIA</div>
          </div>
        </div>
      </div>
      
      <!-- Original stat cards below for detail -->
      <div class="aa-wave-details-toggle">
        <button class="aa-toggle-btn" data-action="toggle-details">
          <span>View Detailed Breakdown</span>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </button>
      </div>
    `;
  }

  _renderScoreAndStats(score, counts, compliance) {
    const circumference = 2 * Math.PI * 70;
    const progress = (score / 100) * circumference;
    const offset = circumference - progress;
    
    let scoreClass = 'score-high';
    if (score < 50) scoreClass = 'score-low';
    else if (score < 75) scoreClass = 'score-medium';

    return `
      <div class="aa-dashboard aa-detailed-stats" style="display: none;">
        <div class="aa-score-card">
          <div class="aa-score-ring">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle class="bg" cx="80" cy="80" r="70"/>
              <circle class="progress ${scoreClass}" cx="80" cy="80" r="70"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <div class="aa-score-value">
              <span class="number">${score}</span>
              <span class="max">/100</span>
            </div>
          </div>
          <span class="aa-score-label">Detailed Score</span>
        </div>
        
        <div class="aa-stat-card ${counts.critical > 0 ? 'clickable' : ''}" ${counts.critical > 0 ? 'data-severity="Critical"' : ''}>
          <div class="stat-icon critical">🔴</div>
          <div class="stat-value">${counts.critical || 0}</div>
          <div class="stat-label">Critical Issues</div>
        </div>
        
        <div class="aa-stat-card ${counts.serious > 0 ? 'clickable' : ''}" ${counts.serious > 0 ? 'data-severity="Serious"' : ''}>
          <div class="stat-icon serious">🟠</div>
          <div class="stat-value">${counts.serious || 0}</div>
          <div class="stat-label">Serious Issues</div>
        </div>
        
        <div class="aa-stat-card ${counts.moderate > 0 ? 'clickable' : ''}" ${counts.moderate > 0 ? 'data-severity="Moderate"' : ''}>
          <div class="stat-icon moderate">🔵</div>
          <div class="stat-value">${counts.moderate || 0}</div>
          <div class="stat-label">Moderate Issues</div>
        </div>
        
        <div class="aa-stat-card ${counts.minor > 0 ? 'clickable' : ''}" ${counts.minor > 0 ? 'data-severity="Minor"' : ''}>
          <div class="stat-icon minor">🟢</div>
          <div class="stat-value">${counts.minor || 0}</div>
          <div class="stat-label">Minor Issues</div>
        </div>
      </div>
    `;
  }

  _renderComplianceStatus(data) {
    const wcag = data.wcagCompliance || data.summary?.wcagCompliance || 'Unknown';
    const section508 = data.section508Compliance || data.summary?.section508Compliance || 'Unknown';
    const ada = data.adaCompliance || data.summary?.adaCompliance || 'Unknown';
    
    const getStatus = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase().includes('compliant') && !value.toLowerCase().includes('not');
      }
      return false;
    };

    return `
      <div class="aa-compliance-card">
        <h3 class="aa-section-title">Compliance Status</h3>
        <div class="aa-compliance-grid">
          <div class="aa-compliance-item ${getStatus(wcag) ? 'pass' : 'fail'}">
            <div class="icon">${getStatus(wcag) ? '✓' : '✗'}</div>
            <div class="details">
              <div class="name">WCAG 2.2 AA</div>
              <div class="status">${typeof wcag === 'string' ? wcag : (getStatus(wcag) ? 'Compliant' : 'Not Compliant')}</div>
            </div>
          </div>
          <div class="aa-compliance-item ${getStatus(section508) ? 'pass' : 'fail'}">
            <div class="icon">${getStatus(section508) ? '✓' : '✗'}</div>
            <div class="details">
              <div class="name">Section 508</div>
              <div class="status">${typeof section508 === 'string' ? section508 : (getStatus(section508) ? 'Compliant' : 'Not Compliant')}</div>
            </div>
          </div>
          <div class="aa-compliance-item ${getStatus(ada) ? 'pass' : 'fail'}">
            <div class="icon">${getStatus(ada) ? '✓' : '✗'}</div>
            <div class="details">
              <div class="name">ADA</div>
              <div class="status">${typeof ada === 'string' ? ada : (getStatus(ada) ? 'Compliant' : 'Not Compliant')}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderIssuesSection(issues) {
    const issueCards = issues.map((issue, idx) => this._renderIssueCard(issue, idx)).join('');
    
    return `
      <h3 class="aa-section-title">Accessibility Issues (${issues.length})</h3>
      <div class="aa-issues-container">
        ${issueCards}
      </div>
    `;
  }

  _renderIssueCard(issue, idx) {
    const isExpanded = this._expandedIssues.has(idx);
    const severity = (issue.severity || issue.impact || 'unknown').toLowerCase();
    const wcag = issue.wcagCriteria || issue.wcag || [];
    const section508 = issue.section508 || [];
    const ada = issue.adaRequirement || issue.ada || '';
    const disabilities = issue.disabilityImpact || issue.disabilities || [];
    const effort = issue.effortToFix || issue.effort || 'Unknown';
    
    // Generate badges
    let badgesHtml = `<span class="aa-badge severity-${severity}">${severity}</span>`;
    
    if (Array.isArray(wcag) && wcag.length > 0) {
      wcag.slice(0, 2).forEach(w => {
        badgesHtml += `<span class="aa-badge wcag">${w}</span>`;
      });
    }
    
    if (Array.isArray(section508) && section508.length > 0) {
      badgesHtml += `<span class="aa-badge section508">§508</span>`;
    }
    
    if (ada) {
      badgesHtml += `<span class="aa-badge ada">ADA</span>`;
    }

    // Disability icons
    const disabilityIcons = {
      'visual': '👁️',
      'blind': '👁️',
      'motor': '🖐️',
      'mobility': '🖐️',
      'cognitive': '🧠',
      'hearing': '👂',
      'deaf': '👂'
    };

    let disabilityHtml = '';
    if (disabilities.length > 0) {
      disabilityHtml = `
        <div class="aa-detail-section">
          <div class="aa-detail-label">Affects Users With</div>
          <div class="aa-disability-tags">
            ${disabilities.map(d => {
              const iconKey = Object.keys(disabilityIcons).find(k => d.toLowerCase().includes(k));
              const icon = iconKey ? disabilityIcons[iconKey] : '♿';
              return `<span class="aa-disability-tag"><span class="icon">${icon}</span>${d}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Code fix section
    let codeFixHtml = '';
    if (issue.currentCode || issue.suggestedCode || issue.codeExample) {
      const before = issue.currentCode || issue.codeExample?.before || '';
      const after = issue.suggestedCode || issue.codeExample?.after || '';
      
      if (before || after) {
        codeFixHtml = `
          <div class="aa-detail-section">
            <div class="aa-detail-label">Code Fix</div>
            <div class="aa-code-grid">
              ${before ? `
                <div class="aa-code-block before">
                  <span class="code-label">❌ Before</span>
                  <pre>${this._escapeHtml(before)}</pre>
                </div>
              ` : ''}
              ${after ? `
                <div class="aa-code-block after">
                  <span class="code-label">✅ After</span>
                  <pre>${this._escapeHtml(after)}</pre>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    // Selector section
    let selectorHtml = '';
    const selector = issue.selector || issue.cssSelector || (issue.selectors && issue.selectors[0]);
    if (selector) {
      selectorHtml = `
        <div class="aa-detail-section">
          <div class="aa-detail-label">CSS Selector</div>
          <div class="aa-selector">${this._escapeHtml(selector)}</div>
        </div>
      `;
    }

    return `
      <div class="aa-issue-card ${isExpanded ? 'expanded' : ''}" data-issue-idx="${idx}">
        <div class="aa-issue-header">
          <div class="aa-issue-title-area">
            <h4 class="aa-issue-title">${this._escapeHtml(issue.title || issue.id || 'Issue')}</h4>
            <p class="aa-issue-description">${this._escapeHtml(issue.description || issue.help || '')}</p>
            <div class="aa-issue-badges">${badgesHtml}</div>
          </div>
          <div class="aa-issue-meta">
            <span class="aa-effort-badge">${effort}</span>
            <div class="aa-toggle-icon">▼</div>
          </div>
        </div>
        <div class="aa-issue-details">
          ${disabilityHtml}
          ${selectorHtml}
          ${codeFixHtml}
          ${issue.remediation || issue.howToFix ? `
            <div class="aa-detail-section">
              <div class="aa-detail-label">How to Fix</div>
              <p style="margin: 0; color: var(--aa-text-secondary); font-size: 14px; line-height: 1.6;">
                ${this._escapeHtml(issue.remediation || issue.howToFix)}
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderUIIssuesSection(uiIssues) {
    // Group issues by breakpoint
    const grouped = {};
    uiIssues.forEach(issue => {
      const bp = issue.breakpoint || 'unknown';
      if (!grouped[bp]) grouped[bp] = [];
      grouped[bp].push(issue);
    });
    
    // Group by type within each breakpoint for summary
    const typeCounts = {};
    uiIssues.forEach(issue => {
      const type = issue.type || 'other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Create type summary badges
    const typeBadges = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `<span class="ui-type-badge">${type}: ${count}</span>`)
      .join('');
    
    // Create breakpoint tabs
    const breakpoints = Object.keys(grouped).sort();
    const tabsHtml = breakpoints.map((bp, idx) => 
      `<button class="ui-tab ${idx === 0 ? 'active' : ''}" data-bp="${bp}">${bp} (${grouped[bp].length})</button>`
    ).join('');
    
    // Create content panels with limited items (show first 10, paginated)
    const panelsHtml = breakpoints.map((bp, idx) => {
      const issues = grouped[bp];
      const pageSize = 10;
      const totalPages = Math.ceil(issues.length / pageSize);
      const firstPage = issues.slice(0, pageSize);
      
      return `
        <div class="ui-panel ${idx === 0 ? 'active' : ''}" data-bp="${bp}">
          <div class="ui-issues-compact-list">
            ${firstPage.map((issue, i) => `
              <div class="ui-issue-row">
                <span class="ui-issue-num">${i + 1}</span>
                <span class="ui-issue-type">${this._escapeHtml(issue.type || 'UI Issue')}</span>
                <code class="ui-issue-selector">${this._escapeHtml((issue.selector || '').slice(0, 50))}${(issue.selector || '').length > 50 ? '...' : ''}</code>
              </div>
            `).join('')}
          </div>
          ${issues.length > pageSize ? `
            <div class="ui-pagination">
              <span class="ui-page-info">Showing 1-${pageSize} of ${issues.length}</span>
              <div class="ui-page-controls">
                <button class="ui-page-btn" data-bp="${bp}" data-page="1" data-total="${totalPages}" disabled>← Prev</button>
                <span class="ui-page-num">Page 1 of ${totalPages}</span>
                <button class="ui-page-btn ui-next" data-bp="${bp}" data-page="2" data-total="${totalPages}">Next →</button>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <div class="aa-ui-issues-section">
        <div class="aa-ui-issues-header" data-action="toggle-ui-issues">
          <h3 class="aa-section-title" style="margin: 0;">
            UI Quality Issues 
            <span class="ui-issues-count">${uiIssues.length}</span>
          </h3>
          <div class="ui-issues-summary">
            ${typeBadges}
          </div>
          <button class="ui-expand-btn">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
          </button>
        </div>
        <div class="aa-ui-issues-body collapsed">
          <div class="ui-tabs-bar">
            ${tabsHtml}
          </div>
          <div class="ui-panels-container">
            ${panelsHtml}
          </div>
        </div>
      </div>
    `;
  }

  _renderTopFixes(topFixes) {
    return `
      <h3 class="aa-section-title">Top Priority Fixes</h3>
      <div class="aa-top-fixes-list">
        ${topFixes.map((fix, idx) => `
          <div class="aa-top-fix-item">
            <div class="priority">${idx + 1}</div>
            <div class="fix-content">
              <div class="fix-title">${this._escapeHtml(fix.title || fix.issue || fix.fix || '')}</div>
              <div class="fix-impact">Impact: ${this._escapeHtml(fix.impact || fix.reason || 'High')}</div>
            </div>
            <span class="fix-effort">${this._escapeHtml(fix.effort || fix.effortToFix || 'Unknown')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderRecommendations(recommendations) {
    return `
      <h3 class="aa-section-title">Recommendations</h3>
      <div class="aa-recommendations-list">
        ${recommendations.map((rec, idx) => `
          <div class="aa-recommendation-item">
            <span class="number">${idx + 1}</span>
            <span class="text">${this._escapeHtml(typeof rec === 'string' ? rec : rec.text || rec.recommendation || '')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderActionPlan(actionPlan) {
    const phases = [
      { key: 'immediate', icon: '⚡', title: 'Immediate Actions', timeline: 'Complete within 1 week', cssClass: 'immediate' },
      { key: 'shortTerm', icon: '📅', title: 'Short-Term Actions', timeline: 'Complete within 1 month', cssClass: 'short-term' },
      { key: 'longTerm', icon: '🎯', title: 'Long-Term Actions', timeline: 'Complete within 3 months', cssClass: 'long-term' }
    ];

    const phasesHtml = phases
      .filter(phase => actionPlan[phase.key] && actionPlan[phase.key].length > 0)
      .map(phase => `
        <div class="aa-action-phase ${phase.cssClass}">
          <div class="phase-header">
            <div class="phase-icon">${phase.icon}</div>
            <div>
              <div class="phase-title">${phase.title}</div>
              <div class="phase-timeline">${phase.timeline}</div>
            </div>
          </div>
          <ul class="phase-items">
            ${actionPlan[phase.key].map(item => `
              <li>${this._escapeHtml(typeof item === 'string' ? item : item.action || item.task || '')}</li>
            `).join('')}
          </ul>
        </div>
      `).join('');

    return `
      <h3 class="aa-section-title">Action Plan</h3>
      <div class="aa-action-plan">
        ${phasesHtml}
      </div>
    `;
  }

  _renderBestPractices(bestPractices) {
    return `
      <h3 class="aa-section-title">Best Practices</h3>
      <div class="aa-best-practices">
        ${bestPractices.map(bp => `
          <div class="aa-best-practice-card">
            <div class="bp-category">${this._escapeHtml(bp.category || 'General')}</div>
            <div class="bp-title">${this._escapeHtml(bp.title || bp.practice || '')}</div>
            <div class="bp-description">${this._escapeHtml(bp.description || bp.details || '')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderFooter() {
    const timestamp = new Date().toLocaleString();
    return `
      <footer class="aa-footer">
        <p class="timestamp">Report generated on ${timestamp}</p>
      </footer>
    `;
  }

  _attachEventListeners() {
    // Issue card expand/collapse
    this.shadowRoot.querySelectorAll('.aa-issue-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const card = e.currentTarget.closest('.aa-issue-card');
        const idx = parseInt(card.dataset.issueIdx, 10);
        
        if (this._expandedIssues.has(idx)) {
          this._expandedIssues.delete(idx);
        } else {
          this._expandedIssues.add(idx);
        }
        
        card.classList.toggle('expanded');
      });
    });
    
    // Stat card click to show issues list modal
    this.shadowRoot.querySelectorAll('.aa-stat-card.clickable').forEach(card => {
      card.addEventListener('click', (e) => {
        const severity = card.dataset.severity;
        if (severity && window.showIssuesListModal) {
          window.showIssuesListModal(severity);
        }
      });
    });
    
    // WAVE category click to show issues list modal
    this.shadowRoot.querySelectorAll('.aa-wave-category.clickable').forEach(category => {
      category.addEventListener('click', (e) => {
        const categoryType = category.dataset.category;
        if (categoryType && window.showIssuesListModal) {
          // Map category to severity filter
          const severityMap = {
            'errors': 'Critical',
            'contrast': 'Contrast',
            'alerts': 'Moderate',
            'structural': 'Structural',
            'aria': 'ARIA'
          };
          window.showIssuesListModal(severityMap[categoryType] || categoryType);
        }
      });
    });
    
    // Toggle detailed stats visibility
    this.shadowRoot.querySelectorAll('[data-action="toggle-details"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const detailedStats = this.shadowRoot.querySelector('.aa-detailed-stats');
        if (detailedStats) {
          const isHidden = detailedStats.style.display === 'none';
          detailedStats.style.display = isHidden ? 'grid' : 'none';
          e.currentTarget.classList.toggle('expanded', isHidden);
          e.currentTarget.querySelector('span').textContent = isHidden ? 
            'Hide Detailed Breakdown' : 'View Detailed Breakdown';
        }
      });
    });
    
    // UI Issues section toggle
    this.shadowRoot.querySelectorAll('[data-action="toggle-ui-issues"]').forEach(header => {
      header.addEventListener('click', (e) => {
        const body = this.shadowRoot.querySelector('.aa-ui-issues-body');
        const btn = header.querySelector('.ui-expand-btn');
        if (body) {
          body.classList.toggle('collapsed');
          btn?.classList.toggle('expanded');
        }
      });
    });
    
    // UI Issues breakpoint tabs
    this.shadowRoot.querySelectorAll('.ui-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const bp = tab.dataset.bp;
        // Update active tab
        this.shadowRoot.querySelectorAll('.ui-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Show corresponding panel
        this.shadowRoot.querySelectorAll('.ui-panel').forEach(p => p.classList.remove('active'));
        this.shadowRoot.querySelector(`.ui-panel[data-bp="${bp}"]`)?.classList.add('active');
      });
    });
    
    // UI Issues pagination
    this.shadowRoot.querySelectorAll('.ui-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleUIIssuesPagination(btn);
      });
    });
    
    // Export buttons
    this.shadowRoot.querySelectorAll('.aa-export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this._handleExport(action);
      });
    });
  }
  
  _handleExport(action) {
    if (!this._data) return;
    
    switch (action) {
      case 'export-json':
        this._exportJSON();
        break;
      case 'export-csv':
        this._exportCSV();
        break;
      case 'print':
        window.print();
        break;
    }
  }
  
  _handleUIIssuesPagination(btn) {
    const bp = btn.dataset.bp;
    const page = parseInt(btn.dataset.page, 10);
    const totalPages = parseInt(btn.dataset.total, 10);
    const pageSize = 10;
    
    // Get issues for this breakpoint
    const uiIssues = this._data.uiIssues || this._data.summary?.uiIssues || [];
    const issues = uiIssues.filter(i => (i.breakpoint || 'unknown') === bp);
    
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, issues.length);
    const pageIssues = issues.slice(start, end);
    
    // Update the list
    const panel = this.shadowRoot.querySelector(`.ui-panel[data-bp="${bp}"]`);
    const list = panel?.querySelector('.ui-issues-compact-list');
    if (list) {
      list.innerHTML = pageIssues.map((issue, i) => `
        <div class="ui-issue-row">
          <span class="ui-issue-num">${start + i + 1}</span>
          <span class="ui-issue-type">${this._escapeHtml(issue.type || 'UI Issue')}</span>
          <code class="ui-issue-selector">${this._escapeHtml((issue.selector || '').slice(0, 50))}${(issue.selector || '').length > 50 ? '...' : ''}</code>
        </div>
      `).join('');
    }
    
    // Update pagination controls
    const pagination = panel?.querySelector('.ui-pagination');
    if (pagination) {
      pagination.querySelector('.ui-page-info').textContent = `Showing ${start + 1}-${end} of ${issues.length}`;
      pagination.querySelector('.ui-page-num').textContent = `Page ${page} of ${totalPages}`;
      
      const prevBtn = pagination.querySelector('.ui-page-btn:not(.ui-next)');
      const nextBtn = pagination.querySelector('.ui-page-btn.ui-next');
      
      prevBtn.dataset.page = page - 1;
      prevBtn.disabled = page <= 1;
      
      nextBtn.dataset.page = page + 1;
      nextBtn.disabled = page >= totalPages;
    }
  }
  
  _exportJSON() {
    const dataStr = JSON.stringify(this._data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  _exportCSV() {
    const issues = this._data.issues || [];
    if (issues.length === 0) {
      alert('No issues to export');
      return;
    }
    
    const headers = ['ID', 'Title', 'Severity', 'WCAG Criteria', 'Section 508', 'Selector', 'Suggested Fix', 'Effort'];
    const rows = issues.map(issue => [
      issue.id || '',
      issue.title || '',
      issue.severity || '',
      (issue.wcagCriteria || []).join('; '),
      (issue.section508 || []).join('; '),
      (issue.selectors || []).join('; '),
      (issue.suggestedFix || '').replace(/"/g, '""'),
      issue.effort || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-issues-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

// Register the custom element
customElements.define('ai-accelerator-widget', AIAcceleratorWidget);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAcceleratorWidget;
}
