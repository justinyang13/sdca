// Phase 3 — pages table (all main site pages)
// Text transcribed verbatim from research/wiki/pages/*.md

const PAGES = [
  // ── About ──────────────────────────────────────────────────────────────────
  {
    slug: 'about',
    title_en: 'About SDCA',
    title_zh: '關於聖地牙哥中華學苑',
    nav_section: 'About', nav_order: 1,
    body_en: [
      'San Diego Chinese Academy (SDCA) is a non-profit California organization that was founded in 1988. Our mission is to teach Chinese Language and the Culture through lectures and fun, interactive activities so that the students can apply what they learn at school into their daily lives. We also believe that bonding among students, teachers and parents plays a crucial role in children\'s learning. We find that children are more willing to make efforts to take up challenges in Chinese learning when their parents constantly give them encouragement and support. Each year we send our teachers to various trainings to make sure their knowledge and teaching techniques are up to date. Our teachers work closely with parents and pay attention to each learner\'s progress.',
      'SDCA initially held classes at UCSD from 1988 to 1990. Since the Fall of 1991, it has held classes at La Jolla Country Day School in La Jolla. The enrollment grew from 120 to 350 over this short period of time. First Credit class that met the foreign language credit requirements towards high school graduation was opened in 1996. Currently SDCA has about 30 classes including pre-K and K-12 plus adult classes.',
      'Over all these years, through the hard work and dedication from – both past and present – Principals, faculty/staff members, Board of Directors, PTA chairpersons, Community Service (CS) coordinators and parent volunteers, SDCA is standing strongly tall. By offering an excellent environment for learning Chinese to our students and the community, we look forward to continuing to serve everyone who is interested in Chinese culture as well as learning the language for many years to come.',
      '## What makes SDCA unique?\n\n- **Small class size** – student number for most of our classes is under 20. We provide TAs to some classes to make sure each student gets quality attention from the teacher.\n- **Bilingual system** – enabling students with no prior exposure to learn Chinese.\n- **Versatile teaching methods** – a variety of activities are used to stimulate learning and practical use of the Chinese language.\n- **Outstanding faculty** – experienced, well trained and dedicated teachers make all the differences.\n- **Parent volunteers** – helping hands from parent volunteers makes SDCA\'s pledge of keeping the tuition and fees from rising possible.\n- **Community service** – as an academic organization in San Diego, SDCA arranges seminars for its members and participates in various activities.',
    ].join('\n\n'),
    body_zh: [
      '聖地牙哥中華學苑是成立於1988年的加州非營利組織。我們的使命是透過授課及生動活潑的互動活動，教授中華語言與文化，讓學生能把在校學到的知識應用於日常生活中。我們相信學生、老師和家長之間的關係對孩子的學習至關重要。當家長持續給予鼓勵和支持時，孩子更願意努力應對中文學習的挑戰。每年我們都送老師參加各種培訓，確保他們的知識和教學技巧保持最新。我們的老師與家長密切合作，關注每位學習者的進度。',
      '中華學苑最初於1988至1990年在UCSD授課。1991年秋季起，在La Jolla的La Jolla Country Day School授課。在這段短暫時間內，學生人數從120人增至350人。1996年，學校開設了首個符合高中畢業語言學分要求的學分班。目前中華學苑約有30個班級，包括學前班、K-12班及成人班。',
      '多年來，憑藉歷任及現任校長、師資團隊、董事會、家長會會長、社區服務組長及家長義工的辛勤努力和付出，中華學苑穩健發展。我們為學生和社區提供優良的中文學習環境，期待繼續服務所有對中華文化和語言學習感興趣的人。',
      '## 中華學苑的獨特之處\n\n- **小班教學** – 大部分班級人數不到20人。部分班級配備教學助理，確保每位學生都能獲得老師的充分關注。\n- **雙語系統** – 讓沒有中文基礎的學生也能學習中文。\n- **多元教學方法** – 運用各種活動激發學習興趣，促進中文的實際運用。\n- **優秀師資** – 經驗豐富、訓練有素、充滿熱忱的老師是最大差異。\n- **家長義工** – 家長義工的協助使學費保持穩定成為可能。\n- **社區服務** – 作為聖地牙哥的學術機構，中華學苑為成員安排研討會並參與各種社區活動。',
    ].join('\n\n'),
    hero_image: 'img/classroom-bilingual-1600.jpg',
  },
  {
    slug: 'about-board',
    title_en: 'Board of Directors',
    title_zh: '董事會',
    nav_section: 'About', nav_order: 2,
    body_en: [
      'The Board of Directors is SDCA\'s highest governing body. The Board currently consists of nine members. All Board Members are elected at The Annual Meeting to serve a two-year term. Re-election is limited to one additional term. The Board is ultimately responsible for all SDCA affairs.',
      'Over all these years, through the hard work and dedication from – both past and present – Principals, faculty/staff members, Board of Directors, PTA chairpersons, Community Service (CS) coordinators and parent volunteers, SDCA is standing strongly tall.',
    ].join('\n\n'),
    body_zh: [
      '董事會是中華學苑最高決策機構。目前董事會共有九名成員。所有董事均於年度會員大會選舉產生，任期兩年，可連任一屆。董事會對中華學苑所有事務負最終責任。',
      '多年來，憑藉歷任及現任校長、師資團隊、董事會、家長會會長、社區服務組長及家長義工的辛勤努力和付出，中華學苑穩健發展。',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'about-staff',
    title_en: 'Staff',
    title_zh: '師資團隊',
    nav_section: 'About', nav_order: 3,
    body_en: [
      'Each year we send our teachers to various trainings to make sure their knowledge and teaching techniques are up to date. Our teachers work closely with parents and pay attention to each learner\'s progress.',
      '## What makes SDCA unique?\n\n- **Versatile teaching methods** – a variety of activities are used to stimulate learning and practical use of the Chinese language.\n- **Outstanding faculty** – experienced, well trained and dedicated teachers make all the differences.\n- **Small class size** – student number for most of our classes is under 20. We provide TAs to some classes to make sure each student gets quality attention from the teacher.\n- **Bilingual system** – enabling students with no prior exposure to learn Chinese.',
    ].join('\n\n'),
    body_zh: [
      '每年我們都送老師參加各種培訓，確保他們的知識和教學技巧保持最新。我們的老師與家長密切合作，關注每位學習者的進度。',
      '## 中華學苑的獨特之處\n\n- **多元教學方法** – 運用各種活動激發學習興趣，促進中文的實際運用。\n- **優秀師資** – 經驗豐富、訓練有素、充滿熱忱的老師是最大差異。\n- **小班教學** – 大部分班級人數不到20人。部分班級配備教學助理，確保每位學生都能獲得老師的充分關注。\n- **雙語系統** – 讓沒有中文基礎的學生也能學習中文。',
    ].join('\n\n'),
    hero_image: 'img/teachers-2018-1600.jpg',
  },
  {
    slug: 'about-principal',
    title_en: "Principal's Message",
    title_zh: '校長的話',
    nav_section: 'About', nav_order: 4,
    body_en: [
      '2018 is a very important year for San Diego Chinese Academy because the Academy has turned 30 years old. On February 11, 2018, we immensely celebrated the 30th anniversary of the Chinese Academy. There were wonderful performances on that day. The scale of the school fair was lively and impressive. There were lots of guests, food stalls, and game booths at the event. The food was delicious and everyone had a great time. We also edited and published a special edition yearbook for the 30th anniversary. It contains the major historical events of the school, the words from previous principals, precious historical photographs, and the wishful messages of friends from the local overseas communities.',
      'On the day of the event, Director-General Hsia from Taipei Economic and Cultural Office in Los Angeles, Director Yang from Culture Center of T.E.C.O. in Orange County (Santa Ana), and San Diego overseas community leaders all celebrated SDCA\'s birthday with us. It is worth mentioning that ALL previous principals were gathered and many former chairmen of the board also joined us to celebrate on this remarkable day.',
      'I have always been proud of San Diego Chinese Academy. Apart from our school activities, we also support other events within the community. In October, our school had a total of more than 130 teachers, students and parents attended the performance presented by Taiwan Chiu-Tian folk drum and art tour delegation. On April 29, 2018, our school co-organized the International Tour of Taiwan Cuisine. We were able to mobilize more than 20 volunteers for this event. Our school was also enthusiastically involved in groups such as San Diego Chinese American Science and Engineering Association and many other cultural associations.',
      'In addition to the grand celebrations, we continue to celebrate annual traditional activities. In November and December 2017, we had our school\'s traditional culture festival, where parents of the students got together and made rice balls. The children attended classes and enjoyed rice balls in groups during class hours. Through this activity, our children also learned about traditional Chinese festivals and that rice balls are traditional food for the winter solstice. Since November was the Thanksgiving holidays, our school combined the two major Chinese and American festivals at the same time.',
      'Furthermore, we also had the school speech contest in December, the poetry recitation contest in March, and the karaoke singing contest and writing competition in April. In each class, there were storytelling competitions, typing competitions, and character recognition competitions. In May, there will be the graduation ceremony and the teacher\'s banquet. Every graduate who has studied at our school for many years will use their fluent Chinese for their graduation speech.',
      'In addition to the school-run activities mentioned above, the intense learning in the classrooms every Sunday afternoon is the real focus. Every teacher, for thirty weeks, has been vigorously preparing lessons, teaching, grading homework, and revising exam papers. The students also study very hard. Each of our students has progressed and grown exponentially in the past year. I believe that every parent is as proud of our children as I am. I want to use the words "thank you" to express the emotions within my heart. I am very grateful to the excellent team led by the board of directors. Each member of the board of directors is doing his/her duties with due diligence while supporting school affairs. I also sincerely thank all the previous principals, vice principals, and board members for their hard work over the years, and for tirelessly mentoring and assisting me. In addition, to every teacher who has contributed their time, I would like to thank you all for your hard work and dedication towards the education of our children.',
    ].join('\n\n'),
    body_zh: [
      '2018年是中華學苑建校史上至關重要的一年，這一年中華學苑年滿三十歲了。2月11日，為慶祝建校三十週年，我們舉行了隆重的慶典活動。活動當天天氣晴朗，豔陽高照，精彩纷呈的節目表演，以及規模盛大的園遊會吸引了人山人海。園遊會設有令人垂涎欲滴的風味美食攤位，以及趣味十足的遊戲攤位，現場人頭攢動，熱鬧非凡。到場的來賓以及學生家長無不誇讚，真是好吃又好玩。為本次活動學校還精心編輯、出版了中華學苑三十週年校慶特刊。特刊內容包括學校重大歷史事件、歷任校長的話、珍貴的歷史照片，以及當地僑社朋友們的祝賀詞。',
      '活動當天，洛杉磯台北經濟文化辦事處蕭主任、橙縣（聖地牙哥）台北經濟文化辦事處文化中心楊主任，以及聖地牙哥僑社領袖都來臨共慶中華學苑的生日。值得一提的是，所有歷任校長以及多前任理事長都蒞臨參加，共同慶祝這個難忘的日子。',
      '我一直為聖地牙哥中華學苑感到自豪。除了學校自己的活動外，我們也支持社區的其他活動。今年十月，本校共有超過130位老師、學生和家長參加了由台灣九天民間鼓樂藝術團巡迴演出的表演。4月29日，本校協辦了「台灣美食國際巡迴展」。我們動員了超過20位義工協助該活動。本校也熱衷參與聖地牙哥中美科技工程師協會等多個文化團體的活動。',
      '除了上述大型慶祝活動外，我們每年也會舉辦傳統活動。2017年11月和12月，我們舉辦了學校傳統文化節，家長們聚在一起搓湯圓。孩子們在課堂上享用湯圓。透過這個活動，孩子們也了解了中國傳統節日和冬至吃湯圓的習俗。由於十一月正值美國感恩節，學校將這兩個中西方重要節日結合在一起慶祝。',
      '此外，我們還在十二月舉辦演講比賽、三月詩詞朗誦比賽、四月卡拉OK歌唱比賽和作文比賽。各班級還舉辦了故事比賽、打字比賽和認字比賽。五月將舉行畢業典禮和謝師宴。每位在學校學習多年的畢業生都將用流利的中文發表畢業感言。',
      '除了上述學校活動外，每個週日下午課堂上的刻苦學習才是重點。每位老師在三十個週裡認真備課、授課、批改作業和試卷。學生們也非常努力。每位學生過去一年都有長足的進步和成長。我相信每位家長都和我一樣為孩子們感到驕傲。我想用「謝謝」二字表達我心裡的感激。我由衷感謝以理事長為首的優秀團隊，每位理事都認真盡責、支持校務工作。我還要感謝所有歷任校長、副校長和董事多年來的不辭辛勞，以及對我的指導和協助。另外，向每一位投入時間的老師，感謝你們對孩子教育的辛勤付出和奉獻。',
    ].join('\n\n'),
    hero_image: '',
  },
  // ── Programs ───────────────────────────────────────────────────────────────
  {
    slug: 'programs',
    title_en: 'Programs',
    title_zh: '課程',
    nav_section: 'Programs', nav_order: 1,
    body_en: 'SDCA offers a full range of Chinese language programs from Pre-K through Grade 12, plus adult programs (TCML) and recreational/cultural activities. See the individual program pages for details.',
    body_zh: '聖地牙哥中華學苑提供從學前班到12年級的完整中文課程，以及成人班（TCML）和休閒文化活動。請查看各課程頁面了解詳情。',
    hero_image: 'img/classroom-bilingual-1600.jpg',
  },
  {
    slug: 'programs-classes',
    title_en: 'Class Descriptions & Placement',
    title_zh: '課程安排與分班',
    nav_section: 'Programs', nav_order: 2,
    body_en: [
      'We are proud of our class-placement structure at SDCA because it is designed to accommodate various needs for both children and adults who are interested in learning Chinese.',
      '## Pre-K / Preschool Program（學前班）\n\nYour preschoolers don\'t necessarily need to have any Chinese background before participating in this program. By using *My First Chinese Words*, the young learners will be exposed to the sounds, the characters, and some basic conversations that occur in our daily lives. Interactive teaching aids such as flash cards, CDs of Chinese songs and videos will also be frequently used in class.',
      '## Beginner Class（入門班，5+）\n\nWhen your children are ready to learn Chinese formally and are over 5 years old, you can have them start with the Beginner Class, either New-Phonetic (ZhuYin) Beginner class or Pin-Yin Beginner class. It\'s not uncommon to see older kids in our Beginner classes. It\'s never too late to learn a language, and we welcome everyone who is interested with open arms!',
      '## Level K — ZhuYin（注音符號班）\n\nAt Level K, the students will learn The New-Phonetic (or Mandarin Phonetic Symbols 注音符號, or Zhu-Yin) and how these symbols work in sounding out Chinese characters. Many Mandarin-speaking families find Zhu-Yin useful for their young learners who sometimes get confused with Pin-Yin by its own English letter sounds. The sounds of Zhu-Yin perfectly match Mandarin pronunciation so these young students can learn to pronounce Chinese words accurately by sounding out the symbols without trace of English sounds.',
      '## Regular / Bilingual Class（普通班 / 雙語班）\n\nBoth English and Mandarin are used in lecturing that covers speaking, listening, reading, and writing. For lower levels, speaking and listening are emphasized for the students to get familiar with the language – its grammar and various phrase applications. For higher levels, the students will be given more writing practices for them to become ready for advanced learning should they decide to continue with High School Credit Class studies. Pin-Yin Fundamentals are taught at Level K.',
      '## Credit Class（學分班）\n\nForeign Language Credits earned at SDCA are recognized by San Diequito Union School District, San Diego Unified School District, Carlsbad Unified School District and Poway Unified School District. Our credit-class teachers are very experienced. All the lessons are planned to meet the most updated 5C standards (National Standards for Foreign Language Education).',
    ].join('\n\n'),
    body_zh: [
      '中華學苑的分班制度是我們的驕傲，它為對中文學習有興趣的孩子和成年人提供了多元化的選擇。',
      '## 學前班\n\n您的孩子不需要有中文基礎即可參加學前班課程。透過《我的第一本中文詞彙》等教材，小朋友將接觸到聲音、漢字和日常生活中的基本對話。課堂上也會頻繁使用卡片、中文歌曲CD和影片等互動教學工具。',
      '## 入門班（5歲以上）\n\n當您的孩子準備好正式學習中文且年齡超過5歲時，可以從入門班開始學習，可選擇注音符號入門班或拼音入門班。我們的入門班常見年紀稍大的孩子，學語言永遠不嫌晚，我們歡迎所有有興趣的人！',
      '## 注音班（Level K）\n\n在注音班，學生將學習注音符號（New-Phonetic / Mandarin Phonetic Symbols）以及這些符號如何用於拼讀漢字。許多使用普通話的家庭認為注音符號對年幼學習者很有幫助，因為拼音的英文字母發音有時會讓孩子混淆。注音符號的發音與普通話完全吻合，讓年輕學生能準確拼讀中文，不受英文發音影響。',
      '## 普通班 / 雙語班\n\n普通班和雙語班使用英文和中文授課，涵蓋聽、說、讀、寫。低年級以聽力和口語為重，讓學生熟悉語言的語法和詞組應用。高年級增加書寫練習，為後續的學分班學習做好準備。拼音基礎在注音班（Level K）教授。',
      '## 學分班\n\n在中華學苑取得的語言學分獲San Diequito聯合學區、San Diego統一學區、Carlsbad聯合學區和Poway統一學區認可。我們的學分班老師經驗豐富，所有課程都符合最新的5C標準（外國語言教育國家標準）。',
    ].join('\n\n'),
    hero_image: 'img/regular-class-1600.jpg',
  },
  {
    slug: 'programs-tcml',
    title_en: 'Adult Chinese — TCML',
    title_zh: '成人華語文班（TCML）',
    nav_section: 'Programs', nav_order: 3,
    body_en: [
      'San Diego Chinese Academy was established in 1988. It has been promoting Mandarin teaching and culture for both heritage and non-heritage children in the community for 38 years. The school has 19 classes, mainly enrolling students aged 4 to 18, with classes held on Sunday afternoons. In order to meet the growing demand for Mandarin learning in recent years, San Diego Chinese Academy established the Taiwan Center for Mandarin Learning (TCML) in 2024. The center provides practical and systematic Mandarin learning and Taiwanese cultural learning experiences for adults aged 18 or older.',
      '## Course Features\n\nEmbark on your Mandarin adventure with the Taiwan Center for Mandarin Learning at San Diego Chinese Academy\'s flexible hybrid courses! Learn essential Mandarin skills from experienced SDCA teachers, delve into fascinating culture, and gain valuable language skills that can enhance your career prospects. Make new friends, expand your horizons, and experience the warmth of Mandarin culture.',
      '**[Application Form](https://forms.gle/qpiQZTGVN2zideHd7)**',
    ].join('\n\n'),
    body_zh: [
      '聖地牙哥中華學苑成立於1988年，38年來一直致力於為社區內具有華裔及非華裔背景的孩子們推廣中文教學和文化。學校設有19個班級，主要招收4至18歲的學生，課程於星期日下午舉行。為了應對近年來對中文學習需求的增長，聖地牙哥中華學苑於2024年設立了台灣華語文學習中心（TCML），為18歲以上的成年人提供實用且系統的華語學習和台灣文化體驗。',
      '## 課程特色\n\n開始您在聖地牙哥中華學苑台灣華語文學習中心的靈活混合課程，展開您的華語學習之旅！向經驗豐富的教師學習基本的華語技能，深入了解迷人的文化，並獲得有助於職業發展的寶貴語言技能。結識新朋友、拓展視野，體驗溫暖的華語文化。',
      '**[申請表格](https://forms.gle/qpiQZTGVN2zideHd7)**',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'programs-recreational',
    title_en: 'Recreational & Culture Programs',
    title_zh: '休閒文化課程',
    nav_section: 'Programs', nav_order: 4,
    body_en: [
      '## Dance with U-Jam\n\nCome dance with us! World of Dance U-Jam is here! Come to this addictive dance cardio fitness workout that fuses the hottest world beats with fun choreography that will make you move, sweat, and smile! Remember to bring a water bottle, towel, comfortable outfit, exercise shoes, bandanna (optional) and get ready to sweat! Class time: Sunday 3:00–4:00 PM, Room MS112.',
      '**Class fees:** Punch Card $40/5 classes ($8/class) · Punch Card $70/10 classes ($7/class; free bandanna while supplies last) · Drop-in: $9',
      '## Yoga Class\n\nYoga class is taught by Celine Chen. To learn more about Celine and the class, please email Yoga By Celine.',
      '## SDCA Baseball Team\n\nEstablished in 2013, our baseball team has been organized by SDCA parents. We practice on Sunday afternoons while our children are in Chinese school. Please contact Jerry Han if you are interested.',
    ].join('\n\n'),
    body_zh: [
      '## 舞蹈課（U-Jam）\n\n大家一起來跳舞！World of Dance U-Jam舞蹈有氧健身課程，融合全球最新舞曲和有趣的編舞，讓你動起來、流汗、微笑！請記得帶水瓶、毛巾、舒適的服裝和運動鞋，準備好流汗吧！上課時間：週三下午三點到四點，MS112教室。',
      '**課程費用：** 5次卡 $40（每次$8）· 10次卡 $70（每次$7；送頭巾，數量有限）· 单次 $9',
      '## 瑜伽課\n\n瑜伽課由Celine Chen授課。想了解更多請電郵Yoga By Celine。',
      '## 中華學苑棒球隊\n\n棒球隊成立於2013年，由SDCA家長組織。我們週三下午在孩子在中華學苑上課期間練習。有興趣請聯繫Jerry Han。',
    ].join('\n\n'),
    hero_image: 'img/yoga-class-960.jpg',
  },
  {
    slug: 'programs-ta',
    title_en: 'TA Program',
    title_zh: '教學助理計畫',
    nav_section: 'Programs', nav_order: 5,
    body_en: [
      'San Diego Chinese Academy welcomes local high school students with interest and dedication to assisting our teachers with both clerical and instructional work during school hours. Each teaching assistant can be tasked with various responsibilities which include, but are not limited to, classroom activities, school events assistants, equipment set up and/or preparation of materials, and lead students as needed by the assigned teachers. Bilingual in Chinese is preferred and you will also improve your Chinese along the way.',
      'The school tracks their volunteer hours and each TA will receive a certificate at the end of the school year. This TA program has long been successfully providing support to our teachers while our teaching assistants gain leadership opportunities and earn their community volunteer hours which work toward their college applications.',
      '**[SDCA TA Application](https://forms.gle/HmuYPR5RXbAYGsHh9)**',
    ].join('\n\n'),
    body_zh: [
      '聖地牙哥中華學苑歡迎本地高中學生加入教學助理團隊，協助老師處理行政和教學事務。教學助理可擔任課堂協助、活動協助、設備準備及材料準備等工作，並按老師指派帶領學生。具備中文雙語能力者優先，您也可以在服務中提升中文。',
      '學校會記錄義工時數，每位教學助理在學年結束時將獲得證明書。此計畫長期為老師提供支援，同時讓教學助理獲得領導機會和社區義工時數，有助於大學申請。',
      '**[SDCA TA 申請表](https://forms.gle/HmuYPR5RXbAYGsHh9)**',
    ].join('\n\n'),
    hero_image: '',
  },
  // ── Enrollment ─────────────────────────────────────────────────────────────
  {
    slug: 'enroll',
    title_en: 'Enrollment',
    title_zh: '報名註冊',
    nav_section: 'Enroll', nav_order: 1,
    body_en: [
      '## 2026-2027 Online Registration\n\nWe are no longer accepting registration by mail. Please submit the Registration Form and your payment to the office on the first day of school, **September 13**.',
      '- **[Registration Notice and Online Registration Instructions (EN)](https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20English.pdf)**\n- **[註冊須知與網路註冊說明 (ZH)](https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20Chinese.pdf)**\n- **[New Family Sign Up](https://register.sandiegochineseschool.com/signin/register)**\n- **[Returning Student Sign In](https://register.sandiegochineseschool.com/signin)**\n\nIf you have any questions, please email Office.SDCA@gmail.com or call (858) 205-7322.',
    ].join('\n\n'),
    body_zh: [
      '## 2026-2027 學年度網上註冊\n\n我們不再接受郵寄註冊。請在九月十三日開學日帶報名表和付款方式到辦公室辦理註冊。',
      '- **[Registration Notice and Online Registration Instructions (EN)](https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20English.pdf)**\n- **[註冊須知與網路註冊說明 (ZH)](https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20Chinese.pdf)**\n- **[新家庭註冊](https://register.sandiegochineseschool.com/signin/register)**\n- **[舊生註冊](https://register.sandiegochineseschool.com/signin)**\n\n如有任何問題，請 email Office.SDCA@gmail.com 或洽電 (858) 205-7322。',
    ].join('\n\n'),
    hero_image: '',
  },
  // ── News / Media ───────────────────────────────────────────────────────────
  {
    slug: 'news',
    title_en: 'News & Events',
    title_zh: '新聞與活動',
    nav_section: 'News', nav_order: 1,
    body_en: 'Browse weekly parent announcements, press coverage, and event photos.',
    body_zh: '瀏覽每周家長聯絡事項、媒體報導及活動照片。',
    hero_image: '',
  },
  {
    slug: 'media',
    title_en: 'Photos & Videos',
    title_zh: '活動攝影',
    nav_section: 'News', nav_order: 4,
    body_en: [
      '## Video\n\n**[SDCA Cultural Activity Playlist](https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx)**',
      '## Photo Albums\n\n- **[Current School Year Photos](https://drive.google.com/drive/folders/1DKK1JGqLH7gXjaOiE-Wz4FqwUWovYT3b?usp=sharing)**\n- **[Past Photos](https://drive.google.com/drive/folders/0B_rx3YzKUte_enVmU2pPUGNRQkE?usp=sharing)**',
      '## Event Captions\n\nGraduation · Student Store · Poetry Recitation Contest · Cultural Day Festival · Halloween Costume Contest · Flag Raising Ceremony · Graduation/Closing Ceremony · Volunteer Appreciation Party · Fundraising Sales · Chinese New Year Festivals · Credit Class Culture Lessons · Trick-Or-Treat · Multimedia Presentation Competition · Teachers Meeting · SDCA Award Ceremony and Teacher Appreciation Dinner · Drive Through Awards Ceremony · and more…',
    ].join('\n\n'),
    body_zh: [
      '## 影片\n\n**[SDCA 文化活動影片播放清單](https://www.youtube.com/playlist?list=PL-etO5dM7pdvvPot-VAjFbX9Memc-K4fx)**',
      '## 相簿\n\n- **[本學年照片](https://drive.google.com/drive/folders/1DKK1JGqLH7gXjaOiE-Wz4FqwUWovYT3b?usp=sharing)**\n- **[往年照片](https://drive.google.com/drive/folders/0B_rx3YzKUte_enVmU2pPUGNRQkE?usp=sharing)**',
      '## 活動項目\n\n畢業典禮 · 學生商店 · 詩詞朗誦比賽 · 文化節 · 萬聖節服裝比賽 · 升旗典禮 · 結業典禮 · 義工表揚同樂會 · 募款義賣活動 · 春節慶祝 · 學分班文化課 · 萬聖節發糖活動 · 多媒體簡報比賽 · 教務研討會 · 結業典禮與謝師宴 · 開車結業與頒獎 · 更多…',
    ].join('\n\n'),
    hero_image: 'img/cultural-day-1600.jpg',
  },
  // ── Parents ────────────────────────────────────────────────────────────────
  {
    slug: 'parents-handbook',
    title_en: 'Handbook & Policy',
    title_zh: '手冊與政策',
    nav_section: 'Parents', nav_order: 1,
    body_en: [
      'Download the handbooks, policies, and forms below.',
      '### Available Documents\n\n- **Parent Handbook 家長須知**\n- **Student Handbook 學生守則**\n- **Credit Class Rules 學分班規則**\n- **Policy for Guest Students 旁聽生收費及管理辦法**\n- **Policy for Second Semester Late Registration 特殊註冊收費辦法**\n- **Expense Reimbursement Form 費用支出申報表**\n- **TA Application** — [Google Form](https://forms.gle/HmuYPR5RXbAYGsHh9)',
    ].join('\n\n'),
    body_zh: [
      '下載以下手冊、政策和表格。',
      '### 可用文件\n\n- **家長須知**\n- **學生守則**\n- **學分班規則**\n- **旁聽生收費及管理辦法**\n- **特殊註冊收費辦法**\n- **費用支出申報表**\n- **TA 申請表** — [Google 表格](https://forms.gle/HmuYPR5RXbAYGsHh9)',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'parents-volunteer',
    title_en: 'Volunteer',
    title_zh: '義工服務',
    nav_section: 'Parents', nav_order: 2,
    body_en: [
      'SDCA needs you to sign up for volunteers. We rely heavily on parent volunteers to assist with academic and maintain all non-academic functions of the school. We charge a service fee of **$100 per family**, which is refundable when a parent participates as a volunteer and completes the service. The refund will be given in the form of $100 value of gift cards at scrip sales at the office. The more parents we have to volunteer, the less duty each parent will have to do. Your involvement will always be highly appreciated! Please review the Volunteer Job Descriptions or contact the PTA Director at sdcapta@gmail.com.',
      '## Volunteer Roles\n\n| Role | Duty |\n|------|------|\n| **Room Parent 班媽/班爸** | Assist school, classroom teacher & PTA in communicating with parents; help with class/school activities; help host Cultural Day and CNY Carnival. **Need 1 room parent per class, 2 for classes with 15+ students.** Entire school year. |\n| **Ground Supervision 校園巡邏組** | Patrol campus and ring bell during school recesses; during CNY Festival help directing traffic and parking. 5 weeks. |\n| **Office Duty 辦公室職勤** | Ring bell at 1:30pm and 4:30pm; prepare coffee/tea for staff; assist with clerical work. 6 volunteers needed. 5 weeks. |\n| **Student Store Assistance 學生商店組** | Help with Coupon Day Distribution by coordinating with the Board Director. Entire school year. |\n| **School Contest Assistance 校內比賽服務組** | Setup; contestants checking-in; score keeping at Speech Contest and Poetry Recitation Contest. Both contests. |',
    ].join('\n\n'),
    body_zh: [
      '聖地牙哥中華學苑需要您報名義工。校內所有文化活動與部分輔助教學活動大多仰賴家長服務才得以舉辦。本校酌收每個家庭代勞費一百元，但只要家長參與校內服務達一定時數，此項訂金即可退還。在每個月的禮券日到辦公室領取等值一百元的禮卡。參與的家長人數越多，每人分擔的工作就越少。請熱心參與您孩子的教育，感謝您！請參考義工工作說明，或是與家長會長聯絡 sdcapta@gmail.com。',
      '## 義工職責\n\n| 職務 | 說明 |\n|------|------|\n| **班媽/班爸** | 協助學校、班級老師及PTA與家長溝通；協助班級和學校活動；協助舉辦文化節和春節園遊會。每班需1位班家長，15人以上班級需2位。整學年。 |\n| **校園巡邏組** | 上課休息時巡邏校園及打鐘；春節園遊會時協助交通和停車。5週。 |\n| **辦公室職勤** | 1:30pm和4:30pm打鐘；為員工準備咖啡/茶；協助辦公室行政工作。需6位。5週。 |\n| **學生商店組** | 協助禮券日分發，與董事會理事協調。整學年。 |\n| **校內比賽服務組** | 場地設置；參賽者登記；演講比賽和詩詞朗誦比賽計分。兩項比賽。 |',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'parents-scrip',
    title_en: 'Scrip',
    title_zh: '禮券',
    nav_section: 'Parents', nav_order: 3,
    body_en: [
      'SDCA is a non-profit educational organization. Scrip sale profits are used to fund school activities. Every student is charged a refundable **Scrip Deposit of $50** when enrolled. Scrips are gift cards from grocery stores, department stores, retail stores, or restaurants. You can use these gift cards at stores, and our school gets a certain percentage back as rebate from the retailers. Enrolled families are encouraged to purchase scrip, and when the accumulated amount reaches a set level for the school year — **$700 or more** for the first enrolled child, **$600 or more** for the second child, and **$500 or more** for the third and each additional child — a refund in scrip of your choice may be picked up on any Scrip Day upon fulfillment. You have the entire school year to fulfill and exceed the refund requirement while helping to raise funds for the school at the same time.',
      'Scrip sale, scrip deposit refund, and service fee refund are available at the office on any **Scrip Day** (first available Sunday of each month and pre-registration days).',
      'Please contact **sdca.board.scrip.director@gmail.com** should you have any questions.',
      '### Available Documents\n\n- Scrip Program\n- Scrip Schedule\n- Scrip Sponsors (Logos)\n- Scrip Transaction History',
    ].join('\n\n'),
    body_zh: [
      '聖地牙哥中華學苑是無營利教育機構，禮券銷售利潤用於支持學校活動。每位註冊學生需預繳可退還的**禮券訂金 $50**。禮券是超市、百貨公司、零售店或餐廳的禮品卡。您可以在這些商店使用禮品卡，學校則從零售商獲得一定比例的返還。鼓勵註冊家庭購買禮券，當累計金額達到學年設定標準——**第一 child $700或以上**、**第二 child $600或以上**、**第三及以後每位 child $500或以上**——即可在禮券日領取等額禮券退款。您有整個學年的時間完成和超過退款要求，同時為學校募款。',
      '禮券銷售、禮券訂金退款和代勞費退款可在任何**禮券日**（每月首個上課的星期天及預註冊日）到辦公室辦理。',
      '如有任何問題，請聯繫 **sdca.board.scrip.director@gmail.com**。',
      '### 可用文件\n\n- 禮券計畫說明\n- 禮券日時間表\n- 禮券贊助商家（Logo）\n- 禮券交易紀錄',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'documents',
    title_en: 'Forms & Downloads',
    title_zh: '表格與下載',
    nav_section: 'Parents', nav_order: 4,
    body_en: 'Browse and download all school documents, forms, and policies.',
    body_zh: '瀏覽和下載所有學校文件、表格和政策。',
    hero_image: '',
  },
  // ── Support ────────────────────────────────────────────────────────────────
  {
    slug: 'support',
    title_en: 'Support SDCA',
    title_zh: '支持中華學苑',
    nav_section: 'Support', nav_order: 1,
    body_en: [
      '## Making a Tax Deductible Donation\n\nIt is easy to help our school. You can make a tax deductible donation by sending a check to our school or make your donation via PayPal.',
      '**Donation by check:** Please mail your check to **San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093**. We will send you a receipt when we receive your check.',
      '**Donation through PayPal:** To donate through PayPal, simply follow the link and provide your name, phone number, and mailing address so we can send your tax deductible receipt to you in the mail.',
      '## Purchase Scrip\n\nWe sell scrips/certificates from various vendors and stores such as grocery stores, restaurants, retail, and others. If you are already doing business with these stores, why not purchase the scrips from our school which will help our school raise a little funds. Restaurant scrips also make wonderful gifts — a win-win situation!',
      '## Shop AmazonSmile and Earn Money for SDCA\n\nAmazonSmile donates **0.5%** of your eligible purchases automatically to SDCA. Visit [smile.amazon.com/ch/33-0290580](http://smile.amazon.com/ch/33-0290580) and log in with your existing Amazon account. Choose San Diego Chinese Academy as your charity when prompted.',
      '## Sign up with eScrip\n\nSigning up with eScrip is a great way to support our school. Our school earns contribution from participating merchants when you shop.',
      '## Help our school by Shopping through iGive\n\nShop over 700 stores including name brands such as Macy\'s, Borders, PetsMart, Pottery Barn, Amazon, and many more.',
      '## Advertise in Our School Publications\n\nHave a business? Why not advertise in our school publication? To find out about the opportunity to advertise your business, please contact **sdca.board.vice.president@gmail.com**.',
    ].join('\n\n'),
    body_zh: [
      '## 稅前捐款\n\n支持我校很容易。您可以寄支票給學校或透過PayPal捐款，捐款均可用於稅前扣除。',
      '**支票捐款：** 請將支票寄至 **San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093**。收到支票後我們會寄出收據。',
      '**PayPal捐款：** 請透過PayPal連結捐款，並提供姓名、電話和通訊地址，以便我們郵寄稅前扣除收據。',
      '## 購買禮券\n\n我們銷售來自各類商家和商店的禮券，如超市、餐廳、零售店等。如果您已經在使用這些商店，何不從我們學校購買禮券，為學校募集資金。餐廳禮券也是很好的禮物——一舉兩得，雙贏！',
      '## AmazonSmile\n\nAmazonSmile自動將您合格購買金額的**0.5%**捐贈給SDCA。請訪問 [smile.amazon.com/ch/33-0290580](http://smile.amazon.com/ch/33-0290580)，使用現有Amazon帳戶登入，選擇聖地牙哥中華學苑為您的慈善機構。',
      '## eScrip\n\n註冊eScrip是支持學校的好方法。當您購物時，學校會從參與商家獲得回扣。',
      '## iGive\n\n透過iGive在700多家商店購物，包括Macy\'s、Borders、PetsMart、Pottery Barn、Amazon等知名品牌。',
      '## 學校刊物廣告\n\n有商業？何不刊登廣告於我們的學校刊物？如有意廣告，請聯繫 **sdca.board.vice.president@gmail.com**。',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'support-sponsors',
    title_en: 'Our Sponsors',
    title_zh: '贊助商',
    nav_section: 'Support', nav_order: 2,
    body_en: 'SDCA is grateful to our sponsors for their generous support.',
    body_zh: '感謝贊助商對中華學苑的慷慨支持。',
    hero_image: '',
  },
  // ── Contact ────────────────────────────────────────────────────────────────
  {
    slug: 'contact',
    title_en: 'Contact Us',
    title_zh: '聯絡我們',
    nav_section: 'Contact', nav_order: 1,
    body_en: [
      '| | |\n|---|---|\n| **School Phone** | (858) 205-SDCA (7322) — Please DO NOT contact La Jolla Country Day School. |\n| **Mailing Address** | San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093 |\n| **Website** | https://sandiegochineseschool.com |\n| **Email** | Office.SDCA@gmail.com |\n| **Text Message** | Text **@sdcaparent** to **81010** |',
    ].join('\n'),
    body_zh: [
      '| | |\n|---|---|\n| **學校電話** | (858) 205-SDCA (7322) — 請不要聯繫 La Jolla Country Day School。 |\n| **通訊地址** | San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093 |\n| **網址** | https://sandiegochineseschool.com |\n| **電子信箱** | Office.SDCA@gmail.com |\n| **簡訊** | 發送 **@sdcaparent** 至 **81010** |',
    ].join('\n'),
    hero_image: '',
  },
  // ── Legal ──────────────────────────────────────────────────────────────────
  {
    slug: 'privacy',
    title_en: 'Privacy Policy',
    title_zh: '隱私權政策',
    nav_section: '', nav_order: 99,
    body_en: [
      '**What information do we collect?** When registering or making payment on our site, as appropriate, you may be asked to enter your name, email, address, phone number or other information.',
      '**What do we use your information for?** To process registrations; to communicate with parents.',
      '**How do we protect your information?** All supplied information is transmitted via Secure Socket Layer (SSL) technology.',
      '**Do we disclose any information to outside parties?** Your information will not be sold, exchanged, transferred, or given to any other company. We may release your information when we believe release is appropriate to comply with the law, enforce our site policies, or protect ours or others\' rights, property, or safety.',
      '**Your Consent** — By using our site, you consent to our privacy policy.',
      '**Changes to our Privacy Policy** — If we decide to change our privacy policy, we will post these changes on this page.',
      '**Contacting Us** — Web Site: https://www.sandiegochineseschool.com/ · By Mail: San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093 · By Phone: (858) 205-SDCA (7322) · Email: office.sdca@gmail.com',
    ].join('\n\n'),
    body_zh: [
      '**我們收集哪些資訊？** 當您在我們的網站註冊或付款時，可能需要輸入您的姓名、電子郵件、地址、電話或其他資訊。',
      '**我們如何使用您的資訊？** 用於處理註冊；與家長溝通。',
      '**我們如何保護您的資訊？** 所有提供的資訊均透過Secure Socket Layer (SSL)技術傳輸。',
      '**我們是否向第三方披露資訊？** 您的資訊不會被出售、交換、轉移或給任何其他公司。在我們認為需要遵守法律、執行網站政策或保護我們或他人的權利、財產或安全時，我們可能會披露您的資訊。',
      '**您的同意** — 使用我們的網站即表示您同意我們的隱私權政策。',
      '**政策變更** — 如我們決定修改隱私權政策，將在本頁面發佈變更。',
      '**聯繫我們** — 網站：https://www.sandiegochineseschool.com/ · 郵寄：San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093 · 電話：(858) 205-SDCA (7322) · 電郵：office.sdca@gmail.com',
    ].join('\n\n'),
    hero_image: '',
  },
  {
    slug: 'disclaimer',
    title_en: 'Disclaimer',
    title_zh: '免責聲明',
    nav_section: '', nav_order: 100,
    body_en: 'SDCA appreciates all the participating parents and friends, but it is participants\' responsibility to check the ingredients with Lai Chen for any food allergy concerns. Thank you!',
    body_zh: '中華學苑感謝所有參與的家長和朋友，但如有食物過敏問題，請自行向Lai Chen確認食材。謝謝！',
    hero_image: '',
  },
  {
    slug: 'education-resource',
    title_en: 'Education Resources',
    title_zh: '教育資源',
    nav_section: '', nav_order: 98,
    body_en: [
      '## External Learning Resources\n\n- **國語日報社** — Mandarin Daily News (Huayu)\n- **南加州中文學校聯合會** — Southern California Council of Chinese Schools\n- **林語堂 當代漢英字典** — Chinese-English Dictionary',
    ].join('\n\n'),
    body_zh: [
      '## 外部學習資源\n\n- **國語日報社** — Mandarin Daily News (Huayu)\n- **南加州中文學校聯合會** — Southern California Council of Chinese Schools\n- **林語堂 當代漢英字典** — Chinese-English Dictionary',
    ].join('\n\n'),
    hero_image: '',
  },
];

export function seedPages(db, log, skipped) {
  let count = 0;
  for (const p of PAGES) {
    db.prepare(`
      INSERT INTO pages (slug, title_en, title_zh, body_en, body_zh, hero_image, nav_section, nav_order, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(slug) DO UPDATE SET
        title_en=excluded.title_en, title_zh=excluded.title_zh,
        body_en=excluded.body_en, body_zh=excluded.body_zh,
        hero_image=excluded.hero_image, nav_section=excluded.nav_section,
        nav_order=excluded.nav_order, updated_at=datetime('now')
    `).run(p.slug, p.title_en, p.title_zh, p.body_en, p.body_zh,
           p.hero_image, p.nav_section, p.nav_order);
    count++;
  }
  log.push(`pages: ${count} rows`);
  return count;
}
