/**
 * Vercel Serverless Function entry point.
 * The Express app is exported as default; Vercel's Node.js runtime wraps it.
 */
import { createApp } from '../src/app.js';

export default createApp();
