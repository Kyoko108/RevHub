(() => {
  if (window.__revHubUiPolishLoaded) return;
  window.__revHubUiPolishLoaded = true;

  const style = document.createElement('style');
  style.id = 'revHubUiPolish';
  style.textContent = `
    /* Keep all revision and quiz controls visibly separated on narrow screens. */
    #revision .row, #practice .row {
      column-gap: 12px;
      row-gap: 12px;
    }
    #revision #conceptDone, #revision #conceptNotDone {
      margin-top: 12px;
    }
    #revision #prevReel, #revision #nextReel,
    #practice #skipQ, #practice #submitQ, #practice #nextQ,
    #practice #rhEditQuestionButton {
      margin: 4px;
    }

    /* Each choice, including the radio-button choices created from screenshots,
       occupies its own full line. Preserve normal wrapping within a long choice. */
    #practiceCard .quiz-choice,
    #practiceCard .choice {
      display: flex !important;
      width: 100% !important;
      max-width: 100%;
      align-items: flex-start;
      white-space: normal;
      overflow-wrap: anywhere;
      margin: 9px 0;
    }
    #practiceCard .quiz-choice span { flex: 1 1 auto; min-width: 0; }

    /* Pink-to-purple animated accent gradient inspired by the provided sample. */
    @keyframes revhub-pink-purple-flow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .logo,
    .hero,
    button:not(.secondary):not(.ghost):not(.danger):not(.nav button) {
      background-image: linear-gradient(135deg,#e64a7d 0%,#ae50a8 50%,#7557d2 100%);
      background-size: 220% 220%;
      animation: revhub-pink-purple-flow 9s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .logo, .hero, button:not(.secondary):not(.ghost):not(.danger):not(.nav button) {
        animation: none;
        background-position: 50% 50%;
      }
    }
  `;
  document.head.appendChild(style);
})();
