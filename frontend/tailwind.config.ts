import type { Config } from 'tailwindcss';

/** Tailwind v4: content paths; @tailwindcss/vite also auto-detects from source. */
const config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
} satisfies Config;

export default config;
