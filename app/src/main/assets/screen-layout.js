(() => {
  if (window.__revHubScreenLayoutLoaded) return;
  window.__revHubScreenLayoutLoaded = true;

  const style = document.createElement('style');
  style.id = 'revHubScreenLayout';
  style.textContent = `
    html, body {
      width: 100%;
      min-height: 100%;
      height: auto !important;
      overflow-x: hidden !important;
      overflow-y: scroll !important;
      overscroll-behavior-y: auto;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y pinch-zoom;
    }
    body { margin: 0; }
    .app {
      min-height: 100vh;
      min-height: 100dvh;
      height: auto !important;
      overflow: visible !important;
      touch-action: pan-y pinch-zoom;
      padding-top: 12px;
      padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px));
    }
    .page {
      min-height: 0;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      touch-action: pan-y pinch-zoom;
      scroll-margin-top: 16px;
    }
    .nav {
      position: fixed;
      bottom: 0;
      padding-bottom: max(9px, env(safe-area-inset-bottom, 0px));
      touch-action: manipulation;
    }
    #practiceCard, #subjectList, #historyList, #revisionRegistry {
      max-height: none;
      overflow: visible;
      overflow-wrap: anywhere;
    }
    #screenshotQuizDialog { overflow-y: auto; }
    #screenshotQuizDialog .sq-card {
      max-height: calc(100dvh - 32px);
      margin-block: auto;
      padding-bottom: max(22px, env(safe-area-inset-bottom, 0px));
    }
    @media (max-width: 520px) {
      .app { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
      .nav { gap: 2px; }
      .nav button { min-width: 0; flex: 1 1 0; padding-inline: 5px; }
    }
  `;
  document.head.appendChild(style);

  // Do not suppress native touch gestures: vertical swipes scroll the page and
  // two-finger pinch remains available through the WebView zoom controls.
  document.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });
})();
