'use strict';
const loginPanel = document.getElementById('login-panel');
const dashboard = document.getElementById('dashboard');
let csrfToken = '';
let page = 1;
let total = 0;
const limit = 25;
let searchTimer;
let questionChart;
let dashboardData;
const questions = [
  ['A1','Which sector does your organization operate in?'],['A2','How many employees does your organization have?'],['A3','Which best describes your role?'],['A4','Which regulators or frameworks apply to your organization?'],['A5','Do you operate or handle data across multiple countries?'],
  ['B1','How familiar are you with the quantum threat?'],['B2','Have you heard of harvest now, decrypt later?'],['B3','How aware are you of NIST PQC standards?'],['B4','When will a cryptographically relevant quantum computer exist?'],
  ['C1','Has quantum risk been discussed with leadership?'],['C2','Does a named person or team own PQC readiness?'],['C3','Is quantum risk in your risk register?'],['C4','Has PQC readiness budget been allocated?'],
  ['D1','Do you have a cryptographic asset inventory?'],['D2','Where is public-key cryptography used?'],['D3','Do you hold data confidential for 10+ years?'],['D4','How well do you know supplier cryptography dependencies?'],['D5','How much legacy technology do you operate?'],
  ['E1','How crypto-agile are your systems?'],['E2','What is your current PQC migration stage?'],['E3','Do you have a migration roadmap?'],['E4','Have you asked vendors about PQC plans?'],['E5','Are you testing hybrid or PQC algorithms?'],['E6','When will critical systems migration complete?'],
  ['F1','What are your biggest challenges?'],['F2','What help would be most useful?'],['F3','How confident are you in quantum readiness?'],['F4','Anything else to share?'],
];
async function api(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers });
  const type = response.headers.get('content-type') || '';
  if (!response.ok) { const data = type.includes('json') ? await response.json() : {}; throw new Error(data.error || `Request failed (${response.status}).`); }
  return type.includes('json') ? response.json() : response.text();
}
function safe(value) { const e = document.createElement('span'); e.textContent = value ?? ''; return e.innerHTML; }
function drawQuestionChart() {
  if (!dashboardData || !window.Chart) return;
  const questionId = document.getElementById('question-filter').value || 'A1';
  const sector = document.getElementById('chart-sector').value;
  const from = document.getElementById('chart-from').value;
  const to = document.getElementById('chart-to').value;
  const breakdown = dashboardData.questionBreakdown.filter((entry) => entry.question_id === questionId);
  const labels = []; const values = [];
  for (const entry of breakdown) {
    const value = entry.value;
    const answerValues = Array.isArray(value) ? value : [value];
    for (const answer of answerValues) {
      const label = String(answer);
      const existing = labels.indexOf(label);
      if (existing === -1) { labels.push(label); values.push(entry.count); }
      else values[existing] += entry.count;
    }
  }
  const canvas = document.getElementById('question-chart');
  if (questionChart) questionChart.destroy();
  questionChart = new Chart(canvas, { type: ['A4','D2','F1','F2'].includes(questionId) ? 'bar' : 'bar', data: { labels, datasets: [{ label: 'Responses', data: values, backgroundColor: '#d73465', borderRadius: 5 }] }, options: { indexAxis: labels.length > 6 ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#a9a9b4' }, grid: { color: '#34343d' } }, y: { ticks: { color: '#a9a9b4' }, grid: { color: '#34343d' }, beginAtZero: true } } } });
  canvas.dataset.filters = JSON.stringify({ sector, from, to });
}
async function loadStats(filters = {}) {
  const params = new URLSearchParams(filters);
  const data = await api(`/api/admin/stats${params.size ? `?${params}` : ''}`);
  dashboardData = data;
  const stats = [['Total visits', data.visits], ['Started', data.started], ['Completed', data.completed], ['Completion rate', `${data.completionRate}%`], ['Average score', `${data.averageScore}/100`]];
  document.getElementById('stats').innerHTML = stats.map(([label, value]) => `<div class="admin-stat"><span>${safe(label)}</span><strong>${safe(String(value ?? 0))}</strong></div>`).join('');
  const chart = document.getElementById('daily-chart');
  chart.innerHTML = data.daily.length ? `<div class="options">${data.daily.map((item) => `<div class="section-score"><div class="section-score-header"><span>${safe(new Date(item.day).toLocaleDateString())}</span><strong>${item.count}</strong></div><div class="score-bar" role="meter" aria-valuemin="0" aria-valuemax="${Math.max(...data.daily.map((entry) => entry.count), 1)}" aria-valuenow="${item.count}"><span data-bar-width="${Math.max(4, item.count / Math.max(...data.daily.map((entry) => entry.count), 1) * 100)}"></span></div></div>`).join('')}</div>` : '<p>No completed responses yet.</p>';
  chart.querySelectorAll('[data-bar-width]').forEach((bar) => { bar.style.width = `${bar.dataset.barWidth}%`; });
  const sector = document.getElementById('sector-filter');
  const sectorOptions = data.bySector.map((item) => `<option value="${safe(item.label)}">${safe(item.label)} (${item.count})</option>`).join('');
  sector.innerHTML = '<option value="">All sectors</option>' + sectorOptions;
  document.getElementById('chart-sector').innerHTML = '<option value="">All sectors</option>' + sectorOptions;
  document.getElementById('question-filter').innerHTML = questions.map(([id, label]) => `<option value="${id}">${id} · ${safe(label)}</option>`).join('');
  drawQuestionChart();
}
async function refreshQuestionChart() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ sector: document.getElementById('chart-sector').value, from: document.getElementById('chart-from').value, to: document.getElementById('chart-to').value })) if (value) params.set(key, value);
  try { dashboardData = await api(`/api/admin/stats?${params}`); drawQuestionChart(); }
  catch (error) { document.getElementById('list-error').textContent = error.message; }
}
async function loadResponses() {
  const message = document.getElementById('list-error'); message.textContent = '';
  const params = new URLSearchParams({ page, limit, q: document.getElementById('search').value, sector: document.getElementById('sector-filter').value, from: document.getElementById('from-date').value, to: document.getElementById('to-date').value });
  try {
    const data = await api(`/api/admin/responses?${params}`); total = data.total;
    document.getElementById('response-rows').innerHTML = data.responses.map((item) => `<tr><td>${safe(new Date(item.created_at).toLocaleString())}</td><td>${safe(item.name || '—')}</td><td>${safe(item.organization || '—')}</td><td>${safe(item.sector || '—')}</td><td>${item.total}/100 · ${safe(item.level)}</td><td><button class="button secondary small" type="button" data-action="view" data-id="${safe(item.id)}">View</button> <button class="button secondary small" type="button" data-action="delete" data-id="${safe(item.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No responses match these filters.</td></tr>';
    document.getElementById('page-info').textContent = `Page ${page} · ${total} response${total === 1 ? '' : 's'}`;
    document.getElementById('previous-page').disabled = page <= 1; document.getElementById('next-page').disabled = page * limit >= total;
  } catch (error) { message.textContent = error.message; }
}
async function openDashboard() {
  try { const data = await api('/api/admin/csrf'); csrfToken = data.csrfToken; loginPanel.hidden = true; dashboard.hidden = false; await Promise.all([loadStats(), loadResponses()]); }
  catch { loginPanel.hidden = false; dashboard.hidden = true; }
}
document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const error = document.getElementById('login-error'); error.textContent = '';
  try {
    const tokenData = await api('/api/admin/login-token'); csrfToken = tokenData.csrfToken;
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    csrfToken = result.csrfToken; await openDashboard();
  } catch (e) { error.textContent = e.message; }
});
document.getElementById('logout').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {} location.reload(); });
document.getElementById('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; loadResponses(); }, 250); });
for (const id of ['sector-filter', 'from-date', 'to-date']) document.getElementById(id).addEventListener('change', () => { page = 1; loadResponses(); });
document.getElementById('question-filter').addEventListener('change', drawQuestionChart);
for (const id of ['chart-sector', 'chart-from', 'chart-to']) document.getElementById(id).addEventListener('change', refreshQuestionChart);
document.getElementById('previous-page').addEventListener('click', () => { page = Math.max(1, page - 1); loadResponses(); });
document.getElementById('next-page').addEventListener('click', () => { if (page * limit < total) page += 1; loadResponses(); });
document.getElementById('response-rows').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'view') {
    try {
      const record = await api(`/api/admin/responses/${encodeURIComponent(id)}`); const panel = document.getElementById('detail-panel');
      panel.hidden = false; panel.innerHTML = `<h2>Response details</h2><p><strong>Submitted:</strong> ${safe(new Date(record.created_at).toLocaleString())}</p><p><strong>Contact:</strong> ${safe(record.name || 'Not provided')} · ${safe(record.email || 'No email')} · ${safe(record.organization || 'No organization')}</p><p><strong>Readiness:</strong> ${record.total}/100 · ${safe(record.level)}</p>${record.answers.map((answer) => `<p><strong>${safe(answer.question_id)}:</strong> ${safe(JSON.stringify(answer.value))}</p>`).join('')}`; panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { document.getElementById('list-error').textContent = error.message; }
  }
  if (action === 'delete' && window.confirm('Permanently delete this respondent’s contact details, answers and score? This action cannot be undone.')) {
    try { await api(`/api/admin/responses/${encodeURIComponent(id)}`, { method: 'DELETE' }); document.getElementById('detail-panel').hidden = true; await Promise.all([loadStats(), loadResponses()]); }
    catch (error) { document.getElementById('list-error').textContent = error.message; }
  }
});
openDashboard();
