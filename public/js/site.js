'use strict';
const menuButton = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
if (menuButton && mobileNav) menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  mobileNav.setAttribute('aria-hidden', String(!open));
});
const banner = document.getElementById('cookie-banner');
if (banner && !localStorage.getItem('qf-cookie-choice')) banner.hidden = false;
if (banner && localStorage.getItem('qf-cookie-choice')) {
  fetch('/api/cookie-choice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice: localStorage.getItem('qf-cookie-choice') }) }).catch(() => {});
  if (localStorage.getItem('qf-cookie-choice') === 'accept' && window.location.pathname === '/') fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
}
if (banner) banner.querySelectorAll('[data-cookie-choice]').forEach((button) => button.addEventListener('click', () => {
  const choice = button.dataset.cookieChoice;
  localStorage.setItem('qf-cookie-choice', choice);
  fetch('/api/cookie-choice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) }).catch(() => {});
  if (choice === 'accept' && window.location.pathname === '/') fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  banner.hidden = true;
}));
