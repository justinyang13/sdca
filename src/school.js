// src/school.js — the school's office contact details: one reader, one fallback. The values live in the settings table (admin → Settings).
import { setting } from './helpers.js';

const FALLBACK = { email: 'Office.SDCA@gmail.com', phone: '(858) 205-7322' };

/** { email, phone } as currently set in the admin settings, with a fixed fallback when a setting is empty. */
export function officeContact(db) {
  return { email: setting(db, 'email_office', 'en') || FALLBACK.email, phone: setting(db, 'phone_digits', 'en') || FALLBACK.phone };
}
