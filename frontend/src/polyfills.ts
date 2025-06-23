/**
 * Polyfills for browser environment
 */

// Polyfill for Buffer
(window as any).global = window;
global.Buffer = global.Buffer || require('buffer').Buffer;

// Polyfill for process
(window as any).process = require('process/browser');
global.process = (window as any).process; 