// Phase 3 — settings table (school facts)
// Source: research/wiki/school-facts.md (all values verified)

const SETTINGS = [
  // Identity
  { key: 'school_name_en',  value_en: 'San Diego Chinese Academy',            value_zh: '聖地牙哥中華學苑' },
  { key: 'school_name_zh',  value_en: '聖地牙哥中華學苑',                      value_zh: '聖地牙哥中華學苑' },
  { key: 'founded_year',    value_en: '1988',                                 value_zh: '1988' },
  { key: 'tagline_en',      value_en: 'Non-profit language school teaching Mandarin and Chinese culture since 1988', value_zh: '' },
  { key: 'tagline_zh',      value_en: '',                                     value_zh: '非營利語言學校，自1988年起教授華語和中華文化' },
  { key: 'accreditation',   value_en: 'Fully Accredited by WASC',             value_zh: 'WASC 認證學校' },
  { key: 'org_type',        value_en: 'Non-profit California organization',   value_zh: '加州非營利組織' },

  // Location
  { key: 'campus_name',     value_en: 'La Jolla Country Day School, La Jolla', value_zh: 'La Jolla Country Day School, La Jolla' },
  { key: 'campus_since',    value_en: 'Fall 1991',                            value_zh: '1991年秋季' },
  { key: 'original_campus', value_en: 'UCSD (1988–1990)',                     value_zh: 'UCSD（1988-1990）' },
  { key: 'mailing_address', value_en: 'P.O. Box 910093, San Diego, CA 92191-0093', value_zh: 'P.O. Box 910093, San Diego, CA 92191-0093' },

  // Contact
  { key: 'phone',           value_en: '(858) 205-SDCA (7322)',               value_zh: '(858) 205-SDCA (7322)' },
  { key: 'phone_digits',    value_en: '(858) 205-7322',                      value_zh: '(858) 205-7322' },
  { key: 'email_office',    value_en: 'Office.SDCA@gmail.com',               value_zh: 'Office.SDCA@gmail.com' },
  { key: 'email_pta',       value_en: 'sdcapta@gmail.com',                   value_zh: 'sdcapta@gmail.com' },
  { key: 'email_scrip',     value_en: 'sdca.board.scrip.director@gmail.com', value_zh: 'sdca.board.scrip.director@gmail.com' },
  { key: 'email_vp',        value_en: 'sdca.board.vice.president@gmail.com', value_zh: 'sdca.board.vice.president@gmail.com' },
  { key: 'sms_keyword',     value_en: '@sdcaparent',                         value_zh: '@sdcaparent' },
  { key: 'sms_number',      value_en: '81010',                               value_zh: '81010' },
  { key: 'website',         value_en: 'https://sandiegochineseschool.com',   value_zh: 'https://sandiegochineseschool.com' },

  // Registration
  { key: 'registration_portal',  value_en: 'https://register.sandiegochineseschool.com', value_zh: 'https://register.sandiegochineseschool.com' },
  { key: 'registration_new',     value_en: 'https://register.sandiegochineseschool.com/signin/register', value_zh: 'https://register.sandiegochineseschool.com/signin/register' },
  { key: 'registration_returning', value_en: 'https://register.sandiegochineseschool.com/signin', value_zh: 'https://register.sandiegochineseschool.com/signin' },
  { key: 'first_day_2026_27',    value_en: 'September 13, 2026',             value_zh: '2026年9月13日' },
  { key: 'mail_registration',    value_en: 'No longer accepted (2026-27)',   value_zh: '2026-27學年度不再接受郵寄註冊' },

  // Class info
  { key: 'class_days',        value_en: 'Sunday afternoons',                  value_zh: '週日下午' },
  { key: 'bell_times',        value_en: '1:30 PM & 4:30 PM',                 value_zh: '1:30 PM & 4:30 PM' },
  { key: 'class_span',        value_en: 'Pre-K through Grade 12 + Adult',    value_zh: '學前班至12年級 + 成人班' },
  { key: 'class_count_note',  value_en: 'About 30 classes (site states "about 30"; TCML page says 19)', value_zh: '約30個班級（主頁稱"約30個"；TCML頁面稱19個）' },

  // Financial
  { key: 'volunteer_fee',     value_en: '$100 per family (refundable as $100 gift-card value)', value_zh: '每家庭$100（可退還為$100禮卡）' },
  { key: 'scrip_deposit',     value_en: '$50 per enrolled student (refundable)', value_zh: '每位註冊學生$50（可退還）' },
  { key: 'scrip_refund_1',    value_en: '$700+ (1st child)',                 value_zh: '$700或以上（第1個孩子）' },
  { key: 'scrip_refund_2',    value_en: '$600+ (2nd child)',                 value_zh: '$600或以上（第2個孩子）' },
  { key: 'scrip_refund_3',    value_en: '$500+ (3rd+ child)',                value_zh: '$500或以上（第3個及以後孩子）' },
  { key: 'dance_fee_punch5',  value_en: '$40/5 classes ($8/class)',          value_zh: '5次卡 $40（每次$8）' },
  { key: 'dance_fee_punch10', value_en: '$70/10 classes ($7/class)',         value_zh: '10次卡 $70（每次$7）' },
  { key: 'dance_fee_dropin',  value_en: '$9',                                value_zh: '$9' },

  // Social / external
  { key: 'facebook',          value_en: 'https://www.facebook.com/SanDiegoChineseAcademy/', value_zh: 'https://www.facebook.com/SanDiegoChineseAcademy/' },
  { key: 'youtube_channel',   value_en: 'https://www.youtube.com/channel/UCbURJMa8pWixTD51QEnWMdA', value_zh: 'https://www.youtube.com/channel/UCbURJMa8pWixTD51QEnWMdA' },
  { key: 'youtube_playlist',  value_en: 'https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx', value_zh: 'https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx' },
  { key: 'yelp',              value_en: 'https://www.yelp.com/biz/san-diego-chinese-academy-san-diego', value_zh: 'https://www.yelp.com/biz/san-diego-chinese-academy-san-diego' },
  { key: 'pta_blog',          value_en: 'http://sdcapta.blogspot.com/',       value_zh: 'http://sdcapta.blogspot.com/' },
  { key: 'amazon_smile',      value_en: 'http://smile.amazon.com/ch/33-0290580', value_zh: 'http://smile.amazon.com/ch/33-0290580' },
  { key: 'drive_current',     value_en: 'https://drive.google.com/drive/folders/1DKK1JGqLH7gXjaOiE-Wz4FqwUWovYT3b', value_zh: 'https://drive.google.com/drive/folders/1DKK1JGqLH7gXjaOiE-Wz4FqwUWovYT3b' },
  { key: 'drive_past',        value_en: 'https://drive.google.com/drive/folders/0B_rx3YzKUte_enVmU2pPUGNRQkE', value_zh: 'https://drive.google.com/drive/folders/0B_rx3YzKUte_enVmU2pPUGNRQkE' },

  // Mission
  { key: 'mission_en',        value_en: 'To teach Chinese Language and the Culture through lectures and fun, interactive activities so that the students can apply what they learn at school into their daily lives. To preserve and promote Chinese tradition, culture and language.', value_zh: '' },
  { key: 'mission_zh',        value_en: '',                                  value_zh: '承載著弘揚中華文化的使命，教授中華語言與文化' },

  // TCML
  { key: 'tcml_established',  value_en: '2024',                              value_zh: '2024' },
  { key: 'tcml_age',          value_en: '18+',                               value_zh: '18歲以上' },
  { key: 'tcml_form',         value_en: 'https://forms.gle/qpiQZTGVN2zideHd7', value_zh: 'https://forms.gle/qpiQZTGVN2zideHd7' },

  // TA
  { key: 'ta_form',           value_en: 'https://forms.gle/HmuYPR5RXbAYGsHh9', value_zh: 'https://forms.gle/HmuYPR5RXbAYGsHh9' },
];

export function seedSettings(db, log, skipped) {
  let count = 0;
  for (const s of SETTINGS) {
    db.prepare(`
      INSERT INTO settings (key, value_en, value_zh)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_en=excluded.value_en, value_zh=excluded.value_zh,
        updated_at=datetime('now')
    `).run(s.key, s.value_en, s.value_zh);
    count++;
  }
  log.push(`settings: ${count} keys`);
  return count;
}
