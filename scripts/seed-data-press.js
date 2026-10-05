// Phase 3 — press / news announcements (kind='press')
// Source: research/wiki/pages/misc.md § 2 (News page) + § 3 (News Archive)
// These are press mentions with dates, bilingual titles, and source outlet.
// No PDF attachments — external_url is empty (article URLs not all captured).

const PRESS = [
  // ── /news/ page (2018–2023) ────────────────────────────────────────────────
  {
    slug: 'press-2023-10-08-flag-raising',
    title_en: 'Flag Raising Ceremony — Republic of China 112th Birthday',
    title_zh: '聖地亞哥臺僑升旗慶中華民國112年國慶',
    kind: 'press', published_at: '2023-10-08',
    body_en: 'Source: Epoch Times (大紀元)', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2023-05-26-graduation',
    title_en: 'SDCA Graduation 2023',
    title_zh: '堅持中文教育 聖地亞哥中華學苑歡送畢業生',
    kind: 'press', published_at: '2023-05-26',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2022-11-13-cultural-day',
    title_en: 'SDCA Cultural Day Festival 2022',
    title_zh: '湯圓文化節重回聖地牙哥中華學苑',
    kind: 'press', published_at: '2022-11-13',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2022-05-15-essay',
    title_en: 'SDCA Essay Contest 2022',
    title_zh: '聖地牙哥中華學苑作文比賽',
    kind: 'press', published_at: '2022-05-15',
    body_en: 'Source: We Chinese (華人)', body_zh: '來源：華人',
  },
  {
    slug: 'press-2022-03-20-poetry-wechinese',
    title_en: 'SDCA Online Poetry Recitation Contest 2022',
    title_zh: '中華學苑成功舉辦首次線上詩詞朗誦比賽',
    kind: 'press', published_at: '2022-03-20',
    body_en: 'Source: We Chinese', body_zh: '來源：華人',
  },
  {
    slug: 'press-2022-03-20-poetry-epoch',
    title_en: 'SDCA Online Poetry Recitation Contest 2022',
    title_zh: '聖地亞哥中華學苑首辦線上朗誦比賽',
    kind: 'press', published_at: '2022-03-20',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2021-01-01-solar-terms',
    title_en: '24 Solar Terms and Our Daily Life',
    title_zh: '二十四節氣與我們的生活',
    kind: 'press', published_at: '2021-01-01',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2020-12-23-rice-balls',
    title_en: 'SDCA Winter Solstice Handmade Rice Balls',
    title_zh: '聖地牙哥中華學苑 二十四節氣冬至搓湯圓',
    kind: 'press', published_at: '2020-12-23',
    body_en: 'Source: OCAC News', body_zh: '來源：OCAC News',
  },
  {
    slug: 'press-2020-01-28-cny',
    title_en: 'SDCA Lunar New Year Festival 2020',
    title_zh: '中華學苑園遊會',
    kind: 'press', published_at: '2020-01-28',
    body_en: '', body_zh: '',
  },
  {
    slug: 'press-2019-10-07-flag-raising',
    title_en: 'Flag Raising Ceremony — Republic of China 108 Celebration',
    title_zh: '聖地亞哥升旗典禮 慶中華民國108年',
    kind: 'press', published_at: '2019-10-07',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2019-10-07-double-10',
    title_en: 'Taiwan Double 10 Celebration',
    title_zh: '迎雙十 聖地牙哥升旗 僑民熱情揮國旗',
    kind: 'press', published_at: '2019-10-07',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-05-21-graduation',
    title_en: 'SDCA Graduation Ceremony 2019',
    title_zh: '中華學苑畢典 校長連任 理事會添新血',
    kind: 'press', published_at: '2019-05-21',
    body_en: '', body_zh: '',
  },
  {
    slug: 'press-2019-05-07-essay',
    title_en: 'SDCA Essay Contest — 11 Students Awarded',
    title_zh: '聖地牙哥中華學苑作文比賽 11學生獲獎',
    kind: 'press', published_at: '2019-05-07',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-04-02-karaoke-1',
    title_en: 'Karaoke Contest — Credit Class Division 2 Wins',
    title_zh: '唱歌學中文! 中華學苑卡拉ok大賽 學分班二甲奪冠',
    kind: 'press', published_at: '2019-04-02',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-04-02-karaoke-2',
    title_en: 'Karaoke Contest — Highlights',
    title_zh: '中華學苑卡拉ok賽 精采熱鬧',
    kind: 'press', published_at: '2019-04-02',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-03-22-typing',
    title_en: 'Chinese Typing Contest Award Ceremony',
    title_zh: '聖地牙哥中華學苑舉辦中文打字比賽頒獎典禮',
    kind: 'press', published_at: '2019-03-22',
    body_en: 'Source: WeChinese', body_zh: '來源：華人',
  },
  {
    slug: 'press-2019-03-19-typing',
    title_en: 'Chinese Typing Contest — Top Performers',
    title_zh: '中華學苑中文打字賽 高手出爐',
    kind: 'press', published_at: '2019-03-19',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-03-12-poetry-1',
    title_en: 'Poetry Recitation Contest — Judges Praise Students',
    title_zh: '中華學苑詩詞朗誦賽 評委讚學生挑戰自我',
    kind: 'press', published_at: '2019-03-12',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2019-03-15-poetry-2',
    title_en: 'Poetry Recitation Contest — 60+ Students Participate',
    title_zh: '聖地牙哥中華學苑詩詞朗誦比賽成功舉辦六十多學生參加',
    kind: 'press', published_at: '2019-03-15',
    body_en: 'Source: WeChinese', body_zh: '來源：華人',
  },
  {
    slug: 'press-2019-03-12-poetry-3',
    title_en: 'Poetry Recitation Contest — "Deng Yi Xia" Most Popular',
    title_zh: '中華學苑詩詞朗誦比賽 「等一下」最受歡迎',
    kind: 'press', published_at: '2019-03-12',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2019-03-08-teacher-conf',
    title_en: '"Let\'s Learn Chinese" Teacher Conference',
    title_zh: '中華學苑舉辦"學華語向前走研討會"邀三位任課老師分享',
    kind: 'press', published_at: '2019-03-08',
    body_en: 'Source: WeChinese', body_zh: '來源：華人',
  },
  {
    slug: 'press-2019-01-29-cny-31st',
    title_en: 'CNY Festival and 31st Anniversary',
    title_zh: '中華學苑31周年校慶 推廣中華文化',
    kind: 'press', published_at: '2019-01-29',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2018-12-14-cultural',
    title_en: 'Cultural Day 2018 — Winter Solstice',
    title_zh: '中華學苑2018文化節迎冬至熱鬧溫馨',
    kind: 'press', published_at: '2018-12-14',
    body_en: 'Source: WeChinese', body_zh: '來源：華人',
  },
  {
    slug: 'press-2018-12-11-rice-balls',
    title_en: 'Cultural Day and Credit Class Chinese Speech Contest',
    title_zh: '中華學苑搓湯圓 數百家長學生同樂',
    kind: 'press', published_at: '2018-12-11',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2018-10-30-speech',
    title_en: 'Chinese Speech Contest — Fundraising for Puyuma',
    title_zh: '中華學苑中文演講賽 為普悠瑪車禍募款',
    kind: 'press', published_at: '2018-10-30',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  // ── /news-archive/ (2015–2016) ─────────────────────────────────────────────
  {
    slug: 'press-2016-09-16-interview',
    title_en: 'SDCA Feature Interview — Sep 2016',
    title_zh: '聖地牙哥中華學苑專訪 (華人週末 9/16/16)',
    kind: 'press', published_at: '2016-09-16',
    body_en: 'Source: We Chinese Weekend', body_zh: '來源：華人週末',
  },
  {
    slug: 'press-2016-04-05-poetry',
    title_en: 'Poetry Recitation — Advanced Division Doubles',
    title_zh: '中華學苑舉辦詩詞朗誦-高級組選手增4倍',
    kind: 'press', published_at: '2016-04-05',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2016-tang-poem',
    title_en: 'Children Recite Tang Poems — Spring Dawn',
    title_zh: '中華學苑舉辦小朋友吟唐詩－春曉美景在眼前',
    kind: 'press', published_at: '2016',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2016-speech',
    title_en: 'Children\'s Speech Contest',
    title_zh: '中華學苑小朋友演講賽－台上台下皆緊張',
    kind: 'press', published_at: '2016',
    body_en: 'Source: World Journal', body_zh: '來源：世界日報',
  },
  {
    slug: 'press-2016-speech-epoch',
    title_en: 'SDCA Speech Contest — Everyone is a Winner',
    title_zh: '聖地牙哥中華學苑演講比賽 -人人都是第一',
    kind: 'press', published_at: '2016',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2016-cny',
    title_en: 'SDCA CNY Celebration — Rain or Shine',
    title_zh: '聖地牙哥中華學苑風雨無阻慶新年',
    kind: 'press', published_at: '2016',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2016-rice-balls',
    title_en: 'SDCA Rice Ball Festival',
    title_zh: '聖地牙哥中華學苑湯圓節熱鬧舉行',
    kind: 'press', published_at: '2016',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2015-flag-raising',
    title_en: 'San Diego Flag Raising — ROC 104 Celebration',
    title_zh: '聖地牙哥慶祝中華民國104年 – 升旗典禮假中華學苑舉行',
    kind: 'press', published_at: '2015',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
  {
    slug: 'press-2015-graduation',
    title_en: 'SDCA Graduation Ceremony',
    title_zh: '聖地牙哥中華學苑畢業典禮舉行',
    kind: 'press', published_at: '2015',
    body_en: 'Source: Epoch Times', body_zh: '來源：大紀元',
  },
];

export function seedPress(db, log, skipped) {
  let count = 0;
  for (const p of PRESS) {
    db.prepare(`
      INSERT INTO announcements (slug, title_en, title_zh, body_en, body_zh,
                                  kind, published_at, published)
      VALUES (?, ?, ?, ?, ?, 'press', ?, 1)
      ON CONFLICT(slug) DO UPDATE SET
        title_en=excluded.title_en, title_zh=excluded.title_zh,
        body_en=excluded.body_en, body_zh=excluded.body_zh,
        published_at=excluded.published_at, updated_at=datetime('now')
    `).run(p.slug, p.title_en, p.title_zh, p.body_en, p.body_zh, p.published_at);
    count++;
  }
  log.push(`press announcements: ${count} rows`);
  return count;
}
