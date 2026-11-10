'use strict';
/* Shared PQC Readiness Assessment renderer used by the survey page and the results page. */
(function () {
  const suggestions = {
    'Awareness of the quantum threat': ['Brief senior leaders on harvest-now-decrypt-later exposure and data lifetimes.', 'Build a shared understanding of current NIST post-quantum standards.', 'Assign an owner to track quantum threat developments and policy changes.'],
    'Governance and ownership': ['Name an accountable executive sponsor and cross-functional readiness team.', 'Add quantum risk to your enterprise risk register and review it regularly.', 'Create a funded readiness plan with clear milestones and ownership.'],
    'Cryptographic visibility': ['Start a cryptographic asset discovery and inventory exercise.', 'Prioritize long-lived sensitive data and systems that depend on public-key cryptography.', 'Ask key vendors and cloud providers for their post-quantum migration plans.'],
    'Readiness and action': ['Define a phased roadmap for critical systems with measurable target dates.', 'Assess crypto-agility and identify the most constrained legacy platforms.', 'Plan controlled pilots for hybrid or post-quantum algorithms with key suppliers.'],
  };

  function text(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  function render(container, score) {
    const focus = score.weakestSection || 'Readiness and action';
    const recommendations = suggestions[focus] || suggestions['Readiness and action'];
    const sectionRows = Object.entries(score.sections).map(([name, value]) => `<div class="section-score"><div class="section-score-header"><strong>${text(name)}</strong><span>${value === null ? 'Not scored' : `${value}/100`}</span></div><div class="score-bar" role="meter" aria-label="${text(name)} readiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value ?? 0}"><span data-bar-width="${value ?? 0}"></span></div></div>`).join('');
    container.innerHTML = `<div class="eyebrow">YOUR PQC READINESS ASSESSMENT</div>
<h1>Thank you for sharing your perspective.</h1>
<p class="question-help">Your assessment is based on the answers you provided and is intended as a starting point for readiness planning.</p>
<div class="score-panel"><div class="score-number">${score.total}<span>/100</span></div><p class="score-level">${text(score.level)}</p><p>Overall post-quantum readiness score</p></div>
<h2>Readiness by section</h2>
${sectionRows}
<div class="result-message"><strong>Strongest section:</strong> ${text(score.strongestSection || 'Not available')}<br><strong>Focus area:</strong> ${text(focus)}</div>
<h2>Suggested next steps</h2>
<ol>${recommendations.map((item) => `<li>${text(item)}</li>`).join('')}</ol>
<div class="button-row"><a class="button" href="https://www.quadrafort.com/pages/contactus">Talk to Quadrafort</a><button class="button secondary" id="copy-link" type="button">Copy survey link</button><a class="button secondary" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(location.origin)}" target="_blank" rel="noopener">Share on LinkedIn</a><a class="button secondary" href="https://wa.me/?text=${encodeURIComponent("Quadrafort's Quantum Risk Readiness Survey " + location.origin)}" target="_blank" rel="noopener">Share on WhatsApp</a></div>`;
    container.querySelectorAll('[data-bar-width]').forEach((bar) => { bar.style.width = `${bar.dataset.barWidth}%`; });
    const copyButton = container.querySelector('#copy-link');
    if (copyButton) copyButton.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.origin); copyButton.textContent = 'Link copied'; }
      catch { copyButton.textContent = 'Copy unavailable'; }
    });
  }

  window.QFAssessment = { render };
})();
