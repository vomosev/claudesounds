'use strict';

/**
 * Small dependency-free validation helpers shared by the ClaudeSounds controllers.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isEmail(str) {
  if (typeof str !== 'string') return false;
  const value = str.trim();
  if (value.length === 0 || value.length > 254) return false;
  return EMAIL_RE.test(value);
}

function isNonEmptyString(str, max = 255) {
  if (typeof str !== 'string') return false;
  const value = str.trim();
  if (value.length === 0) return false;
  if (typeof max === 'number' && max > 0 && value.length > max) return false;
  return true;
}

function isOneOf(value, list) {
  if (!Array.isArray(list)) return false;
  return list.includes(value);
}

function toInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function isIsoDate(str) {
  if (typeof str !== 'string') return false;
  const value = str.trim().slice(0, 10);
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map((part) => Number(part));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function badRequest(message, details) {
  const err = new Error(message || 'Invalid request');
  err.status = 400;
  if (details !== undefined) err.details = details;
  return err;
}

function httpError(status, message, details) {
  const err = new Error(message || 'Request failed');
  err.status = status || 500;
  if (details !== undefined) err.details = details;
  return err;
}

/**
 * validateBody(body, rules)
 *
 * rules is an object keyed by field name:
 * {
 *   title: { type: 'string', required: true, max: 200, label: 'Title' },
 *   status: { type: 'enum', values: ['draft','live'], default: 'draft' },
 *   budget: { type: 'number', min: 0 },
 *   count:  { type: 'int', min: 1, max: 50 },
 *   date:   { type: 'date', required: true },
 *   email:  { type: 'email', required: true },
 *   flag:   { type: 'boolean', default: false },
 *   items:  { type: 'array', required: true, minLength: 1 }
 * }
 *
 * Returns { valid, errors, value }
 */
function validateBody(body, rules) {
  const errors = {};
  const value = {};
  const source = body && typeof body === 'object' ? body : {};
  const ruleSet = rules && typeof rules === 'object' ? rules : {};

  for (const field of Object.keys(ruleSet)) {
    const rule = ruleSet[field] || {};
    const label = rule.label || field;
    const raw = source[field];
    const missing = raw === undefined || raw === null || raw === '';

    if (missing) {
      if (rule.required) {
        errors[field] = `${label} is required`;
      } else if (Object.prototype.hasOwnProperty.call(rule, 'default')) {
        value[field] = rule.default;
      }
      continue;
    }

    const type = rule.type || 'string';

    switch (type) {
      case 'string': {
        if (typeof raw !== 'string') {
          errors[field] = `${label} must be text`;
          break;
        }
        const trimmed = rule.trim === false ? raw : raw.trim();
        const max = typeof rule.max === 'number' ? rule.max : 255;
        const min = typeof rule.min === 'number' ? rule.min : 0;
        if (trimmed.length < min) {
          errors[field] = `${label} must be at least ${min} characters`;
          break;
        }
        if (trimmed.length > max) {
          errors[field] = `${label} must be ${max} characters or fewer`;
          break;
        }
        if (rule.pattern instanceof RegExp && !rule.pattern.test(trimmed)) {
          errors[field] = rule.message || `${label} is not valid`;
          break;
        }
        value[field] = trimmed;
        break;
      }

      case 'email': {
        if (!isEmail(raw)) {
          errors[field] = `${label} must be a valid email address`;
          break;
        }
        value[field] = String(raw).trim().toLowerCase();
        break;
      }

      case 'enum': {
        const list = Array.isArray(rule.values) ? rule.values : [];
        if (!isOneOf(raw, list)) {
          errors[field] = `${label} must be one of: ${list.join(', ')}`;
          break;
        }
        value[field] = raw;
        break;
      }

      case 'int': {
        const n = toInt(raw, NaN);
        if (!Number.isFinite(n)) {
          errors[field] = `${label} must be a whole number`;
          break;
        }
        if (typeof rule.min === 'number' && n < rule.min) {
          errors[field] = `${label} must be at least ${rule.min}`;
          break;
        }
        if (typeof rule.max === 'number' && n > rule.max) {
          errors[field] = `${label} must be at most ${rule.max}`;
          break;
        }
        value[field] = n;
        break;
      }

      case 'number': {
        const n = toNumber(raw, NaN);
        if (!Number.isFinite(n)) {
          errors[field] = `${label} must be a number`;
          break;
        }
        if (typeof rule.min === 'number' && n < rule.min) {
          errors[field] = `${label} must be at least ${rule.min}`;
          break;
        }
        if (typeof rule.max === 'number' && n > rule.max) {
          errors[field] = `${label} must be at most ${rule.max}`;
          break;
        }
        value[field] = n;
        break;
      }

      case 'boolean': {
        if (typeof raw === 'boolean') {
          value[field] = raw;
        } else if (raw === 'true' || raw === 1 || raw === '1') {
          value[field] = true;
        } else if (raw === 'false' || raw === 0 || raw === '0') {
          value[field] = false;
        } else {
          errors[field] = `${label} must be true or false`;
        }
        break;
      }

      case 'date': {
        if (!isIsoDate(raw)) {
          errors[field] = `${label} must be a date in YYYY-MM-DD format`;
          break;
        }
        value[field] = String(raw).trim().slice(0, 10);
        break;
      }

      case 'array': {
        if (!Array.isArray(raw)) {
          errors[field] = `${label} must be a list`;
          break;
        }
        if (typeof rule.minLength === 'number' && raw.length < rule.minLength) {
          errors[field] = `${label} must contain at least ${rule.minLength} item(s)`;
          break;
        }
        if (typeof rule.maxLength === 'number' && raw.length > rule.maxLength) {
          errors[field] = `${label} must contain at most ${rule.maxLength} item(s)`;
          break;
        }
        value[field] = raw;
        break;
      }

      default: {
        value[field] = raw;
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = {
  isEmail,
  isNonEmptyString,
  isOneOf,
  toInt,
  toNumber,
  isIsoDate,
  badRequest,
  httpError,
  validateBody,
};