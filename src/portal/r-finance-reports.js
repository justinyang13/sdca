// src/portal/r-finance-reports.js — /portal/finance/reports: daily deposit, unpaid registrations (aging), year summary, scrip. HTML + CSV.
import { currentYear, money } from './fees.js';
import { audit, csvEscape } from './crud.js';
import { dailyDeposit, aging, yearSummary, scripReport } from './finance-reports.js';
import { portalHelpers } from './util.js';
import { todayLocal, fmtDateTime, nowUtc } from '../datetime.js';

const REPORTS = ['daily', 'aging', 'summary', 'scrip'];
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const cents = (n) => (Number(n || 0) / 100).toFixed(2);

export function registerFinanceReportRoutes(app, { db, page, requireLogin }) {
  const { forbidden, staffCan } = portalHelpers(page);
  const R = '/:lang/portal';

  app.get(`${R}/finance/reports`, requireLogin, (req, res) => {
    if (!staffCan(req, 'finance.reports')) return forbidden(req, res);
    const report = REPORTS.includes(req.query.report) ? req.query.report : 'daily';
    const years = db.prepare('SELECT * FROM school_years WHERE deleted_at IS NULL ORDER BY label DESC').all();
    const year = years.find((y) => y.id === Number(req.query.year)) || currentYear(db);
    const today = todayLocal();
    let from = isDay(req.query.from) ? req.query.from : today; let to = isDay(req.query.to) ? req.query.to : from;
    if (to < from) [from, to] = [to, from];
    const data = report === 'daily' ? dailyDeposit(db, from, to) : report === 'aging' ? aging(db, year.id, today) : report === 'summary' ? yearSummary(db, year.id) : scripReport(db, year.id);
    if (req.query.format === 'csv') {
      const lines = csvOf(report, data, year);
      audit(db, 'transactions', null, `finance_report_${report}_csv`, null, { from, to, year: year.id }, req.portal.user.id, req.ip);
      return res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="finance-${report}-${report === 'daily' ? from + (to !== from ? '_' + to : '') : year.label}.csv"`).send('﻿' + lines.map((l) => l.map(csvEscape).join(',')).join('\r\n'));
    }
    page(req, res, 'finance-reports.ejs', { report, data, years, year, from, to, today, generated: fmtDateTime(nowUtc()) }, { title: 'Finance Reports' });
  });

  function csvOf(report, d, year) {
    if (report === 'daily') {
      const out = [['Date', 'Payment method', 'Type', 'Family', 'Check #', 'Amount', 'Direction', 'Recorded by', 'Registration', 'Transaction']];
      for (const g of d.groups) { for (const r of g.rows) out.push([r.transaction_date, g.method_en, r.type_en, r.family || '', r.check_number, cents(r.signed_cents), r.direction, r.recorded_by || '', r.registration_id || '', r.id]); out.push(['', g.method_en, 'SUBTOTAL', '', '', cents(g.net)]); }
      out.push(['', '', 'TOTAL NET', '', '', cents(d.net)]); return out;
    }
    if (report === 'aging') return [['Registration', 'Family', 'Email', 'Submitted', 'Days waiting', 'Total', 'Paid', 'Balance'], ...d.rows.map((r) => [r.id, r.family || '', r.email || '', r.submitted_on, r.days, cents(r.grand_total_cents), cents(r.paid_cents), cents(r.balance_cents)]), ['', '', '', '', 'TOTAL', '', '', cents(d.total)]];
    if (report === 'summary') {
      const o = [[`School year ${year.label}`], [], ['Money by type', 'Direction', 'Count', 'Amount']];
      d.byType.forEach((r) => o.push([r.type_en, r.direction, r.n, cents(r.cents)])); o.push(['Received', '', '', cents(d.received)], ['Returned', '', '', cents(d.returned)], ['Net', '', '', cents(d.net)], [], ['Money by payment method', '', 'Count', 'Net amount']);
      d.byMethod.forEach((r) => o.push([r.method_en, '', r.n, cents(r.cents)])); o.push([], ['Registrations billed by class type', 'Students', 'Registration fees', 'Early discounts', 'Tuition', 'Misc fees', 'Sibling discounts', 'Net']);
      d.billing.forEach((r) => o.push([r.class_en, r.students, cents(r.registration), cents(-r.early), cents(r.tuition), cents(r.misc), cents(-r.sibling), cents(r.net)]));
      o.push([], ['Registrations', d.regs.n], ['Billed (incl. service fee, scrip deposit and scrip purchase)', '', '', cents(d.regs.billed)], ['Collected', '', '', cents(d.regs.collected)], ['Outstanding', '', '', cents(d.regs.outstanding)]); return o;
    }
    return [['Vendor', 'Product', 'Denomination', 'Sold qty', 'Sold amount', 'Redeemed / refunded qty', 'Redeemed / refunded amount'], ...d.products.map((p) => [p.vendor, p.product, cents(p.denomination), p.sold_qty, cents(p.sold_cents), p.out_qty, cents(p.out_cents)]),
      [], ['Committed at registration', '', '', '', cents(d.committed)], ['Purchases recorded', '', '', '', cents(d.purchased)], ['Shortfall', '', '', '', cents(d.shortfall)]];
  }
}
