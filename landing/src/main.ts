import './main.css';

const defaultOrigin = 'https://app.cardgoose.com';
const appOrigin = (import.meta.env.VITE_APP_ORIGIN ?? defaultOrigin).replace(/\/$/, '');

for (const el of document.querySelectorAll<HTMLAnchorElement>('a[data-app-link]')) {
  const path = el.getAttribute('data-path') ?? '';
  el.href = `${appOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}
