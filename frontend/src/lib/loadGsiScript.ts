const GSI_SRC = 'https://accounts.google.com/gsi/client';

let injectPromise: Promise<void> | null = null;

/** Injects `gsi/client` once and resolves when the script has loaded. */
function ensureGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  if (injectPromise) return injectPromise;

  if (document.querySelector(`script[src="${GSI_SRC}"]`)) {
    // Tag already present (e.g. cached); `load` will not fire again — polling below waits for `oauth2`.
    injectPromise = Promise.resolve();
    return injectPromise;
  }

  injectPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = GSI_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      injectPromise = null;
      reject(new Error('Failed to load Google Sign-In script'));
    };
    document.head.appendChild(el);
  });

  return injectPromise;
}

/** Loads the Google Identity Services client once; safe to call in parallel. */
export async function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.oauth2) return;

  await ensureGsiScript();

  // Microtask-only loops starve the browser: the external script cannot run. Poll with `setTimeout`
  // so the GSI bundle can execute and attach `google.accounts.oauth2`.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (window.google?.accounts?.oauth2) return;
    await new Promise<void>((r) => {
      setTimeout(r, 50);
    });
  }

  throw new Error('Google Sign-In did not initialize');
}
