'use strict';
const nodemailer = require('nodemailer');
const config = require('../data/scoring');

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendCompletionEmail({ respondent, score }) {
  const mailer = getTransporter();
  if (!mailer) return;
  const send = [];
  if (respondent.email) {
    const reportUrl = respondent.wants_report && respondent.result_token ? `${process.env.PUBLIC_ORIGIN || ''}/thank-you?report=${respondent.result_token}` : null;
    send.push(mailer.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: respondent.email,
      subject: "Quadrafort's Quantum Risk Readiness Survey — thank you",
      text: `Thank you for completing Quadrafort's Quantum Risk Readiness Survey. Your readiness score is ${score.total}/100 (${score.level}).${reportUrl ? ` Your results report: ${reportUrl}` : ''} Talk with Quadrafort: https://www.quadrafort.com/pages/contactus`,
      html: `<div style="font-family:Arial,sans-serif;color:#242329"><img src="${escapeAttribute(process.env.PUBLIC_ORIGIN || '')}/img/quadrafort-logo.png" alt="Quadrafort" width="180"><h1>Thank you for completing Quadrafort's Quantum Risk Readiness Survey</h1><p>Your quantum readiness score is <strong>${score.total}/100 — ${escapeHtml(score.level)}</strong>.</p>${reportUrl ? `<p><a href="${escapeAttribute(reportUrl)}">View your results report</a></p>` : ''}<p><a href="https://www.quadrafort.com/pages/contactus" style="background:#d73465;color:white;padding:12px 20px;border-radius:24px;text-decoration:none">Talk to Quadrafort</a></p></div>`,
    }));
  }
  if (config.adminNotificationsEnabled && process.env.ADMIN_EMAIL) {
    send.push(mailer.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "New response — Quadrafort's Quantum Risk Readiness Survey",
      text: `A new survey response was completed. Readiness score: ${score.total}/100 (${score.level}). Sign in to the admin dashboard to review it.`,
    }));
  }
  await Promise.allSettled(send);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
module.exports = { sendCompletionEmail };
