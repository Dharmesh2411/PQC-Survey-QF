'use strict';
const STORAGE_KEY = 'qf-quantum-survey-progress-v1';
const RESULT_KEY = 'qf-survey-result';
const SUBMITTED_KEY = 'qf-survey-submitted';
const CONTACT_FIELDS = ['name', 'email', 'organization', 'designation', 'phone'];

const intro = document.getElementById('survey-intro');
const sectionNav = document.getElementById('section-nav');
const startOverButton = document.getElementById('start-over');
const progressDock = document.getElementById('progress-dock');
const progressFill = document.getElementById('progress-fill');
const progressTrack = document.getElementById('progress-track');
const progressCount = document.getElementById('progress-count');
const form = document.getElementById('survey-form');
const sectionsRoot = document.getElementById('sections');
const formError = document.getElementById('form-error');
const consentSection = document.getElementById('consent-section');
const consentError = document.getElementById('consent-error');
const submitButton = document.getElementById('submit-button');
const assessment = document.getElementById('assessment');

let questions = [];
let questionById = new Map();
let answers = {};
let contact = emptyContact();
let token = '';
let submitting = false;
let turnstileToken = '';
let turnstileSiteKey = '';
let turnstileReady = false;

function emptyContact() {
  return { name: '', email: '', organization: '', designation: '', phone: '', wantsReport: false };
}
function safe(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, contact }));
}
function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return value !== undefined && value !== null && value !== '';
}
function isVisible(item) {
  if (!item.showIf) return true;
  const current = answers[item.showIf.questionId];
  return Array.isArray(current) ? current.includes(item.showIf.value) : current === item.showIf.value;
}
function visibleQuestions() {
  return questions.filter(isVisible);
}
function errorNode(questionId) {
  return document.getElementById(`error-${questionId}`);
}
function setError(questionId, message) {
  const node = errorNode(questionId);
  if (node) node.textContent = message;
}
function clearError(questionId) {
  setError(questionId, '');
}

/* ---------- markup ---------- */

function fieldMarkup(item) {
  if (item.type === 'text') {
    const hint = item.required ? 'required' : 'optional';
    return `<label class="field-label" for="answer-${item.id}">Your answer <span class="field-optional">(${hint}, up to ${item.maxLength || 1000} characters)</span></label><textarea class="field-textarea" id="answer-${item.id}" name="answer-${item.id}" maxlength="${item.maxLength || 1000}"></textarea>`;
  }
  if (item.type === 'dropdown') {
    return `<label class="field-label" for="answer-${item.id}">Choose one</label><select class="field-select" id="answer-${item.id}" name="answer-${item.id}"><option value="">Select an option</option>${item.options.map((option) => `<option value="${safe(option.value)}">${safe(option.label)}</option>`).join('')}</select>`;
  }
  const type = item.type === 'multi' ? 'checkbox' : 'radio';
  const options = `<div class="options" ${item.type === 'multi' ? `data-max="${item.maxSelections}"` : ''}>${item.options.map((option) => `<label class="option"><input type="${type}" name="answer-${item.id}" value="${safe(option.value)}"><span>${safe(option.label)}</span></label>`).join('')}</div>`;
  if (item.type === 'multi') return `${options}<p class="question-help options-hint">Choose up to ${item.maxSelections}.</p>`;
  return options;
}

function questionMarkup(item, number) {
  const tag = item.required ? '<span class="question-tag">Required</span>' : '<span class="question-tag optional">Optional</span>';
  const help = item.helpText ? `<p class="question-help">${safe(item.helpText)}</p>` : '';
  return `<div class="question" id="question-${item.id}" data-question="${item.id}" data-number="${number}">
<div class="question-head"><span class="question-number">Question ${number}</span>${tag}</div>
<fieldset class="question-set" aria-describedby="error-${item.id}">
<legend class="question-title">${safe(item.text)}</legend>
${help}
${fieldMarkup(item)}
</fieldset>
<p class="field-error" id="error-${item.id}" role="alert"></p>
</div>`;
}

function sectionGroups() {
  const groups = [];
  for (const item of questions) {
    const last = groups[groups.length - 1];
    if (last && last.name === item.section) last.items.push(item);
    else groups.push({ name: item.section, items: [item] });
  }
  return groups;
}

function renderSurvey() {
  let number = 0;
  const groups = sectionGroups();
  const pad = (value) => String(value).padStart(2, '0');
  sectionsRoot.innerHTML = groups.map((group, index) => {
    const items = group.items.map((item) => { number += 1; return questionMarkup(item, number); }).join('');
    return `<section class="form-section" id="section-${index + 1}" aria-labelledby="section-title-${index + 1}">
<p class="section-kicker">SECTION ${pad(index + 1)} OF ${pad(groups.length)}</p>
<h2 id="section-title-${index + 1}">${safe(group.name)}</h2>
${items}
</section>`;
  }).join('');
  sectionNav.innerHTML = groups.map((group, index) => `<a href="#section-${index + 1}"><span>${pad(index + 1)}</span>${safe(group.name)}</a>`).join('');
  sectionNav.hidden = groups.length === 0;
}

function syncControl(item) {
  const wrapper = document.getElementById(`question-${item.id}`);
  if (!wrapper) return;
  const value = answers[item.id];
  if (item.type === 'text') {
    const field = wrapper.querySelector('textarea');
    if (field) field.value = typeof value === 'string' ? value : '';
    return;
  }
  if (item.type === 'dropdown') {
    const field = wrapper.querySelector('select');
    if (field) field.value = typeof value === 'string' ? value : '';
    return;
  }
  const selected = Array.isArray(value) ? value : hasValue(value) ? [value] : [];
  wrapper.querySelectorAll('input').forEach((input) => { input.checked = selected.includes(input.value); });
}

function syncAllControls() {
  questions.forEach(syncControl);
  CONTACT_FIELDS.forEach((key) => { document.getElementById(key).value = contact[key] || ''; });
  document.getElementById('wants-report').checked = contact.wantsReport === true;
}

function applyVisibility() {
  let changed = true;
  let guard = questions.length + 1;
  while (changed && guard-- > 0) {
    changed = false;
    for (const item of questions) {
      const wrapper = document.getElementById(`question-${item.id}`);
      if (!wrapper) continue;
      const shouldHide = !isVisible(item);
      if (wrapper.hidden !== shouldHide) wrapper.hidden = shouldHide;
      if (shouldHide && answers[item.id] !== undefined) {
        delete answers[item.id];
        changed = true;
      } else if (!shouldHide && answers[item.id] !== undefined) {
        syncControl(item);
      }
    }
  }
}

function updateProgress() {
  const visible = visibleQuestions();
  const answered = visible.filter((item) => hasValue(answers[item.id])).length;
  const percent = visible.length ? Math.round((answered / visible.length) * 100) : 0;
  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(percent));
  progressCount.textContent = `${answered} of ${visible.length} answered`;
}

/* ---------- answering ---------- */

function applyMultiAnswer(item, wrapper, changedControl) {
  const boxes = [...wrapper.querySelectorAll('input[type="checkbox"]')];
  let message = '';
  if (changedControl.checked && boxes.filter((box) => box.checked).length > item.maxSelections) {
    changedControl.checked = false;
    message = `Choose no more than ${item.maxSelections} options.`;
  }
  let chosen = boxes.filter((box) => box.checked).map((box) => box.value);
  const exclusive = chosen.find((value) => value === 'None' || value === 'Not sure');
  if (exclusive) {
    if (exclusive === 'None' && !item.allowNone) {
      changedControl.checked = false;
      chosen = boxes.filter((box) => box.checked).map((box) => box.value);
      message = 'This option cannot be combined with other choices.';
    } else if (chosen.length > 1) {
      boxes.forEach((box) => { box.checked = box.value === exclusive; });
      chosen = [exclusive];
    }
  }
  answers[item.id] = chosen;
  if (message) setError(item.id, message);
  else if (chosen.length) clearError(item.id);
}

function readContactFromForm() {
  const updated = emptyContact();
  for (const key of CONTACT_FIELDS) updated[key] = document.getElementById(key).value.trim();
  updated.wantsReport = document.getElementById('wants-report').checked;
  contact = updated;
}

function onFieldActivity(event) {
  const control = event.target;
  if (!control || !('closest' in control)) return;
  if (control.closest('#consent-section')) {
    readContactFromForm();
    save();
    if (control.id === 'consent' && control.checked) consentError.textContent = '';
    return;
  }
  const wrapper = control.closest('[data-question]');
  if (!wrapper || wrapper.hidden) return;
  const item = questionById.get(wrapper.dataset.question);
  if (!item) return;
  if (item.type === 'multi') applyMultiAnswer(item, wrapper, control);
  else if (item.type === 'text') answers[item.id] = control.value;
  else answers[item.id] = control.value;
  if (hasValue(answers[item.id])) clearError(item.id);
  save();
  updateProgress();
  if (formError.textContent && !visibleQuestions().some((entry) => entry.required && !hasValue(answers[entry.id]))) formError.textContent = '';
}

/* ---------- validation and submission ---------- */

function validateBeforeSubmit() {
  const problems = [];
  for (const item of visibleQuestions()) {
    clearError(item.id);
    const value = answers[item.id];
    if (item.required && !hasValue(value)) {
      setError(item.id, 'Please answer this question before submitting.');
      problems.push(item);
      continue;
    }
    if (item.type === 'multi' && Array.isArray(value) && value.length > item.maxSelections) {
      setError(item.id, `Choose no more than ${item.maxSelections} options.`);
      problems.push(item);
    }
  }
  return problems;
}

function focusQuestion(item) {
  const wrapper = document.getElementById(`question-${item.id}`);
  if (!wrapper) return;
  wrapper.scrollIntoView({ block: 'center' });
  const control = wrapper.querySelector('input, select, textarea');
  if (control) control.focus({ preventScroll: true });
}

function setConsentError(message, control) {
  consentError.textContent = message;
  if (control) {
    consentSection.scrollIntoView({ block: 'center' });
    control.focus({ preventScroll: true });
  }
}

async function refreshToken() {
  try {
    const response = await fetch('/api/token', { cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    token = typeof data.token === 'string' ? data.token : '';
    return Boolean(token);
  } catch {
    return false;
  }
}

function submissionPayload(consentGiven) {
  const params = new URLSearchParams(location.search);
  const campaign = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map((key) => [key, params.get(key) || '']).filter(([, value]) => value));
  let storedCampaign = {};
  try { storedCampaign = JSON.parse(sessionStorage.getItem('qf-survey-campaign') || '{}') || {}; } catch { storedCampaign = {}; }
  return { answers, contact, consent: consentGiven, submissionToken: token, turnstileToken, ...storedCampaign, ...campaign };
}

async function sendSubmission(consentGiven) {
  return fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify(submissionPayload(consentGiven)),
  });
}

async function submitSurvey(event) {
  event.preventDefault();
  if (submitting) return;
  formError.textContent = '';
  consentError.textContent = '';

  const problems = validateBeforeSubmit();
  if (problems.length) {
    const numbers = problems.map((item) => document.getElementById(`question-${item.id}`)?.dataset.number).filter(Boolean);
    formError.textContent = problems.length === 1
      ? `Question ${numbers[0]} still needs an answer before you can submit.`
      : `${problems.length} questions still need an answer: ${numbers.map((number) => `Question ${number}`).join(', ')}.`;
    focusQuestion(problems[0]);
    return;
  }

  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';

  try {
    const consentControl = document.getElementById('consent');
    const consentGiven = Boolean(consentControl && consentControl.checked);

    readContactFromForm();
    if (contact.wantsReport && !contact.email) return setConsentError('Enter an email address if you would like the results report.', document.getElementById('email'));
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return setConsentError('Enter a valid email address.', document.getElementById('email'));
    if (turnstileSiteKey && !turnstileToken) return setConsentError('Complete the bot verification before submitting.');

    save();

    if (!token && !(await refreshToken())) throw new Error('Your survey session has expired. Refresh the page and try again.');

    let response = await sendSubmission(consentGiven);
    let result = await response.json().catch(() => ({}));
    if (response.status === 403 && /token/i.test(result.error || '') && (await refreshToken())) {
      response = await sendSubmission(consentGiven);
      result = await response.json().catch(() => ({}));
    }
    if (!response.ok) throw new Error(result.error || 'Your responses could not be submitted.');
    if (!result.score) throw new Error('Your responses were received but the assessment could not be prepared. Refresh the page to try again.');

    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
    sessionStorage.setItem(SUBMITTED_KEY, '1');
    localStorage.removeItem(STORAGE_KEY);
    showAssessment(result.score);
  } catch (error) {
    setConsentError(error.message || 'Your responses could not be submitted. Please try again.');
  } finally {
    if (!document.getElementById('assessment') || assessment.hidden) {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Submit and see my assessment';
    }
  }
}

/* ---------- assessment ---------- */

function showAssessment(score, restored = false) {
  intro.hidden = true;
  progressDock.hidden = true;
  form.hidden = true;
  sectionNav.hidden = true;
  startOverButton.hidden = true;
  assessment.hidden = false;
  if (window.QFAssessment) {
    window.QFAssessment.render(assessment, score);
    if (restored) {
      const note = document.createElement('p');
      note.className = 'question-help';
      note.textContent = 'This is the assessment from your most recent submission in this browser tab. Start a new survey to answer again.';
      const heading = assessment.querySelector('h1');
      if (heading) heading.insertAdjacentElement('afterend', note);
    }
    const row = assessment.querySelector('.button-row');
    if (row) {
      const retake = document.createElement('button');
      retake.type = 'button';
      retake.className = 'button secondary';
      retake.textContent = 'Start a new survey';
      retake.addEventListener('click', () => {
        sessionStorage.removeItem(RESULT_KEY);
        sessionStorage.removeItem(SUBMITTED_KEY);
        localStorage.removeItem(STORAGE_KEY);
        location.assign('/survey');
      });
      row.appendChild(retake);
    }
  } else {
    assessment.innerHTML = `<div class="eyebrow">YOUR RESULTS</div><h1>Your responses have been recorded.</h1><p class="question-help">Your PQC Readiness Assessment could not be displayed. Refresh the page to see it.</p>`;
  }
  assessment.scrollIntoView({ block: 'start' });
  assessment.focus({ preventScroll: true });
}

function showLoadError(message) {
  intro.hidden = true;
  progressDock.hidden = true;
  form.hidden = true;
  sectionNav.hidden = true;
  startOverButton.hidden = true;
  assessment.hidden = false;
  assessment.innerHTML = `<div class="eyebrow">SURVEY UNAVAILABLE</div><h1 tabindex="-1">Unable to load the survey</h1><p class="question-help">${safe(message)} Please refresh the page. PostgreSQL must be configured and available for survey sessions and answers.</p><div class="button-row"><a class="button" href="/">Return to the survey home page</a></div>`;
  assessment.focus({ preventScroll: true });
}

/* ---------- setup ---------- */

function readSavedProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    answers = data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) ? data.answers : {};
    contact = data.contact && typeof data.contact === 'object' && !Array.isArray(data.contact) ? { ...emptyContact(), ...data.contact } : emptyContact();
    if (answers._contact) {
      contact = { ...emptyContact(), ...answers._contact, ...contact };
      delete answers._contact;
    }
    for (const key of Object.keys(answers)) if (!questionById.has(key)) delete answers[key];
    return Object.keys(answers).length > 0 || CONTACT_FIELDS.some((key) => contact[key]);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function mountTurnstile() {
  const container = document.getElementById('turnstile-container');
  if (!turnstileSiteKey || !container || container.dataset.rendered === 'true') return;
  const renderWidget = () => {
    if (!window.turnstile || container.dataset.rendered === 'true') return;
    container.dataset.rendered = 'true';
    window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      callback: (value) => { turnstileToken = value; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; },
    });
  };
  if (turnstileReady) { renderWidget(); return; }
  if (document.querySelector('script[data-turnstile]')) return;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.dataset.turnstile = 'true';
  script.onload = () => { turnstileReady = Boolean(window.turnstile); renderWidget(); };
  document.head.appendChild(script);
}

function watchConsentSection() {
  if (!turnstileSiteKey) return;
  if (!('IntersectionObserver' in window)) { mountTurnstile(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      mountTurnstile();
    }
  }, { rootMargin: '240px' });
  observer.observe(consentSection);
}

async function init() {
  const storedResult = sessionStorage.getItem(RESULT_KEY);
  if (sessionStorage.getItem(SUBMITTED_KEY) === '1' && storedResult) {
    try {
      const parsed = JSON.parse(storedResult);
      if (parsed && parsed.score) { showAssessment(parsed.score, true); return; }
    } catch { /* fall through and load a fresh survey */ }
    sessionStorage.removeItem(SUBMITTED_KEY);
    sessionStorage.removeItem(RESULT_KEY);
  }

  try {
    const questionResponse = await fetch('/api/questions');
    if (!questionResponse.ok) throw new Error('Unable to load the survey.');
    questions = await questionResponse.json();
    questionById = new Map(questions.map((item) => [item.id, item]));
    try {
      const tokenResponse = await fetch('/api/token', { cache: 'no-store' });
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        token = tokenData.token || '';
        turnstileSiteKey = tokenData.turnstileSiteKey || '';
      }
    } catch { /* token is fetched again at submit time */ }

    const params = new URLSearchParams(location.search);
    const campaign = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map((key) => [key, params.get(key) || '']).filter(([, value]) => value));
    if (Object.keys(campaign).length) sessionStorage.setItem('qf-survey-campaign', JSON.stringify(campaign));

    renderSurvey();
    const restored = readSavedProgress();
    applyVisibility();
    syncAllControls();
    updateProgress();
    startOverButton.hidden = !restored;

    form.addEventListener('input', onFieldActivity);
    form.addEventListener('change', onFieldActivity);
    form.addEventListener('submit', submitSurvey);
    startOverButton.addEventListener('click', () => {
      answers = {};
      contact = emptyContact();
      localStorage.removeItem(STORAGE_KEY);
      questions.forEach((item) => { clearError(item.id); syncControl(item); });
      form.reset();
      formError.textContent = '';
      consentError.textContent = '';
      updateProgress();
      startOverButton.hidden = true;
      sectionsRoot.scrollIntoView({ block: 'start' });
    });

    watchConsentSection();
    await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  } catch (error) {
    showLoadError(error.message);
  }
}

init();
