'use strict';
const container = document.getElementById('result-content');
const result = JSON.parse(sessionStorage.getItem('qf-survey-result') || 'null');
const reportToken = new URLSearchParams(location.search).get('report');

async function loadResult() {
  if (result?.score) return result;
  if (!reportToken || !/^[0-9a-f]{64}$/.test(reportToken)) return null;
  const response = await fetch(`/api/results/${reportToken}`, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

(async () => {
  const savedResult = await loadResult();
  if (!savedResult?.score) {
    container.innerHTML = '<div class="eyebrow">THANK YOU</div><h1>Your responses have been recorded.</h1><p>Your readiness results are available for this session only. If you just completed the survey on this device, go back to your open survey tab to see them.</p><div class="button-row"><a class="button" href="/survey">Take the Survey</a></div>';
    return;
  }
  window.QFAssessment.render(container, savedResult.score);
})().catch(() => {
  container.innerHTML = '<div role="alert">Your results could not be loaded. Start a new survey or contact Quadrafort for assistance.</div><div class="button-row"><a class="button" href="/survey">Take the Survey</a></div>';
});
