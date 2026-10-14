// src/portal/resources.js — each role's own "<Role> Resources" block on the landing page (like Secretary Resources):
// quick links to the pages that role works in. A link shows only when the signed-in user holds its permission.
// [English, 中文, path under /portal, permission]
const L = (en, zh, path, perm) => ({ en, zh, path, perm });

const STUDENTS = L('Student List', '學生名單', '/manage/student_list', 'student_list.list');
const VOLUNTEERS = L('Volunteer List', '義工名單', '/manage/volunteer_list', 'volunteer_list.list');
const ROSTER = L('Classes', '班級', '/class-roster', 'reports.class_roster');
const EVENTS = L('Events', '活動', '/manage/events', 'events.list');
const CALENDAR = L('Event Calendar', '活動行事曆', '/events-calendar', 'events.list');
const ANNOUNCE = L('Public Announcements', '公開通告', '/manage/announcements', 'announcements.list');
const CLASSNEWS = L('Class Announcements', '班級通告', '/class-announcements', 'class_announcements.list');
const SLIDES = L('Hero Slides', '首頁橫幅', '/manage/slides', 'slides.list');
const FINREPORTS = L('Finance Reports', '財務報表', '/finance/reports', 'finance.reports');
const TRANSACTIONS = L('Transactions', '交易', '/manage/transactions', 'transactions.list');
const PEOPLE = L('Directory', '通訊錄', '/manage/persons', 'persons.list');
const FAMILIES = L('Families', '家庭', '/manage/families', 'families.list');

export const ROLE_RESOURCES = {
  principal: { title: { en: 'Principal Resources', zh: '校長專區' }, links: [ROSTER, STUDENTS, VOLUNTEERS, L('Registrations', '註冊', '/manage/registrations', 'registrations.list'), FINREPORTS, CLASSNEWS, EVENTS, ANNOUNCE, SLIDES, L('Board Members', '理事', '/manage/board_members', 'board_members.list'), PEOPLE] },
  board_president: { title: { en: 'President Resources', zh: '理事長專區' }, links: [L('Board Members', '理事', '/manage/board_members', 'board_members.list'), L('Registrations', '註冊', '/manage/registrations', 'registrations.list'), STUDENTS, VOLUNTEERS, ROSTER, TRANSACTIONS, FINREPORTS, EVENTS, ANNOUNCE, SLIDES, CLASSNEWS] },
  board_vice_president: { title: { en: 'Vice President Resources', zh: '副理事長專區' }, links: [L('Registrations', '註冊', '/manage/registrations', 'registrations.list'), STUDENTS, VOLUNTEERS, ROSTER, FINREPORTS, EVENTS, ANNOUNCE, L('Board Members', '理事', '/manage/board_members', 'board_members.list')] },
  board_secretary: { title: { en: 'Board Secretary Resources', zh: '執行祕書專區' }, links: [EVENTS, CALENDAR, ANNOUNCE, CLASSNEWS, L('Board Members', '理事', '/manage/board_members', 'board_members.list'), STUDENTS, VOLUNTEERS, PEOPLE, ROSTER] },
  board_treasurer: { title: { en: 'Treasurer Resources', zh: '財務理事專區' }, links: [L('Payment', '付款', '/finance/payment', 'finance.record_payment'), L('Manual Transaction', '手動交易', '/finance/manual/new', 'finance.record_payment'), TRANSACTIONS, FINREPORTS, L('Fees for a School Year', '學年費用設定', '/fees', 'fees.configure'), L('Registrations', '註冊', '/manage/registrations', 'registrations.list'), L('Scrip Products', '禮券商品', '/manage/scrip_products', 'scrip_products.list')] },
  board_editorial: { title: { en: 'Editorial Resources', zh: '編輯組專區' }, links: [SLIDES, ANNOUNCE, EVENTS, CALENDAR, CLASSNEWS, L('Documents (PDFs)', '文件庫', '/manage/documents', 'documents.list'), STUDENTS] },
  board_pta: { title: { en: 'PTA Director Resources', zh: '家長會專區' }, links: [VOLUNTEERS, L('Volunteer Jobs', '義工工作', '/manage/volunteer_jobs', 'volunteer_jobs.list'), L('Volunteer Sign-ups', '義工報名', '/manage/volunteer_signups', 'volunteer_signups.list'), EVENTS, PEOPLE, FAMILIES] },
  board_scrip: { title: { en: 'Scrip Director Resources', zh: '禮券組專區' }, links: [L('Record Scrip Transaction', '登錄禮券交易', '/finance/manual/new', 'finance.record_scrip'), L('Scrip Products', '禮券商品', '/manage/scrip_products', 'scrip_products.list'), TRANSACTIONS, FINREPORTS, FAMILIES, PEOPLE] },
  board_activity: { title: { en: 'Activity Director Resources', zh: '活動組專區' }, links: [EVENTS, CALENDAR, ANNOUNCE, CLASSNEWS, VOLUNTEERS, STUDENTS] },
  board_operation: { title: { en: 'Operation Director Resources', zh: '業務組專區' }, links: [ROSTER, L('Rooms', '教室', '/manage/rooms', 'rooms.list'), L('Textbooks', '課本', '/manage/textbooks', 'textbooks.list'), STUDENTS, VOLUNTEERS, EVENTS] },
};

/** Sections to show for a user: one per role that has an entry, links filtered by permission. */
export function resourcesFor(access, can, P) {
  const out = [];
  for (const code of access.roleCodes || []) {
    const def = ROLE_RESOURCES[code]; if (!def) continue;
    const links = def.links.filter((l) => can(access, l.perm)).map((l) => ({ en: l.en, zh: l.zh, href: P(l.path) }));
    if (links.length) out.push({ code, title: def.title, links });
  }
  return out;
}
