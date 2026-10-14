-- 013_hero_slides.sql — hero slides become fully editable records (Staff Tools → Hero Slides).
-- Every slide has: title, description, image, a "find out more" link (and an optional second button) in English and Chinese.
-- The three slides that were hard-coded or taken from the home page text (welcome, 30th anniversary, enroll) are converted below.
ALTER TABLE slides ADD COLUMN layout TEXT NOT NULL DEFAULT 'photo';          -- photo (caption bar) | feature (headline + buttons) | intro (welcome text + side banners)
ALTER TABLE slides ADD COLUMN description_en TEXT NOT NULL DEFAULT '';        -- markdown (**bold**, links)
ALTER TABLE slides ADD COLUMN description_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN link_label_en TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN link_label_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN link2_url TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN link2_label_en TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN link2_label_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN image_left TEXT NOT NULL DEFAULT '';            -- intro layout: decorative side banners
ALTER TABLE slides ADD COLUMN image_right TEXT NOT NULL DEFAULT '';
ALTER TABLE slides ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE slides ADD COLUMN updated_by INTEGER REFERENCES users(id);
ALTER TABLE slides ADD COLUMN deleted_at TEXT;

-- 1) the welcome slide (was the first block of the home page)
INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published, layout, description_en, description_zh, link_label_en, link_label_zh, image_left, image_right)
VALUES ('intro-bg', 'San Diego Chinese Academy', '聖地牙哥中華學苑', '/about', 0, 1, 'intro', '**San Diego Chinese Academy** is a non-profit organization established in 1988. Our mission is to preserve and promote Chinese tradition, culture and language. We have a team of outstanding faculty and professional administrative personnel. Our classes are conducted in a lively atmosphere interspersed with fun cultural activities. We offer Pre-kindergarten to Grade 12 immersive Chinese classes with ZhuYin and PinYin, bilingual Chinese classes, high school credit classes and adult class. All classes are maintained at a low student to teacher ratio. We are located at La Jolla Country Day School with its beautiful campus and advanced amenities. SDCA is Fully Accredited by WASC.', '**聖地牙哥中華學苑**成立於1988年， 為一所非營利組織， 承載著弘揚中華文化的使命， 教授中華語言與文化。 強大的師資、 專業的管理、 生動活潑的課程與活動設置，  學校的規模日益擴大。 學校設立有學前班、注音班、拼音班、普通班、雙語班、學分班和成人班。 中華學苑上課的校址是 La Jolla Country Day School, 學校的設備先進， 校園環境優美， 秉持著小班教學。聖地牙哥中華學苑是 WASC 認證的學校。', 'About SDCA', '關於學苑',
        '/img/old/2018/SDCA-Spring-Words-Left.gif', '/img/old/2018/SDCA-Spring-Words-Right.gif');

-- 2) 30th anniversary (photo)
UPDATE slides SET layout = 'photo', sort = 1, description_en = 'Mandarin and Chinese culture in San Diego since 1988.', description_zh = '自 1988 年起在聖地牙哥推廣華語與中華文化。',
  link_label_en = 'Learn more', link_label_zh = '了解更多' WHERE image = 'anniversary-30th';

-- 3) enroll (feature; its tagline and two buttons were hard-coded in the template)
UPDATE slides SET layout = 'feature', sort = 2, caption_en = 'Enroll now', caption_zh = '立即報名',
  description_en = 'Non-profit language school teaching Mandarin and Chinese culture since 1988', description_zh = '非營利語言學校，自 1988 年起教授華語和中華文化',
  link_url = '/programs/classes', link_label_en = 'Explore Programs →', link_label_zh = '探索課程 →',
  link2_url = '/portal/signin', link2_label_en = 'Enroll Now', link2_label_zh = '立即報名' WHERE image = 'enroll-bg';

-- Fresh databases have no 30th-anniversary / enroll rows yet (the old seed script inserted them after the migrations) — create them in the final shape.
INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published, layout, description_en, description_zh, link_label_en, link_label_zh)
SELECT 'anniversary-30th', 'Celebrating our 30th anniversary', '慶祝 30 週年', '/about', 1, 1, 'photo', 'Mandarin and Chinese culture in San Diego since 1988.', '自 1988 年起在聖地牙哥推廣華語與中華文化。', 'Learn more', '了解更多'
WHERE NOT EXISTS (SELECT 1 FROM slides WHERE image = 'anniversary-30th');
INSERT INTO slides (image, caption_en, caption_zh, link_url, sort, published, layout, description_en, description_zh, link_label_en, link_label_zh, link2_url, link2_label_en, link2_label_zh)
SELECT 'enroll-bg', 'Enroll now', '立即報名', '/programs/classes', 2, 1, 'feature', 'Non-profit language school teaching Mandarin and Chinese culture since 1988', '非營利語言學校，自 1988 年起教授華語和中華文化', 'Explore Programs →', '探索課程 →', '/portal/signin', 'Enroll Now', '立即報名'
WHERE NOT EXISTS (SELECT 1 FROM slides WHERE image = 'enroll-bg');
