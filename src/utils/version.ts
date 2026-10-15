/**
 * Single source of truth for application version.
 * Sourced directly from package.json via Vite define at build/dev time.
 */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.5';
