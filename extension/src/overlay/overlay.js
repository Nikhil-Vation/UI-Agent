// Overlay Controller — manages Command Center overlay lifecycle and events
// Handles state subscription, filter toggling, modal interactions, exports

import OverlayRender from './overlay-render.js';
import StateManager from '../ui/state.js';

let stateManager = null;
let unsubscribe = null;
let overlayElement = null;

/**
 * Injects the overlay HTML into the page and initializes event handlers
 * @param {StateManager} sm - Shared state manager instance
 */
export async function injectOverlay(sm) {
  try {
    stateManager = sm;

    // Avoid duplicate overlays
    if (document.getElementById('ui-agent-command-center')) {
      console.warn('[overlay.js] Overlay already injected');
      return;
    }

    // Fetch overlay.html from extension
    const response = await fetch(chrome.runtime.getURL('src/overlay/overlay.html'));
    if (!response.ok) {
      throw new Error(`Failed to fetch overlay.html: ${response.status}`);
    }

    const html = await response.text();

    // Create container and inject
    const container = document.createElement('div');
    container.innerHTML = html;
    overlayElement = container.firstElementChild;

    if (!overlayElement) {
      throw new Error('Failed to parse overlay HTML');
    }

    document.body.appendChild(overlayElement);

    // Initialize event handlers and render
    initializeOverlay();

    // Subscribe to state changes
    unsubscribe = stateManager.subscribe((state) => {
      OverlayRender.renderOverlay(state);
    });

    // Initial render
    OverlayRender.renderOverlay(stateManager.state);

    console.log('[overlay.js] Overlay injected and initialized');
  } catch (e) {
    console.error('[overlay.js] Failed to inject overlay', e);
  }
}

/**
 * Initialize overlay DOM event handlers
 */
function initializeOverlay() {
  try {
    OverlayRender.initOverlay();

    // Minimize button
    const minimizeBtn = document.getElementById('overlay-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        toggleMinimize();
      });
    }

    // Close button
    const closeBtn = document.getElementById('overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        removeOverlay();
      });
    }

    // Keyboard support
    document.addEventListener('keydown', handleKeyboard);

    // Prevent outside clicks from closing (if using modal overlay pattern)
    overlayElement?.addEventListener('click', (ev) => {
      // Only close if clicking on the overlay element itself, not children
      if (ev.target === overlayElement) {
        // Could add minimize or close logic here
      }
    });
  } catch (e) {
    console.error('[overlay.js] Failed to initialize overlay', e);
  }
}

/**
 * Handle keyboard interactions
 */
function handleKeyboard(ev) {
  // Escape to minimize overlay
  if (ev.key === 'Escape') {
    toggleMinimize();
  }

  // Alt+Shift+U to toggle overlay visibility
  if (ev.altKey && ev.shiftKey && ev.key === 'U') {
    ev.preventDefault();
    toggleMinimize();
  }
}

/**
 * Toggle minimized state
 */
function toggleMinimize() {
  try {
    if (!overlayElement) return;

    const isMinimized = overlayElement.getAttribute('data-minimized') === 'true';
    overlayElement.setAttribute('data-minimized', !isMinimized);

    const minimizeBtn = document.getElementById('overlay-minimize');
    if (minimizeBtn) {
      minimizeBtn.setAttribute('aria-label', isMinimized ? 'Minimize' : 'Expand');
      minimizeBtn.textContent = isMinimized ? '−' : '−';
    }
  } catch (e) {
    console.error('[overlay.js] Failed to toggle minimize', e);
  }
}

/**
 * Remove overlay from DOM and cleanup
 */
export function removeOverlay() {
  try {
    if (overlayElement) {
      overlayElement.remove();
      overlayElement = null;
    }

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    document.removeEventListener('keydown', handleKeyboard);

    console.log('[overlay.js] Overlay removed');
  } catch (e) {
    console.error('[overlay.js] Failed to remove overlay', e);
  }
}

/**
 * Programmatically set overlay visibility
 */
export function setOverlayVisible(visible) {
  try {
    if (!overlayElement) return;
    overlayElement.hidden = !visible;
  } catch (e) {
    console.error('[overlay.js] Failed to set overlay visibility', e);
  }
}

/**
 * Get current overlay element
 */
export function getOverlayElement() {
  return overlayElement;
}

export default { injectOverlay, removeOverlay, setOverlayVisible, getOverlayElement };
