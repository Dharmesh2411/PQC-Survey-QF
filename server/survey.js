'use strict';
const questions = require('../data/questions');
const config = require('../data/scoring');

function isQuestionVisible(question, answers) {
  if (!question.showIf) return true;
  const current = answers[question.showIf.questionId];
  return Array.isArray(current) ? current.includes(question.showIf.value) : current === question.showIf.value;
}

function validateAnswers(answers) {
  const errors = [];
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { valid: false, errors: ['Answers must be an object.'] };
  const knownIds = new Set(questions.map((item) => item.id));
  for (const id of Object.keys(answers)) if (!knownIds.has(id)) errors.push(`Unknown question: ${id}.`);

  for (const item of questions) {
    const visible = isQuestionVisible(item, answers);
    const supplied = Object.prototype.hasOwnProperty.call(answers, item.id);
    if (!visible) {
      if (supplied) errors.push(`${item.id} should not be answered for the current responses.`);
      continue;
    }
    const value = answers[item.id];
    if (!supplied || value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
      if (item.required) errors.push(`${item.id} is required.`);
      continue;
    }
    if (item.type === 'text') {
      if (typeof value !== 'string') errors.push(`${item.id} must be text.`);
      else if (value.length > (item.maxLength || 1000)) errors.push(`${item.id} must be no more than ${item.maxLength || 1000} characters.`);
      continue;
    }
    if (item.type === 'multi') {
      if (!Array.isArray(value)) { errors.push(`${item.id} must be a list of choices.`); continue; }
      if (value.length > item.maxSelections) errors.push(`${item.id} allows at most ${item.maxSelections} choices.`);
      if (new Set(value).size !== value.length) errors.push(`${item.id} contains duplicate choices.`);
      const allowed = new Set(item.options.map((option) => option.value));
      if (value.some((choice) => !allowed.has(choice))) errors.push(`${item.id} contains an invalid choice.`);
      if (value.includes('None') && (value.length > 1 || !item.allowNone)) errors.push(`${item.id}: “None” cannot be combined with other choices.`);
      if (value.includes('Not sure') && value.length > 1) errors.push(`${item.id}: “Not sure” cannot be combined with other choices.`);
      continue;
    }
    if (typeof value !== 'string' || !item.options.some((option) => option.value === value)) errors.push(`${item.id} has an invalid choice.`);
  }
  return { valid: errors.length === 0, errors };
}

function calculateScore(answers) {
  const sections = {};
  for (const section of config.scoringSections) {
    let earned = 0;
    let possible = 0;
    for (const item of questions.filter((q) => q.section === section && isQuestionVisible(q, answers) && Object.hasOwn(answers, q.id))) {
      let selected = answers[item.id];
      if (item.type === 'multi') selected = selected.map((value) => item.options.find((option) => option.value === value)).filter(Boolean);
      else selected = [item.options.find((option) => option.value === selected)].filter(Boolean);
      const scoredOptions = item.options.filter((option) => typeof option.score === 'number');
      if (!scoredOptions.length || item.scoring === false) continue;
      const maxScore = Math.max(...scoredOptions.map((option) => option.score));
      if (item.type === 'multi') {
        const countable = selected.filter((option) => typeof option.score === 'number');
        const slots = Math.min(item.maxSelections, countable.length);
        if (slots === 0) continue;
        earned += countable.reduce((sum, option) => sum + option.score, 0);
        possible += slots * maxScore;
      } else {
        const option = selected[0];
        if (!option || typeof option.score !== 'number') continue;
        earned += option.score;
        possible += maxScore;
      }
    }
    sections[section] = possible ? Math.round(earned / possible * 100) : null;
  }
  const available = Object.values(sections).filter((value) => value !== null);
  const total = available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : 0;
  const level = config.levels.find((item) => total >= item.min && total <= item.max)?.label || 'Beginner';
  const ranked = Object.entries(sections).filter(([, value]) => value !== null).sort((a, b) => a[1] - b[1]);
  return { total, level, sections, weakestSection: ranked[0]?.[0] || null, strongestSection: ranked.at(-1)?.[0] || null };
}

module.exports = { validateAnswers, calculateScore, isQuestionVisible };
