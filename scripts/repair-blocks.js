#!/usr/bin/env node
// scripts/repair-blocks.js — Phase DP hand-repairs (Claude, 2026-10-05).
// Restores inline links the parser dropped (as verbatim links-maps, no new
// words), fills the class-placement level texts, merges volunteer/sponsors
// paragraphs split by dropped file blocks. All strings verified against
// research/raw/pages/*.html. Re-run import-blocks.js afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = (s) => path.join(ROOT, 'research', 'blocks', `${s}.json`);
const load = (s) => JSON.parse(fs.readFileSync(B(s), 'utf8'));
const save = (s, d) => fs.writeFileSync(B(s), JSON.stringify(d, null, 2) + '\n');
const isRepaired = (d) => d.notes && d.notes.join(' ').includes('DP repair 2026-10-05');
// richtext body as string whether stored plain or as {text, links}
const rtText = (b) => (typeof b.richtext === 'string' ? b.richtext : (b.richtext && b.richtext.text) || '');
const rtLinks = (b) => (b.richtext && b.richtext.links) || [];
const PAYPAL = 'https://www.paypal.com/donate/?token=hUlAeNF8LsPGFE8BgSVhTLqBhVqtkq_mg-NcOS-gr3IpHTyXEtoR1Ft9dwG01DgzEcAwMm&country.x=US&locale.x=US';
const GOOGLE_TA = 'https://docs.google.com/forms/d/e/1FAIpQLSdDLuL1-ythqDNTFo8BPycBCZWdMoaGnZ2zuPrO9xL_J3iNWg/viewform?usp=send_form';

function assertHas(hay, needle, where) {
  if (!hay.includes(needle)) throw new Error(`repair failed at ${where}: missing ${JSON.stringify(needle.slice(0, 60))}`);
  return hay;
}
// Replace parser link-artifact ' / ' around a link text and attach the map.
function linkifyText(text, pairs, where) {
  let out = text;
  for (const [t, href] of pairs) {
    assertHas(out, t, where);
    out = out.split(` / ${t} / `).join(` ${t} `);
  }
  const links = pairs.map(([t, href]) => ({ t, href }));
  return { text: out, links };
}
function richtext(text, pairs, where, existing) {
  if (!pairs || !pairs.length) return text;
  const have = new Set((existing || []).map((l) => l.t + '|' + l.href));
  const fresh = pairs.filter(([t, href]) => !have.has(t + '|' + href));
  if (!fresh.length) return (existing && existing.length) ? { text, links: existing } : text;
  return linkifyText(text, fresh, where);
}

function main() {
  // ---------- class-placement: fill the 5 empty level image_texts ----------
  {
    const raw = fs.readFileSync(path.join(ROOT, 'research', 'raw', 'pages', 'class-placement.html'), 'utf8');
    const main = (raw.match(/<main[\s\S]*?<\/main>/i) || [''])[0];
    const widgets = [...main.matchAll(/elementor-widget-container">([\s\S]*?)<\/div>\s*<\/div>/g)].map((x) => x[1]);
    const texts = widgets
      .map((w) => w.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 100);
    if (texts.length !== 6) throw new Error(`class widgets: expected 6, got ${texts.length}`);
    const pdfs = ['/pdf/pre-k-intro', '/pdf/beginner-class', '/pdf/regular-class-info', '/pdf/bilingual-class-info', '/pdf/credit-class-info'];
    const d = load('class-placement');
    const slots = d.blocks.map((b, i) => (b.image_text ? i : -1)).filter((i) => i >= 0);
    if (slots.length !== 5) throw new Error(`class image_text slots: expected 5, got ${slots.length}`);
    slots.forEach((bi, k) => {
      const t = texts[k + 1];
      d.blocks[bi].image_text.text = t;
      d.blocks[bi].image_text.links = [{ t, href: pdfs[k] }];
    });
    d.notes.push('DP repair 2026-10-05 (Claude): level texts + whole-paragraph PDF links restored verbatim from raw DOM.');
    save('class-placement', d);
    console.log('class-placement: 5 level texts restored');
  }

  // ---------- ta-program: Contact Us inline link ----------
  {
    const d = load('ta-program');
    if (isRepaired(d)) { console.log('ta-program: already repaired, skip'); }
    else {
    const rt = d.blocks.find((b) => b.richtext && rtText(b).includes('Contact Us'));
    if (!rt) throw new Error('ta Contact Us block missing');
    const fixed = richtext(rtText(rt), [['Contact Us', '/en/contact']], 'ta', rtLinks(rt));
    rt.richtext = fixed;
    d.notes.push('DP repair 2026-10-05 (Claude): Contact Us inline link restored.');
    save('ta-program', d);
    console.log('ta-program: Contact Us link restored');
    }
  }

  // ---------- registration: list links + email links ----------
  {
    const d = load('registration');
    const list = d.blocks.find((b) => b.list);
    if (!list) throw new Error('registration list missing');
    list.list.links = [
      { t: '註冊須知與網路註冊說明', href: '/pdf/registration-notice-chinese' },
      { t: 'Registration Notice and Online Registration Instructions', href: '/pdf/registration-notice-english' },
      { t: '義工工作說明 Volunteer Job Descriptions', href: '/en/parents/volunteer' },
    ];
    for (const l of list.list.links) assertHas(list.list.items.join('\n'), l.t, 'registration-list');
    const rt = d.blocks.find((b) => b.richtext && rtText(b).includes('email'));
    const fixed = richtext(rtText(rt), [
      ['email', 'mailto:office.sdca@gmail.com'],
    ], 'registration', rtLinks(rt));
    rt.richtext = fixed;
    d.notes.push('DP repair 2026-10-05 (Claude): list PDF/volunteer links + email links restored (portal PDFs linked exact, files never captured — ledger).');
    save('registration', d);
    console.log('registration: list + email links restored');
  }

  // ---------- handbook: list links ----------
  {
    const d = load('handbook-and-policy');
    const lists = d.blocks.filter((b) => b.list);
    if (lists.length !== 2) throw new Error('handbook lists');
    lists[0].list.links = [
      { t: '家長須知 Parent Handbook', href: '/pdf/parent-handbook' },
      { t: '學生守則 Student Handbook', href: '/pdf/student-handbook' },
      { t: '學分班規則 Credit Class Attendance and Grading Guidelines', href: '/pdf/credit-class-rules' },
      { t: '旁聽生收費及管理辦法 Policy for Guest Students', href: '/pdf/policy-guest-students' },
      { t: '特殊註冊收費辦法 Policy for Second Semester Late Registration', href: '/pdf/policy-second-semester-late-registration' },
    ];
    lists[1].list.links = [
      { t: '費用支出申報表 Expense Reimbursement Form', href: '/pdf/expense-reimbursement-form' },
      { t: 'TA 申請表 TA Application', href: GOOGLE_TA },
    ];
    for (const l of [...lists[0].list.links, ...lists[1].list.links]) {
      assertHas(lists.map((x) => x.list.items.join('\n')).join('\n'), l.t, 'handbook-list');
    }
    d.notes.push('DP repair 2026-10-05 (Claude): handbook/form list links restored (PDF bytes verified identical to documents rows).');
    save('handbook-and-policy', d);
    console.log('handbook: list links restored');
  }

  // ---------- education-resource: list links (exact old externals) ----------
  {
    const d = load('education-resource');
    const list = d.blocks.find((b) => b.list);
    const hrefs = [
      'http://ic.cheng-tsui.com/', 'http://www.mzchinese.net/', 'https://www.betterchinese.com/',
      'https://www.huayuworld.org/oldindex/edu_in_huayu/learn_huayu_start_run/default.htm',
      'https://www.huayuworld.org/', 'https://www.mdnkids.com/', 'http://www.scccs.net/',
      'http://humanum.arts.cuhk.edu.hk/Lexis/Lindict/',
    ];
    if (list.list.items.length !== hrefs.length) throw new Error('education items/hrefs count');
    list.list.links = list.list.items.map((t, i) => ({ t, href: hrefs[i] }));
    d.notes.push('DP repair 2026-10-05 (Claude): resource list links restored (exact old URLs).');
    save('education-resource', d);
    console.log('education: list links restored');
  }

  // ---------- recreational: Yoga/Celine + Jerry mailto links ----------
  {
    const d = load('adult-recreational-programs');
    const yoga = d.blocks.find((b) => b.richtext && rtText(b).includes('Yoga By Celine'));
    const fixed1 = richtext(rtText(yoga), [['Yoga By Celine', 'mailto:celinew2012@gmail.com']], 'rec-yoga', rtLinks(yoga));
    yoga.richtext = fixed1;
    const bb = d.blocks.find((b) => b.richtext && rtText(b).includes('Jerry'));
    const fixed2 = richtext(rtText(bb), [['Jerry Han', 'mailto:sutsunghan@hotmail.com']], 'rec-jerry', rtLinks(bb));
    bb.richtext = fixed2;
    d.notes.push('DP repair 2026-10-05 (Claude): Yoga/Jerry mailto links restored.');
    save('adult-recreational-programs', d);
    console.log('recreational: mailto links restored');
  }

  // ---------- tcml: application-form heading link ----------
  {
    const d = load('tcml');
    const hd = d.blocks.find((b) => b.heading && b.heading.text.includes('申請表格 Application Form'));
    if (!hd) throw new Error('tcml heading missing');
    hd.heading.links = [{ t: '申請表格 Application Form', href: 'https://forms.gle/qpiqztgvn2zidehd7' }];
    d.notes.push('DP repair 2026-10-05 (Claude): Application Form heading link restored.');
    save('tcml', d);
    console.log('tcml: heading link restored');
  }

  // ---------- staff: principal More links (ZH+EN share one richtext) ----------
  {
    const d = load('staff');
    const rt = d.blocks.find((b) => b.richtext && rtText(b).includes('更多..'));
    if (!rt) throw new Error('staff principal block missing');
    const fixed = richtext(rtText(rt), [
      ['更多..', '/zh/about/principal'],
      ['Read More..', '/en/about/principal'],
    ], 'staff', rtLinks(rt));
    // old has no spaces/slashes around the ZH link: "特刊 。更多.."
    fixed.text = fixed.text.split(' / 更多.. / ').join(' 更多.. ').split('。 更多.. ').join('。更多.. ');
    rt.richtext = fixed;
    d.notes.push('DP repair 2026-10-05 (Claude): principal More links restored (ZH->/zh/about/principal, EN->/en/about/principal).');
    save('staff', d);
    console.log('staff: More links restored');
  }

  // ---------- sponsors: merge donation paras + inline links ----------
  {
    const d = load('sponsors');
    if (isRepaired(d)) { console.log('sponsors: already repaired, skip'); }
    else {
    const bi = d.blocks.findIndex((b) => b.richtext && typeof b.richtext === 'string' && b.richtext.startsWith('Making a Tax Deductible Donation'));
    const b2 = d.blocks[bi].richtext;
    const fi = d.blocks.findIndex((b) => b.file);
    const b4 = d.blocks[fi + 1].richtext;
    assertHas(b2, 'button below.', 'sponsors-b2');
    assertHas(b4, 'Donation through PayPal', 'sponsors-b4');
    let merged = (b2 + ' ' + b4).replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim();
    // restore the dropped file-block label as plain text (PDF never captured — ledger)
    merged = merged.replace('button below. : If you are making a donation by check,',
      'button below. Donation by check : If you are making a donation by check,');
    if (!merged.includes('Donation by check : If you are making')) throw new Error('sponsors merge anchor');
    d.blocks[bi] = { richtext: { text: merged, links: [
      { t: 'Making a Tax Deductible Donation', href: PAYPAL },
      { t: 'Donation through PayPal', href: PAYPAL },
    ] } };
    d.blocks.splice(fi, 1); // drop the unresolvable file block (ledgered)
    const rep = (needle, pairs) => {
      const idx = d.blocks.findIndex((b) => (typeof b.richtext === 'string' ? b.richtext : b.richtext && b.richtext.text || '').includes(needle));
      if (idx < 0) throw new Error(`sponsors block missing: ${needle}`);
      const cur = d.blocks[idx].richtext;
      const text = typeof cur === 'string' ? cur : cur.text;
      const cur0 = d.blocks[idx].richtext;
      const fixed = richtext(text.replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim(), pairs, `sponsors-${needle.slice(0, 20)}`, (cur0 && cur0.links) || []);
      d.blocks[idx] = { richtext: fixed };
    };
    rep('Purchase Scrip on our scrip sale date at school:', [['Purchase Scrip on our scrip sale date at school:', '/en/parents/scrip']]);
    rep('Shop AmazonSmile and Earn Money for SDCA:', [['Shop AmazonSmile and Earn Money for SDCA:', 'http://smile.amazon.com/ch/33-0290580']]);
    rep('Sign up with eScrip', [['Sign up with eScrip', 'http://www.escrip.com/']]);
    rep('Help our school by Shopping through iGive', [['Help our school by Shopping through iGive', 'http://www.igive.com/welcome/warmwelcome.cfm?c=52012']]);
    const adv = d.blocks.findIndex((b) => (typeof b.richtext === 'string' ? b.richtext : '').includes('sdca.board.vice.president@gmail.com'));
    if (adv < 0) throw new Error('sponsors advertise block missing');
    d.blocks[adv] = { richtext: d.blocks[adv].richtext.replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim() };
    d.notes.push('DP repair 2026-10-05 (Claude): donation paras merged (dropped Donation-Form file restated as plain text, PDF never captured — ledger); inline PayPal/scrip/Amazon/eScrip/iGive links restored verbatim.');
    save('sponsors', d);
    console.log('sponsors: merged + links restored');
    }
  }

  // ---------- volunteer: complete ZH/EN leads, drop dead file blocks ----------
  {
    const d = load('volunteer-opportunity');
    if (isRepaired(d)) { console.log('volunteer: already repaired, skip'); }
    else {
    const zh = d.blocks.find((b) => b.richtext && rtText(b).includes('感謝您！'));
    zh.richtext = (zh.richtext.replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim() + ' 義工工作說明').replace('請參考 義工工作說明', '請參考 義工工作說明');
    if (!zh.richtext.includes('請參考 義工工作說明')) throw new Error('volunteer ZH lead');
    const en = d.blocks.find((b) => b.richtext && rtText(b).includes('or contact the PTA Director'));
    en.richtext = ('Please review the Volunteer Job Descriptions ' + en.richtext.replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim());
    if (!en.richtext.startsWith('Please review the Volunteer Job Descriptions or contact')) throw new Error('volunteer EN lead');
    d.blocks = d.blocks.filter((b) => !b.file);
    d.notes.push('DP repair 2026-10-05 (Claude): 請參考/Please-review leads restated as plain text (Volunteer PDFs never captured — ledger); dead file blocks removed.');
    save('volunteer-opportunity', d);
    console.log('volunteer: leads completed, dead files removed');
    }
  }

  // ---------- board: title links to own photos (old full-photo URLs are 404) ----------
  {
    const d = load('board-of-directors');
    if (isRepaired(d)) { console.log('board: already repaired, skip'); }
    else {
    for (const b of d.blocks) {
      if (b.image_text && /PTA DIRECTOR|OPERATION DIRECTOR/.test(b.image_text.title || '')) {
        b.image_text.href = b.image_text.image.src;
      }
    }
    d.notes.push('DP repair 2026-10-05 (Claude): PTA/Operation title links restored against the placed photos (old full-photo URLs 404 — ledger note).');
    save('board-of-directors', d);
    console.log('board: title links restored');
    }
  }

  // ---------- galleries: drop attribute-only captions (lightbox titles never
  // visible as old text; only "20170402 Cultural Day" is visible). Keeps
  // visible-text parity exact; lightbox still works.
  {
    for (const slug of ['board-of-directors', 'volunteer-opportunity']) {
      const d = load(slug);
      if (d.notes.join(' ').includes('attribute-only captions')) { console.log(`${slug}: captions already cleaned, skip`); continue; }
      const raw = fs.readFileSync(path.join(ROOT, 'research', 'raw', 'pages', `${slug}.html`), 'utf8');
      const main = (raw.match(/<main[\s\S]*?<\/main>/i) || [raw])[0];
      const text = main.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      let dropped = 0;
      for (const b of d.blocks) {
        if (b.gallery) {
          for (const it of b.gallery.items) {
            if (it.caption && !text.includes(it.caption)) { it.caption = ''; dropped++; }
          }
        }
      }
      d.notes.push('DP repair 2026-10-05 (Claude): attribute-only captions dropped from gallery items (never visible old text).');
      save(slug, d);
      console.log(`${slug}: dropped ${dropped} attribute-only captions`);
    }
  }

  // ---------- sponsors-2: banner image links (exact old hrefs) ----------
  {
    const d = load('sponsors-2');
    if (isRepaired(d)) { console.log('sponsors-2: already repaired, skip'); }
    else {
    const HREFS = {
      '99Ranch2018Banner.jpg': 'https://www.99ranch.com/',
      'Mandrin-House.jpeg': 'https://mandarinhouselj.com/',
      'Law-Offices-of-Peter-Darwin-Chu.png': 'https://peterchu.com/',
      'C2-Education.png': 'https://www.c2educate.com/',
      'GoldenVisionBanner.png': 'https://www.goldenvision2020.com/cn/golden-plaza-optometry/',
      'East-West-Bank.png': 'https://www.eastwestbank.com/',
    };
    for (const b of d.blocks) {
      if (b.heading) {
        b.heading.links = [{ t: b.heading.text, href: '/en/support/sponsors' }];
      } else if (b.image) {
        const base = b.image.src.split('/').pop();
        if (base === 'Dr.-Liu-ad-banner1.png') {
          // old full-ad target never captured: link to the placed banner itself
          b.image.href = b.image.src;
        } else if (HREFS[base]) {
          b.image.href = HREFS[base];
        } else throw new Error(`sponsors-2 banner without href: ${base}`);
      }
    }
    d.notes.push('DP repair 2026-10-05 (Claude): banner links restored (exact old URLs; Dr.-Liu full-ad target never captured, links to placed banner — ledger).');
    save('sponsors-2', d);
    console.log('sponsors-2: banner links restored');
    }
  }

  // ---------- scrip: flyer is a page-specific post-main CTA (image + google
  // form link); move to end with its exact link target ----------
  {
    const d = load('scrip');
    if (d.notes.join(' ').includes('flyer CTA')) { console.log('scrip: flyer already placed, skip'); }
    else {
    const idx = d.blocks.findIndex((b) => b.image && (b.image.src || '').includes('scrip-flyer'));
    if (idx < 0) throw new Error('scrip flyer block missing');
    const [flyer] = d.blocks.splice(idx, 1);
    flyer.image.href = 'https://docs.google.com/forms/d/e/1FAIpQLSdYuXDFYBCzIIbNRncTlJULU-HausWMaQB6Niy26TRnzmGKyg/viewform?vc=0&c=0&w=1&flr=0&gxids=7628';
    d.blocks.push(flyer);
    d.notes.push('DP repair 2026-10-05 (Claude): flyer CTA moved to end with its exact google-form link target.');
    save('scrip', d);
    console.log('scrip: flyer CTA placed at end');
    }
  }

  // ---------- board: member cards become people-grid blocks (old layout:
  // photo on top, titles/names below, 4 officers + divider + 5 directors) ---
  {
    const d = load('board-of-directors');
    if (d.notes.join(' ').includes('people-grid')) { console.log('board: people-grid already done, skip'); }
    else {
    const out = [];
    let run = [];
    const flush = () => {
      if (run.length >= 2 && run.every((b) => ((b.image_text.text || '').length < 80))) {
        const grp = { people: { cards: run.map((b) => b.image_text), cols: run.length } };
        out.push(grp);
      } else out.push(...run);
      run = [];
    };
    for (const b of d.blocks) {
      if (b.image_text) run.push(b);
      else { flush(); out.push(b); }
    }
    flush();
    d.blocks = out;
    d.notes.push('DP repair 2026-10-05 (Claude): member image_text cards merged into people-grid blocks (old 4+5 card layout).');
    save('board-of-directors', d);
    console.log('board: people-grid done');
    }
  }

  // ---------- board: use the exact old group photo (BOD-1024x721) instead of
  // the duplicate BOD.jpg composite ----------
  {
    const d = load('board-of-directors');
    if (d.notes.join(' ').includes('BOD-1024x721')) { console.log('board: group photo already swapped, skip'); }
    else {
    const idx = d.blocks.findIndex((b) => b.image && (b.image.src || '').includes('BOD.3d3b6140'));
    if (idx < 0) throw new Error('board BOD block missing');
    d.blocks[idx] = { image: {
      src: '/img/old/2026/BOD-1024x721.jpg', alt: '', caption: '', width: null, height: null,
      sha256: '0e7da36b8524b9eb5b4fb3c6c323eb591f04794eef1f9fc8ba179f89d3e983a5',
      local_path: 'research/assets/images/BOD-1024x721.jpg',
    } };
    d.notes.push('DP repair 2026-10-05 (Claude): group photo swapped to the exact old file BOD-1024x721 (was duplicate BOD.jpg composite).');
    save('board-of-directors', d);
    console.log('board: group photo swapped');
    }
  }

  console.log('repairs OK');
}

main();
