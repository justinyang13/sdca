// src/chat/messages.js — the fixed texts the assistant says itself (no model involved), and which language to answer in.
import { pickLang } from '../i18n/index.js';
import { hasCjk } from './text.js';

/** 'zh' when the question is in Chinese, or is a Chinese-page question with no real English words in it; otherwise 'en'. */
export const replyLang = (question, pageLang) => (hasCjk(question) || (pageLang === 'zh' && !/[a-z]{4,}/i.test(question)) ? 'zh' : 'en');

const reach = (c) => ({ en: `${c.email} or ${c.phone}`, zh: `${c.email} 或 ${c.phone}` });

export function noAnswerMessage(lang, contact) {
  const r = reach(contact);
  return pickLang(lang, `Sorry, I couldn't find that on our website. Please contact the school office: ${r.en}.`, `抱歉，我在網站上找不到這個問題的答案。請聯絡學校辦公室：${r.zh}。`);
}

export function dailyLimitMessage(lang, contact) {
  const r = reach(contact);
  return pickLang(lang, `Sorry, the assistant has reached its limit for today. Please contact the school office: ${r.en}.`, `抱歉，小幫手今天的使用量已滿。請聯絡學校辦公室：${r.zh}。`);
}
