// ═══════════════════════════════════════════
// iOS Detection
// ═══════════════════════════════════════════
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export function hasNotch() {
  const div = document.createElement('div');
  div.style.paddingTop = 'env(safe-area-inset-top)';
  document.body.appendChild(div);
  const value = parseInt(getComputedStyle(div).paddingTop) || 0;
  document.body.removeChild(div);
  return value > 20;
}

// ═══════════════════════════════════════════
// Haptic Feedback
// ═══════════════════════════════════════════
export function haptic(type = 'light') {
  if (navigator.vibrate) {
    switch (type) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(20); break;
      case 'heavy': navigator.vibrate(30); break;
      case 'success': navigator.vibrate([10, 30, 10]); break;
      case 'error': navigator.vibrate([30, 20, 30]); break;
    }
  }
}

// ═══════════════════════════════════════════
// Keyboard Handling
// ═══════════════════════════════════════════
let keyboardVisible = false;
let keyboardListeners = [];

export function onKeyboardChange(callback) {
  keyboardListeners.push(callback);
  return () => { keyboardListeners = keyboardListeners.filter(l => l !== callback); };
}

export function isKeyboardVisible() { return keyboardVisible; }

if (typeof window !== 'undefined' && window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const newVisible = window.visualViewport.height < window.innerHeight * 0.75;
    if (newVisible !== keyboardVisible) {
      keyboardVisible = newVisible;
      keyboardListeners.forEach(cb => cb(keyboardVisible));
    }
  });
}

// ═══════════════════════════════════════════
// Scroll to input (iOS fix)
// ═══════════════════════════════════════════
export function scrollToInput(inputElement, delay = 300) {
  setTimeout(() => {
    inputElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, delay);
}

// ═══════════════════════════════════════════
// Prevent overscroll (bounce)
// ═══════════════════════════════════════════
export function preventOverscroll(element) {
  element.addEventListener('touchstart', () => {
    if (element.scrollTop <= 0) element.scrollTop = 1;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight) {
      element.scrollTop = element.scrollHeight - element.clientHeight - 1;
    }
  }, { passive: true });
}
