'use strict';
module.exports = {
  levels: [
    { min: 0, max: 25, label: 'Beginner' },
    { min: 26, max: 50, label: 'Developing' },
    { min: 51, max: 75, label: 'Progressing' },
    { min: 76, max: 100, label: 'Advanced' },
  ],
  scoringSections: ['Awareness of the quantum threat', 'Governance and ownership', 'Cryptographic visibility', 'Readiness and action'],
  estimatedMinutes: 10,
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS || 730),
  adminNotificationsEnabled: process.env.NOTIFY_ADMIN === 'true',
};
