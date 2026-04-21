// =====================================================================
// invoice.js — Mok Transports Tax Invoice Logic
// All core logic is embedded in invoice.html for portability.

// =====================================================================

// Constants (mirrored from invoice.html)
const INVOICE_FREIGHT  = 15.00;
const INVOICE_OTHERS   = 8.40;
const INVOICE_FUEL_PCT = 0.28;
const INVOICE_VAT_PCT  = 0.15;

// If loaded standalone (invoice.html uses embedded script),
// these are available globally for any external extension.
console.info('[Mok Transports] invoice.js loaded. Core logic runs from invoice.html embedded script.');

