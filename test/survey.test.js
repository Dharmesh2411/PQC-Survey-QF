'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const questions = require('../data/questions');
const { validateAnswers, calculateScore } = require('../server/survey');

function allMaximumAnswers() {
  const answers = {};
  for (const item of questions) {
    if (item.type === 'multi') answers[item.id] = item.id === 'A4' ? ['RBI', 'SEBI'] : item.id === 'D2' ? ['TLS/HTTPS', 'VPN'] : item.section === 'Barriers and needs' ? [item.options[0].value] : [];
    else if (item.type === 'text') answers[item.id] = '';
    else answers[item.id] = item.options.reduce((best, option) => (option.score ?? -1) > (best.score ?? -1) ? option : best, item.options[0]).value;
  }
  return answers;
}

test('all 28 source questions have unique IDs and defined choice metadata', () => {
  assert.equal(questions.length, 28);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  for (const question of questions) {
    assert.ok(question.id && question.section && question.type && question.text);
    assert.ok(Array.isArray(question.options));
    if (['single', 'dropdown', 'scale', 'multi'].includes(question.type)) assert.ok(question.options.length > 0, question.id);
  }
});

test('validation accepts all allowed answers and optional empty text', () => {
  const result = validateAnswers(allMaximumAnswers());
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('validation rejects unexpected IDs, disallowed answers, too many selections and long text', () => {
  const answers = allMaximumAnswers();
  answers.A2 = 'employees';
  answers.F1 = ['Budget', 'Legacy systems', 'Lack of skilled people', 'Competing priorities'];
  answers.F4 = 'x'.repeat(1001);
  answers.injected = 'unexpected';
  const result = validateAnswers(answers);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Unknown question')));
  assert.ok(result.errors.some((error) => error.includes('A2')));
  assert.ok(result.errors.some((error) => error.includes('at most 3')));
  assert.ok(result.errors.some((error) => error.includes('1000 characters')));
});

test('maximum answers score 100 and profile/barrier answers do not affect readiness', () => {
  const answers = allMaximumAnswers();
  const score = calculateScore(answers);
  assert.equal(score.total, 100);
  assert.equal(score.level, 'Advanced');
  assert.deepEqual(Object.values(score.sections), [100, 100, 100, 100]);
  answers.A1 = 'Insurance';
  answers.F1 = ['Budget'];
  assert.equal(calculateScore(answers).total, 100);
});

test('not-sure choices contribute zero and the result identifies a weakest section', () => {
  const answers = allMaximumAnswers();
  for (const id of ['B4']) {
    const question = questions.find((item) => item.id === id);
    if (question.options.some((option) => option.value === 'Not sure')) answers[id] = 'Not sure';
  }
  const score = calculateScore(answers);
  assert.ok(score.total < 100);
  assert.ok(score.sections['Awareness of the quantum threat'] < 100);
  assert.equal(score.weakestSection, 'Awareness of the quantum threat');
});

test('scoring excludes sections without an applicable scored answer', () => {
  const answers = allMaximumAnswers();
  for (const question of questions.filter((item) => item.section === 'Cryptographic visibility')) delete answers[question.id];
  const score = calculateScore(answers);
  assert.equal(score.sections['Cryptographic visibility'], null);
  assert.equal(score.total, 100);
});
