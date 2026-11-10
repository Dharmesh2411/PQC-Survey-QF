'use strict';

const choice = (values, scores = []) => values.map((label, index) => ({
  value: label,
  label,
  score: scores[index] ?? null,
}));
const question = (id, section, type, text, labels, scores, extra = {}) => ({
  id, section, type, text,
  options: labels ? choice(labels, scores || []) : type === 'scale' ? choice(['1', '2', '3', '4', '5'], [0, 1, 2, 3, 4]) : [],
  required: extra.required !== false,
  ...(extra.helpText ? { helpText: extra.helpText } : {}),
  ...(extra.showIf ? { showIf: extra.showIf } : {}),
  ...(extra.maxSelections ? { maxSelections: extra.maxSelections } : {}),
  ...(extra.maxLength ? { maxLength: extra.maxLength } : {}),
});

module.exports = [
  question('A1', 'About your organization', 'dropdown', 'Which sector does your organization operate in?', ['Banking and Financial Services', 'Insurance', 'Capital Markets', 'Fintech and Payments', 'Telecom', 'Government and Public Sector', 'Defence and Aerospace', 'Healthcare', 'IT and IT Services', 'Manufacturing', 'Energy and Utilities', 'Retail and E-commerce', 'Education and Research', 'Other']),
  question('A2', 'About your organization', 'single', 'How many employees does your organization have?', ['1-50', '51-200', '201-1,000', '1,001-5,000', '5,000+']),
  question('A3', 'About your organization', 'single', 'Which best describes your role?', ['CISO or Head of Security', 'CIO or CTO', 'Risk or Compliance Head', 'IT or Security Manager', 'Architect or Engineer', 'Board or CXO', 'Consultant', 'Other']),
  question('A4', 'About your organization', 'multi', 'Which regulators or frameworks apply to your organization?', ['RBI', 'SEBI', 'IRDAI', 'TRAI or DoT', 'CERT-In directions', 'DPDP Act', 'PCI DSS', 'ISO 27001', 'Other', 'None'], null, { maxSelections: 10, allowNone: true }),
  question('A5', 'About your organization', 'single', 'Do you operate or handle data across multiple countries?', ['India only', 'India plus a few countries', 'Global']),

  question('B1', 'Awareness of the quantum threat', 'scale', 'How familiar are you with the threat quantum computing poses to current cryptography?', null, null, { helpText: '1 = Not familiar; 5 = Very familiar' }),
  question('B2', 'Awareness of the quantum threat', 'single', 'Have you heard of “harvest now, decrypt later” attacks?', ['Yes and understand it well', 'Heard of it', 'No'], [4, 2, 0]),
  question('B3', 'Awareness of the quantum threat', 'scale', 'How aware are you of the NIST post-quantum cryptography standards (ML-KEM, ML-DSA, SLH-DSA)?', null, null, { helpText: '1 = Not aware; 5 = Very aware' }),
  question('B4', 'Awareness of the quantum threat', 'single', 'When do you think a quantum computer capable of breaking widely used public-key cryptography will exist?', ['Within 5 years', '5-10 years', '10-20 years', 'More than 20 years', 'Never', 'Not sure'], [3, 4, 3, 2, 0, 0]),

  question('C1', 'Governance and ownership', 'single', 'Has quantum risk been discussed at board or senior leadership level?', ['Yes regularly', 'Yes once', 'No', 'Not sure'], [4, 2, 0, 0]),
  question('C2', 'Governance and ownership', 'single', 'Does a named person or team own quantum or post-quantum readiness?', ['Yes, formally', 'Informally', 'No'], [4, 2, 0]),
  question('C3', 'Governance and ownership', 'single', 'Is quantum risk included in your enterprise risk register?', ['Yes', 'Planned', 'No', 'Not sure'], [4, 2, 0, 0]),
  question('C4', 'Governance and ownership', 'single', 'Has budget been allocated for post-quantum readiness?', ['Yes approved', 'Under discussion', 'No', 'Not sure'], [4, 2, 0, 0]),

  question('D1', 'Cryptographic visibility', 'single', 'Do you have an inventory of the cryptographic assets you use (algorithms, keys, certificates, libraries)?', ['Complete and automated', 'Partial or manual', 'No', 'Not sure'], [4, 2, 0, 0]),
  question('D2', 'Cryptographic visibility', 'multi', 'Where is public-key cryptography used in your environment?', ['TLS/HTTPS', 'VPN', 'PKI and certificates', 'Code signing', 'Databases and storage encryption', 'HSMs', 'Payments and cards', 'IoT and OT devices', 'Email and messaging', 'Cloud KMS', 'Mobile apps', 'Not sure'], null, { maxSelections: 12, allowNone: true, scoring: false }),
  question('D3', 'Cryptographic visibility', 'single', 'Do you hold data that must stay confidential for 10 years or more?', ['Yes, significant amounts', 'Some', 'No', 'Not sure'], [4, 2, 0, 0]),
  question('D4', 'Cryptographic visibility', 'scale', 'How well do you know which vendors, SaaS and third parties in your supply chain use cryptography that will need to change?', null, null, { helpText: '1 = Not at all; 5 = Very well' }),
  question('D5', 'Cryptographic visibility', 'single', 'How much legacy or hard-to-update technology (old systems, embedded devices, hardware) do you run?', ['Very little', 'Some', 'A lot', 'Not sure'], [4, 2, 0, 0]),

  question('E1', 'Readiness and action', 'scale', 'How crypto-agile are your systems (can you change algorithms without major redesign)?', null, null, { helpText: '1 = Not agile; 5 = Very agile' }),
  question('E2', 'Readiness and action', 'single', 'What is your current stage of post-quantum migration?', ['Not started', 'Learning and awareness', 'Assessment or inventory underway', 'Pilot or proof of concept', 'Migration in progress', 'Largely complete'], [0, 1, 2, 3, 3, 4]),
  question('E3', 'Readiness and action', 'single', 'Do you have a documented post-quantum migration roadmap with timelines?', ['Yes approved', 'Draft', 'No'], [4, 2, 0]),
  question('E4', 'Readiness and action', 'single', 'Have you asked your vendors and cloud providers about their post-quantum plans?', ['Yes all key vendors', 'Some', 'No'], [4, 2, 0]),
  question('E5', 'Readiness and action', 'single', 'Are you testing hybrid or post-quantum algorithms anywhere?', ['Yes in production', 'Yes in testing', 'Planning', 'No'], [4, 3, 1, 0]),
  question('E6', 'Readiness and action', 'single', 'By when does your organization plan to complete migration of critical systems?', ['Before 2030', '2030-2033', 'After 2033', 'No plan yet'], [4, 3, 1, 0]),

  question('F1', 'Barriers and needs', 'multi', 'What are your biggest challenges? Choose up to 3.', ['Lack of awareness at leadership level', 'Lack of skilled people', 'Budget', 'Unclear regulatory guidance in India', 'Not enough vendor support', 'Legacy systems', 'Performance and compatibility concerns', 'Unclear business case', 'Competing priorities'], null, { maxSelections: 3 }),
  question('F2', 'Barriers and needs', 'multi', 'What help would be most useful? Choose up to 3.', ['Cryptographic inventory and discovery', 'Risk assessment and roadmap', 'Training and awareness', 'Vendor assessment', 'Proof of concept and testing', 'Regulatory guidance', 'Benchmarking against peers'], null, { maxSelections: 3 }),
  question('F3', 'Barriers and needs', 'scale', 'How would you describe your overall confidence in your organization’s quantum readiness?', null, null, { helpText: '1 = Not confident; 5 = Very confident' }),
  question('F4', 'Barriers and needs', 'text', 'Anything else you would like to share?', null, null, { required: false, maxLength: 1000 }),
];
