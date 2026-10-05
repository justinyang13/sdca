# Assets catalogue — images & PDFs

Sources: `data/assets.json` (542 entries: 457 images + 85 PDFs), local files under `research/assets/`, page usage from `data/pages.jsonl`. One image (`uploads/2025/12/IMG_3218.jpg`) failed download → 0 bytes, no local file. Dimensions via `sips` or filename suffix. Byte sizes from assets.json.

**Totals:** images 454 files / 152.1 MB · PDFs 85 / 45.2 MB · plus 4 extra PDFs in `research/assets/pdf/registration-portal/` (registration subdomain) ≈5.9 MB.

**Flag: real photos of people (NEVER regenerate)** — everything in §4 is a genuine photo; §2/§3 headshots & sponsor logos of real people/businesses keep originals.

## 1. Logo & favicon — THE logo files

These 4 files exist in `research/assets/images/` (pulled from the site's header/footer/favicon; they were not part of the media-API crawl list, hence not in assets.json). Original on-site URLs: `wp-content/uploads/2018/10/cropped-SDCALogo-1-e1538774755991-2-{32x32,180x180,192x192}.png` (favicons, seen in `raw/pages/home.html`) and the 512 px master. Carry these into the new site (ask the school for an SVG master if available):

| File | Dimensions | Bytes | Role |
|---|---|---|---|
| `SDCALogo-original.png` | 512x512 | 39,189 | header & footer master logo (512 px) |
| `logo-favicon-180x180.png` | 180x180 | 24,754 | favicon / PWA icon |
| `logo-favicon-192x192.png` | 192x192 | 27,225 | favicon / PWA icon |
| `logo-favicon-32x32.png` | 32x32 | 1,863 | favicon / PWA icon |

## 2. Headshots — staff / board / leaders (real people, keep originals)

| File | Dimensions | Bytes | Alt | Pages used |
|---|---|---|---|---|
| `Ana-150x150.jpg` | 150x150 | 6,498 | — | board-of-directors |
| `Christine-Gibbs-150x150.jpg` | 150x150 | 3,855 | — | board-of-directors |
| `Cutrual-Day-1-150x150.jpg` | 150x150 | 8,530 | — | media |
| `Hung-Wang-150x150.jpg` | 150x150 | 5,494 | — | board-of-directors |
| `James-Yu-150x150.jpeg` | 150x150 | 5,902 | — | board-of-directors |
| `Ling-Chan-150x150.jpg` | 150x150 | 6,481 | — | board-of-directors |
| `Regular-K-Class-1-150x150.jpeg` | 150x150 | 7,636 | — | volunteer-opportunity |
| `SDCA-BOD-5-1-150x150.gif` | 150x150 | 21,213 | — | volunteer-opportunity |
| `SDCA-BOD-7-150x150.jpg` | 150x150 | 9,354 | — | board-of-directors |
| `SDCA-BOD-page-1-150x150.jpeg` | 150x150 | 6,871 | — | board-of-directors |
| `SDCA-BOD-page-11-150x150.jpeg` | 150x150 | 7,093 | — | board-of-directors |
| `SDCA-BOD-page-14-150x150.jpg` | 150x150 | 7,972 | — | board-of-directors |
| `SDCA-BOD-page-2-150x150.jpeg` | 150x150 | 7,229 | — | board-of-directors |
| `SDCA-BOD-page-4-150x150.jpeg` | 150x150 | 7,108 | — | board-of-directors |
| `SDCA-BOD-page-6-150x150.jpeg` | 150x150 | 6,678 | — | board-of-directors |
| `SDCA-BOD-page-7-150x150.jpeg` | 150x150 | 7,430 | — | board-of-directors |
| `SDCA-BOD-page-9-150x150.jpeg` | 150x150 | 7,415 | — | board-of-directors |
| `SDCA-Cultural-Day-4-150x150.jpg` | 150x150 | 9,468 | — | board-of-directors |
| `SDCA-GD-0-1.jpg` | 1280x803 | 317,764 | — | media |
| `SDCA-GD-1-150x150.jpg` | 150x150 | 9,638 | — | media |
| `SDCA-GD-3-150x150.jpg` | 150x150 | 8,397 | — | media |
| `SDCA-GD-5-150x150.jpg` | 150x150 | 5,659 | — | media |
| `SDCA-GD-6-150x150.jpg` | 150x150 | 6,113 | — | board-of-directors, media |
| `SDCA-GD-7-150x150.jpg` | 150x150 | 10,573 | — | media |
| `SDCA-PTA-and-Parent-Meeting-150x150.jpeg` | 150x150 | 6,733 | — | volunteer-opportunity |
| `SDCA-Volunteers-150x150.jpg` | 150x150 | 7,800 | — | board-of-directors |
| `SDCA-Volunteers-2-150x150.jpg` | 150x150 | 7,794 | — | volunteer-opportunity |
| `SDCA-Volunteers-3-1-150x150.jpg` | 150x150 | 8,374 | — | board-of-directors |
| `SDCA-Volunteers-3-150x150.jpg` | 150x150 | 8,374 | — | volunteer-opportunity |
| `SDCAHalloween-Flyer_-CNR3-1-150x150.jpg` | 150x150 | 8,376 | — | media |
| `SDCAHalloween-Flyer_-EN3-150x150.jpg` | 150x150 | 16,432 | — | media |
| `___-Ray-Shan-150x150.jpeg` | 150x150 | 12,530 | — | (not inline on crawled pages) |
| `kathy-150x150.jpg` | 150x150 | 31,710 | — | board-of-directors |
| `vegafish-2022-profile_2048x2048-1-150x150.png` | 150x150 | 25,813 | — | board-of-directors |

## 3. Sponsor / ad banners / program graphics (business logos & ads — real brands, keep originals)

| File | Dimensions | Bytes | Alt | Pages used |
|---|---|---|---|---|
| `2026-Pre-registration.gif` | 960x720 | 343,309 | — | 2026-pre-registration |
| `2026-essay-ad.png` | 1485x1103 | 433,204 | — | sample-page/2026-essay-ad |
| `99Ranch2018Banner.jpg` | 170x80 | 10,384 | — | sponsors-2 |
| `C2-Education.png` | 310x106 | 8,858 | — | sponsors-2 |
| `Dr.-Liu-ad-banner1.png` | 718x252 | 314,055 | — | sponsors-2 |
| `East-West-Bank.png` | 372x110 | 14,947 | — | sponsors-2 |
| `GoldenVisionBanner.png` | 180x90 | 9,731 | — | sponsors-2 |
| `Law-Offices-of-Peter-Darwin-Chu.png` | 420x119 | 21,990 | — | sponsors-2 |
| `Mandrin-House.jpeg` | 506x183 | 44,581 | — | sponsors-2 |
| `New-student-Advertisments-2026-scaled.jpg` | 1978x2560 | 1,089,186 | — | new-student-advertisments-2026 |
| `SDCA-Ad-half-page.jpg` | 2550x1650 | 2,516,322 | — | sdca-ad-half-page |
| `SDCA-Header-2018.png` | 993x115 | 22,465 | — | /, %E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1, %E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1, 2018/10/19/2018-19_week_07_announcement_chinese (+128 more) |
| `SDCA-Scrip-Day.png` | 1460x1208 | 206,496 | — | scrip |
| `SDCA-Scrip-Form.png` | 1698x1208 | 360,504 | — | scrip |
| `SDCA-Scrip-Sponsors-3.jpeg` | 750x574 | 111,554 | — | scrip |
| `SDCA-Scrip-Transaction.jpg` | 750x937 | 62,466 | — | scrip |
| `SDCA-Scrip.jpg` | 220x138 | 6,169 | — | scrip |
| `amazon-smile-small-1.jpg` | 91x48 | 4,028 | — | sponsors |
| `escrip-small.jpg` | 147x47 | 5,149 | — | sponsors |


### 3b. Decorative animated GIFs

| File | Dimensions | Bytes | Alt | Pages used |
|---|---|---|---|---|
| `SDCA-Spring-Words-Left.gif` | 149x561 | 4,377 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Spring-Words-Right.gif` | 150x560 | 4,891 | — | /, ?oceanwp_library=sdca-header |
| `Sign-UP-GIF.gif` | 735x343 | 4,795,928 | — | volunteer-opportunity |

## 4. Event / classroom photos (REAL PHOTOS OF PEOPLE — never regenerate)

279 files. Camera originals (`IMG_*`), dated event shots (CNY, Graduation, Cultural Day, Double-Ten, contests, dinners, baseball, etc.) and generic event photos (`image0..5`, `Pic1..3`). All contain identifiable students/teachers — the new site must use these originals.

| File | Dimensions | Bytes | Alt | Pages used |
|---|---|---|---|---|
| `2017-SDCASEA-Scholarship.jpeg` | 467x479 | 83,197 | — | news |
| `2018-2019-Poetry-Recitation-Contest-WWJ.jpeg` | 701x493 | 210,496 | — | news |
| `2018-2019-Teachers.jpg` | 4664x1988 | 3,251,925 | — | about-sdca |
| `2018-International-Tour-of-Taiwan-Gourmet.png` | 430x483 | 97,513 | — | news |
| `20181030-WJ-Side-1.jpg` | 1886x1000 | 581,873 | — | news |
| `2019-KC1.jpg` | 373x500 | 39,140 | — | media |
| `2019-KC2.jpg` | 373x500 | 39,722 | — | media |
| `20190127-WJ-CNY.jpg` | 696x531 | 68,797 | — | news |
| `20190308.jpg` | 725x434 | 116,673 | — | news |
| `20190312-epochtimes.jpg` | 679x628 | 138,692 | — | news |
| `20190318-WeChinse.jpg` | 1297x730 | 289,505 | — | news |
| `20190319-Typing-WJ.jpg` | 1423x538 | 297,226 | — | news |
| `20190322-Chinese-Typing-WeChinese.png` | 1334x750 | 397,678 | — | news |
| `20190402-Karaoke-2-WJ.jpg` | 688x441 | 163,767 | — | news |
| `20190402-Karaoke-WJ.jpg` | 1538x770 | 317,020 | — | news |
| `20190507-WJ.jpg` | 701x516 | 246,036 | — | news |
| `20190602-Graduation.jpeg` | 688x562 | 249,561 | — | news |
| `2020-Double-10-News.jpeg` | 511x483 | 345,649 | — | news |
| `2021-CNY-1.jpg` | 960x1280 | 408,183 | — | /, ?oceanwp_library=sdca-header |
| `2021-CNY-2.jpg` | 960x1280 | 468,086 | — | /, ?oceanwp_library=sdca-header |
| `2022-Poety-Recitation-Contest-1-768x742.jpeg` | 768x742 | 114,253 | — | news |
| `2022-Poety-Recitation-Contest-2.jpeg` | 382x294 | 51,861 | — | news |
| `2025-SDCA-Halloween-Costume-206x300.png` | 206x300 | 93,475 | — | media |
| `2026-2027-First-Day-of-School.jpg` | 514x303 | 42,975 | — | 2026-2027-first-day-of-school |
| `2026-First-Day-of-School-1.jpg` | 514x303 | 42,394 | — | 2026-first-day-of-school-2 |
| `Adult.jpg` | 2550x1650 | 1,077,811 | — | adult |
| `BOD.jpg` | 2048x1442 | 1,370,462 | — | bod |
| `CNY-1.jpg` | 400x517 | 55,633 | — | about-sdca |
| `CNY-2.jpg` | 400x517 | 52,489 | — | about-sdca |
| `CNY-3.jpg` | 400x517 | 54,056 | — | about-sdca |
| `CSL-Project.jpg` | 1530x2048 | 667,632 | — | /, ?oceanwp_library=sdca-header |
| `Class-Placement-Image-WP-768x576.gif` | 768x576 | 175,266 | — | class-placement |
| `Class-of-2020-1.jpg` | 960x960 | 291,552 | — | /, ?oceanwp_library=sdca-header |
| `Class-of-2020-2-300x300.jpg` | 300x300 | 28,444 | — | media |
| `Credit-Class-Activities.jpg` | 400x517 | 53,510 | — | about-sdca |
| `Credit-Class-Food-Activity.jpeg` | 2250x3000 | 1,726,059 | — | /, ?oceanwp_library=sdca-header |
| `Credit-Class-Poetry-Recitation.jpeg` | 1530x2048 | 646,342 | — | /, ?oceanwp_library=sdca-header |
| `Cultural-Day-WJ-2.jpg` | 1851x869 | 416,058 | — | news |
| `Cultural-Day-WeChinese.jpg` | 1650x1012 | 493,168 | — | news |
| `Cultural-Day.jpg` | 400x517 | 56,359 | — | about-sdca |
| `Culture-Day-1-227x300.jpeg` | 227x300 | 30,853 | — | media |
| `Culture-Day-2-225x300.jpeg` | 225x300 | 29,177 | — | media |
| `Culture_day_2025-300x164.jpg` | 300x164 | 19,508 | — | media |
| `Dance-together-300x194.jpeg` | 300x194 | 16,510 | — | adult-recreational-programs |
| `Dinner-scaled.jpg` | 1950x2560 | 917,595 | — | dinner-3 |
| `Double-Ten-Flag-2019.jpg` | 750x628 | 510,924 | — | news |
| `Double-Ten-Flags.jpg` | 750x589 | 121,359 | — | news |
| `Double-Ten-Sing.jpeg` | 685x569 | 258,167 | — | news |
| `First-Day-Of-School-1-225x300.jpg` | 225x300 | 25,644 | — | media |
| `First-Day-Of-School-2-225x300.jpg` | 225x300 | 24,186 | — | media |
| `First-Day-Of-School-3-225x300.jpeg` | 225x300 | 22,751 | — | media |
| `Graduation-1.jpeg` | 1530x2048 | 977,432 | — | media |
| `Graduation-2.jpeg` | 1530x2048 | 789,933 | — | media |
| `Graduation-3.jpeg` | 1530x2048 | 1,022,844 | — | media |
| `Graduation-4-300x300.jpeg` | 300x300 | 26,040 | — | media |
| `IMG_0113-300x300.jpg` | 300x300 | 44,605 | — | media |
| `IMG_0129-300x200.jpg` | 300x200 | 24,749 | — | media |
| `IMG_0130-300x200.jpg` | 300x200 | 22,261 | — | media |
| `IMG_0131-300x200.jpg` | 300x200 | 26,602 | — | media |
| `IMG_0132-300x200.jpg` | 300x200 | 25,163 | — | media |
| `IMG_0181-231x300.jpg` | 231x300 | 20,850 | — | media |
| `IMG_0238-300x225.jpg` | 300x225 | 20,448 | — | media |
| `IMG_0239-300x179.jpg` | 300x179 | 20,458 | — | media |
| `IMG_0240-300x202.jpg` | 300x202 | 18,290 | — | media |
| `IMG_0241-281x300.jpg` | 281x300 | 23,646 | — | media |
| `IMG_0243-300x223.jpg` | 300x223 | 20,677 | — | media |
| `IMG_0397-300x225.jpg` | 300x225 | 32,917 | — | media |
| `IMG_0398-300x225.jpg` | 300x225 | 34,256 | — | media |
| `IMG_0779-300x225.jpg` | 300x225 | 24,193 | — | media |
| `IMG_0781-300x162.jpg` | 300x162 | 19,083 | — | media |
| `IMG_0782-300x167.jpg` | 300x167 | 20,007 | — | media |
| `IMG_0783-300x171.jpg` | 300x171 | 20,961 | — | media |
| `IMG_0784-300x242.jpg` | 300x242 | 24,991 | — | media |
| `IMG_0828-225x300.jpg` | 225x300 | 24,739 | — | media |
| `IMG_0829-300x300.jpg` | 300x300 | 27,075 | — | media |
| `IMG_0830-300x300.jpg` | 300x300 | 31,222 | — | media |
| `IMG_0831-300x300.jpg` | 300x300 | 28,910 | — | media |
| `IMG_0912-225x300.jpg` | 225x300 | 23,268 | — | media |
| `IMG_0914-300x244.jpg` | 300x244 | 25,811 | — | media |
| `IMG_0915-300x174.jpg` | 300x174 | 20,190 | — | media |
| `IMG_0940-768x355.png` | 768x355 | 325,843 | — | media |
| `IMG_0959-300x170.jpg` | 300x170 | 28,207 | — | media |
| `IMG_0963-300x92.jpg` | 300x92 | 14,783 | — | media |
| `IMG_0965-300x179.jpg` | 300x179 | 22,591 | — | media |
| `IMG_0967-300x251.jpg` | 300x251 | 34,982 | — | media |
| `IMG_0968-300x191.jpg` | 300x191 | 27,358 | — | media |
| `IMG_1240-300x227.jpg` | 300x227 | 18,299 | — | media |
| `IMG_1241-300x229.jpg` | 300x229 | 17,047 | — | media |
| `IMG_1242-300x223.jpg` | 300x223 | 20,599 | — | media |
| `IMG_1259-300x230.jpg` | 300x230 | 19,422 | — | media |
| `IMG_1801-1-237x300.jpg` | 237x300 | 16,654 | — | media |
| `IMG_1802-237x300.jpg` | 237x300 | 20,242 | — | media |
| `IMG_1803-237x300.jpg` | 237x300 | 19,545 | — | media |
| `IMG_1809-237x300.jpg` | 237x300 | 20,918 | — | media |
| `IMG_2381-300x172.jpg` | 300x172 | 33,012 | — | media |
| `IMG_2387-235x300.jpg` | 235x300 | 22,378 | — | media |
| `IMG_2390-300x225.jpg` | 300x225 | 34,225 | — | media |
| `IMG_2406-300x193.jpg` | 300x193 | 19,654 | — | media |
| `IMG_2407-300x187.jpg` | 300x187 | 26,464 | — | media |
| `IMG_2648-225x300.jpg` | 225x300 | 32,189 | — | media |
| `IMG_2649-225x300.jpg` | 225x300 | 30,409 | — | media |
| `IMG_2653-300x225.jpg` | 300x225 | 35,263 | — | media |
| `IMG_2656-300x300.jpg` | 300x300 | 53,582 | — | media |
| `IMG_2885-300x167.jpg` | 300x167 | 27,415 | — | media |
| `IMG_2885-scaled.jpg` | 2560x1422 | 581,737 | — | img_2885 |
| `IMG_2889-300x225.jpg` | 300x225 | 30,106 | — | media |
| `IMG_2889-scaled.jpg` | 2560x1920 | 689,026 | — | img_2889 |
| `IMG_2891-262x300.jpg` | 262x300 | 28,404 | — | media |
| `IMG_2891-scaled.jpg` | 2233x2560 | 671,146 | — | img_2891 |
| `IMG_2892-300x225.jpg` | 300x225 | 34,802 | — | media |
| `IMG_2892-scaled.jpg` | 2560x1920 | 954,463 | — | img_2892 |
| `IMG_2964-300x200.jpg` | 300x200 | 25,504 | — | media |
| `IMG_2966-300x200.jpg` | 300x200 | 29,113 | — | media |
| `IMG_2967-300x200.jpg` | 300x200 | 28,524 | — | media |
| `IMG_3395-300x284.jpg` | 300x284 | 42,044 | — | media |
| `IMG_3401-225x300.jpg` | 225x300 | 17,230 | — | media |
| `IMG_3519-225x300.jpg` | 225x300 | 23,913 | — | media |
| `IMG_3521-300x274.jpg` | 300x274 | 28,734 | — | media |
| `IMG_3544.jpg` | 1170x1079 | 1,037,017 | — | news |
| `IMG_3631-225x300.jpg` | 225x300 | 24,895 | — | media |
| `IMG_3633-225x300.jpg` | 225x300 | 25,322 | — | media |
| `IMG_3634-225x300.jpg` | 225x300 | 23,050 | — | media |
| `IMG_3774.jpg` | 828x542 | 323,737 | — | news |
| `IMG_4108-225x300.jpeg` | 225x300 | 31,504 | — | media |
| `IMG_4108-scaled.jpeg` | 1920x2560 | 542,426 | — | img_4108 |
| `IMG_4117-300x225.jpeg` | 300x225 | 36,800 | — | media |
| `IMG_4117-scaled.jpeg` | 2560x1920 | 972,227 | — | img_4117 |
| `IMG_4188.jpg` | 1040x553 | 200,067 | — | screenshot |
| `IMG_4189.jpg` | 996x563 | 206,694 | — | screenshot-2 |
| `IMG_4190.jpg` | 985x669 | 223,651 | — | screenshot-3 |
| `IMG_4215-scaled.jpeg` | 2560x1520 | 519,413 | — | img_4215 |
| `IMG_4216-scaled.jpeg` | 1560x2560 | 374,481 | — | img_4216 |
| `IMG_4219-scaled.jpeg` | 2560x1920 | 669,931 | — | img_4219 |
| `IMG_4223-scaled.jpeg` | 2560x1920 | 568,486 | — | img_4223 |
| `IMG_4364.jpg` | 740x946 | 302,504 | — | news |
| `IMG_4607.jpg` | 1020x660 | 190,992 | — | img_4607 |
| `IMG_4684-768x432.jpg` | 768x432 | 92,210 | — | media |
| `IMG_4685-768x1024.jpg` | 768x1024 | 158,457 | — | media |
| `IMG_4686-225x300.jpg` | 225x300 | 22,542 | — | media |
| `IMG_4687-225x300.jpg` | 225x300 | 18,396 | — | media |
| `IMG_4864.jpg` | 1170x1011 | 367,333 | — | news |
| `IMG_4871.jpg` | 1170x876 | 345,319 | — | news |
| `IMG_5351-300x236.jpeg` | 300x236 | 31,971 | — | media |
| `IMG_5351-scaled.jpeg` | 2560x2018 | 844,777 | — | img_5351 |
| `IMG_5352-300x199.jpeg` | 300x199 | 29,350 | — | media |
| `IMG_5352-scaled.jpeg` | 2560x1695 | 630,744 | — | img_5352 |
| `IMG_5353-225x300.jpeg` | 225x300 | 34,906 | — | media |
| `IMG_5353-scaled.jpeg` | 1920x2560 | 745,531 | — | img_5353 |
| `IMG_5356-300x225.jpeg` | 300x225 | 40,180 | — | media |
| `IMG_5356-scaled.jpeg` | 2560x1920 | 924,511 | — | img_5356 |
| `IMG_5806-300x225.jpeg` | 300x225 | 33,832 | — | media |
| `IMG_5806-scaled.jpeg` | 2560x1920 | 704,037 | — | upcoming-event/img_5806 |
| `IMG_5811-300x225.jpeg` | 300x225 | 29,587 | — | media |
| `IMG_5811-scaled.jpeg` | 2560x1920 | 434,585 | — | upcoming-event/img_5811 |
| `IMG_5817-300x225.jpeg` | 300x225 | 33,315 | — | media |
| `IMG_5817-scaled.jpeg` | 2560x1920 | 663,471 | — | upcoming-event/img_5817 |
| `IMG_5827.jpg` | 2359x1558 | 1,146,448 | — | upcoming-event/img_5827 |
| `IMG_5828.jpg` | 1477x771 | 490,789 | — | upcoming-event/img_5828 |
| `IMG_6209-225x300.jpg` | 225x300 | 33,865 | — | media |
| `IMG_6210-225x300.jpg` | 225x300 | 32,980 | — | media |
| `IMG_6304-225x300.jpg` | 225x300 | 70,922 | — | media |
| `IMG_6305-225x300.jpg` | 225x300 | 67,915 | — | media |
| `IMG_6306-225x300.jpg` | 225x300 | 75,962 | — | media |
| `IMG_6307-300x225.jpg` | 300x225 | 72,827 | — | media |
| `IMG_6328-300x162.jpg` | 300x162 | 13,584 | — | media |
| `IMG_6329-300x238.jpg` | 300x238 | 16,993 | — | media |
| `IMG_7835.jpg` | 2250x3000 | 2,282,515 | — | /, ?oceanwp_library=sdca-header |
| `IMG_7886-300x207.jpg` | 300x207 | 18,550 | — | media |
| `IMG_8341-300x223.jpg` | 300x223 | 18,705 | — | media |
| `IMG_8344-300x221.jpg` | 300x221 | 17,064 | — | media |
| `IMG_8345-300x222.jpg` | 300x222 | 15,532 | — | media |
| `IMG_8346-300x222.jpg` | 300x222 | 18,045 | — | media |
| `IMG_8348.jpg` | 2000x3000 | 1,269,358 | — | /, ?oceanwp_library=sdca-header |
| `IMG_8986.jpg` | 1477x1108 | 493,884 | — | img_8986 |
| `IMG_8987.jpg` | 1477x1108 | 497,064 | — | img_8987 |
| `IMG_8988.jpg` | 1108x1477 | 510,638 | — | img_8988 |
| `IMG_8989.jpg` | 1477x1108 | 481,053 | — | img_8989 |
| `IMG_9001-225x300.jpg` | 225x300 | 65,722 | — | media, tcml |
| `IMG_9002-225x300.jpg` | 225x300 | 72,116 | — | media, tcml |
| `IMG_9003-225x300.jpg` | 225x300 | 60,152 | — | media, tcml |
| `IMG_9061-300x223.jpg` | 300x223 | 19,805 | — | media |
| `IMG_9062-241x300.jpg` | 241x300 | 25,094 | — | media |
| `IMG_9063-193x300.jpg` | 193x300 | 17,904 | — | media |
| `IMG_9064-232x300.jpg` | 232x300 | 20,976 | — | media |
| `IMG_9066-300x222.jpg` | 300x222 | 17,445 | — | media |
| `IMG_9109-225x300.jpg` | 225x300 | 37,003 | — | media |
| `IMG_9118-300x231.jpg` | 300x231 | 42,448 | — | media |
| `IMG_9119-300x225.jpg` | 300x225 | 30,843 | — | media |
| `IMG_9121-166x300.jpg` | 166x300 | 25,680 | — | media |
| `IMG_9129-1-300x246.jpg` | 300x246 | 32,549 | — | media |
| `IMG_9701-300x243.jpg` | 300x243 | 36,211 | — | media |
| `IMG_9702-225x300.jpg` | 225x300 | 29,809 | — | media |
| `IMG_9703-300x292.jpg` | 300x292 | 42,364 | — | media |
| `IMG_9704-225x300.jpg` | 225x300 | 31,766 | — | media |
| `IMG_9705-225x300.jpg` | 225x300 | 31,851 | — | media |
| `IMG_9726-768x473.jpg` | 768x473 | 154,290 | — | media |
| `IMG_9805-230x300.jpg` | 230x300 | 44,438 | — | media |
| `IMG_9806-230x300.jpg` | 230x300 | 50,992 | — | media |
| `IMG_9807-230x300.jpg` | 230x300 | 45,013 | — | media |
| `IMG_9808-230x300.jpg` | 230x300 | 46,007 | — | media |
| `Pic1-300x225.jpg` | 300x225 | 10,866 | — | media |
| `Pic2-768x549.jpg` | 768x549 | 42,474 | — | media |
| `Pic3-300x210.jpg` | 300x210 | 8,855 | — | media |
| `Pre-K-Program-5.jpeg` | 1859x1186 | 685,622 | — | /, ?oceanwp_library=sdca-header |
| `Recital-Contest.jpg` | 400x517 | 50,723 | — | about-sdca |
| `SDCA-2017-2018-Graduates.jpeg` | 4032x3024 | 2,798,074 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-30th-Anniversary-5.jpg` | 2000x1333 | 474,700 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-30th-Anniversary-and-Chinese-New-Year-Festival-News-from-Epoch-Times.jpeg` | 750x642 | 316,205 | — | news |
| `SDCA-30th-Anniversary-and-Chinese-New-Year-Festival-News-from-We-Chinese.png` | 816x429 | 160,727 | — | news |
| `SDCA-30th-Anniversary-and-Chinese-New-Year-Festival-News-from-World-Journal.jpeg` | 702x540 | 294,945 | — | news |
| `SDCA-30th-Anniversary-and-Chinese-New-Year-Festival.png` | 323x335 | 68,146 | — | news |
| `SDCA-Beginner-Class-1.jpeg` | 1866x1181 | 792,590 | — | class-placement |
| `SDCA-Bilingual-Class-1-1.jpeg` | 2300x1188 | 975,711 | — | class-placement |
| `SDCA-Bilingual-Class.jpg` | 3662x2744 | 756,176 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Chinese-Typing.jpeg` | 4032x3024 | 2,960,934 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Community-Service.jpeg` | 6016x4016 | 5,988,090 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Credit-Class-Cultural-Activity-5.jpg` | 1865x1343 | 359,664 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Credit-Class-Cultural-Activity-7.jpeg` | 1850x1344 | 834,389 | — | class-placement |
| `SDCA-Cultural-Day.jpeg` | 750x562 | 244,492 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Essay-Competition-1.png` | 432x390 | 88,404 | — | news |
| `SDCA-Fundamental-Class-Regular.jpeg` | 4032x2069 | 2,247,769 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Graduation-Ceremony-1.jpg` | 400x400 | 30,765 | — | about-sdca |
| `SDCA-Karaoke-Contest.jpg` | 1475x898 | 459,954 | — | news |
| `SDCA-Poetry-Recitation-Contest-2.jpeg` | 705x545 | 162,485 | — | news |
| `SDCA-Poetry-Recitation-Contest-News-from-We-Chinese.jpeg` | 694x435 | 179,160 | — | news |
| `SDCA-Poetry-Recitation-Contest.jpg` | 580x300 | 102,752 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Preschool-Program-1-768x552.jpeg` | 768x552 | 101,670 | — | class-placement |
| `SDCA-Qigong-Seminar.jpeg` | 4032x3024 | 2,568,482 | — | /, ?oceanwp_library=sdca-header |
| `SDCA-Regular-Class-Original.jpeg` | 2092x1188 | 734,294 | — | class-placement |
| `SDCA-Teacher-Appreciation-Dinner.jpg` | 400x535 | 44,416 | — | about-sdca |
| `SDCA-Teacher-Meeting-2-1024x648.jpg` | 1024x648 | 111,278 | — | staff |
| `SDCA-Teachers-1-768x689.jpeg` | 768x689 | 121,818 | — | staff |
| `SDCA-Volunteers-4-768x490.jpg` | 768x490 | 122,709 | — | volunteer-opportunity |
| `SDCA-baseball-team-768x584.jpg` | 768x584 | 121,569 | — | adult-recreational-programs |
| `SDCAHalloween-Flyer_-CN2022-300x278.jpg` | 300x278 | 41,279 | — | media |
| `SDCAHalloween-Flyer_-EN2022-300x279.jpg` | 300x279 | 54,784 | — | media |
| `Speech-Contest-photos.jpg` | 400x517 | 39,046 | — | about-sdca |
| `Student-Store-1-225x300.jpg` | 225x300 | 32,861 | — | media |
| `Student-Store.jpg` | 1575x2100 | 1,271,096 | — | /, ?oceanwp_library=sdca-header |
| `TA-2017-2018.jpg` | 1017x236 | 212,890 | — | ta-program |
| `Teacher-Meeting.jpg` | 1530x2048 | 737,827 | — | /, ?oceanwp_library=sdca-header |
| `Textbook-Pickup-Day.jpg` | 2250x3000 | 2,190,484 | — | /, ?oceanwp_library=sdca-header |
| `Ujam-1.jpg` | 2250x3000 | 2,145,390 | — | /, ?oceanwp_library=sdca-header |
| `Ujam-300x225.jpg` | 300x225 | 29,078 | — | adult-recreational-programs |
| `Writing-1.jpeg` | 1000x1500 | 1,670,521 | — | /, ?oceanwp_library=sdca-header |
| `Yoga-Class-1024x683.jpg` | 1024x683 | 119,121 | — | adult-recreational-programs |
| `Yoga.jpg` | 750x575 | 207,524 | — | adult-recreational-programs |
| `coupon-day.jpg` | 400x517 | 52,486 | — | about-sdca |
| `e-225x300.jpg` | 225x300 | 34,420 | — | media |
| `gilian-150x150.jpg` | 150x150 | 25,691 | — | board-of-directors |
| `image.jpeg` | 1126x1500 | 677,286 | — | /, ?oceanwp_library=sdca-header |
| `image0-1-300x177.jpeg` | 300x177 | 31,103 | — | media |
| `image0-1-300x200.jpeg` | 300x200 | 20,600 | — | media |
| `image0-1-300x290.jpeg` | 300x290 | 98,944 | — | media |
| `image0-229x300.png` | 229x300 | 104,859 | — | media |
| `image0-4-300x223.jpeg` | 300x223 | 24,894 | — | media |
| `image0.jpeg` | 1070x864 | 871,259 | — | news |
| `image1-1-300x207.jpeg` | 300x207 | 18,115 | — | media |
| `image1-225x300.jpeg` | 225x300 | 35,222 | — | media |
| `image1-227x300.png` | 227x300 | 110,271 | — | media |
| `image1-234x300.jpeg` | 234x300 | 19,214 | — | media |
| `image1-300x198.jpeg` | 300x198 | 26,342 | — | media |
| `image1-300x228.jpeg` | 300x228 | 14,945 | — | media |
| `image1-300x250.jpeg` | 300x250 | 22,834 | — | media |
| `image1-300x281.jpeg` | 300x281 | 41,879 | — | media |
| `image1-300x300.jpeg` | 300x300 | 30,560 | — | media |
| `image1-5-300x222.jpeg` | 300x222 | 27,918 | — | media |
| `image1-768x1023.jpeg` | 768x1023 | 171,705 | — | media |
| `image2-1.jpeg` | 733x717 | 248,646 | — | board-of-directors |
| `image2-218x300.png` | 218x300 | 114,017 | — | media |
| `image2.jpeg` | 2250x3000 | 2,085,019 | — | /, ?oceanwp_library=sdca-header |
| `image3-1-300x258.jpeg` | 300x258 | 35,630 | — | media |
| `image3.jpeg` | 733x403 | 169,104 | — | board-of-directors |
| `image4-225x300.jpeg` | 225x300 | 32,735 | — | media |
| `image4-300x225.jpeg` | 300x225 | 19,758 | — | media |
| `image5-300x196.jpeg` | 300x196 | 24,888 | — | media |
| `school-300x161.jpg` | 300x161 | 15,341 | — | media |
| `scrip-flyer-300x169.jpg` | 300x169 | 9,532 | — | scrip |
| `summer-break.jpeg` | 750x985 | 943,545 | — | upcoming-event/summer-break-2 |

## 5. PDF placeholder icons (auto-generated thumbnails, 232x300/300x232)

62 auto-generated WordPress PDF thumbnails (first page rendered to JPG). Not original art — safe to regenerate or replace with a standard PDF icon.

| File | Dimensions | Bytes | Alt | Pages used |
|---|---|---|---|---|
| `2025-2026-________38__________program_guide-pdf-300x232.jpg` | 300x232 | 15,588 | — | (not inline on crawled pages) |
| `2025-2026-___________-1-pdf-232x300.jpg` | 232x300 | 18,380 | — | (not inline on crawled pages) |
| `2025-2026-___________-pdf-232x300.jpg` | 232x300 | 17,932 | — | (not inline on crawled pages) |
| `2025-2026_School_Calendar-03152026-pdf-232x300.jpg` | 232x300 | 21,112 | — | 2025-2026_school_calendar-03152026 |
| `2025-26_SDCA_______-pdf-232x300.jpg` | 232x300 | 10,586 | — | (not inline on crawled pages) |
| `2026-27_School_Calendar-pdf-232x300.jpg` | 232x300 | 21,164 | — | 2026-27_school_calendar, 2026-27_school_calendar-2 |
| `2026-Essay-Application-pdf-232x300.jpg` | 232x300 | 14,157 | — | 2026-essay-application |
| `2026-HOC-Essay-English-Announcement-pdf-232x300.jpg` | 232x300 | 18,267 | — | 2026-hoc-essay-english-announcement |
| `2026-_________-pdf-232x300.jpg` | 232x300 | 17,683 | — | (not inline on crawled pages) |
| `2026_2027_Classroom-Map-pdf-300x232.jpg` | 300x232 | 10,519 | — | 2026_2027_classroom-map |
| `SDCA-Yearbook-Cover-Art-Contest-Guidelines-2025-2026-pdf-232x300.jpg` | 232x300 | 18,908 | — | sdca-yearbook-cover-art-contest-guidelines-2025-2026 |
| `Student-Store-Schedule-pdf-232x300.jpg` | 232x300 | 11,638 | — | student-store-schedule |
| `W01_news_Chn-pdf-232x300.jpg` | 232x300 | 9,248 | — | w01_news_chn-4 |
| `W01_news_Eng-pdf-232x300.jpg` | 232x300 | 6,982 | — | w01_news_eng-4 |
| `W02_news_Chn-pdf-232x300.jpg` | 232x300 | 12,128 | — | w02_news_chn-4 |
| `W02_news_Eng-pdf-232x300.jpg` | 232x300 | 8,376 | — | w02_news_eng-4 |
| `W03_news_Chn-pdf-232x300.jpg` | 232x300 | 10,077 | — | w03_news_chn-4 |
| `W03_news_Eng-pdf-232x300.jpg` | 232x300 | 10,002 | — | w03_news_eng-4 |
| `W04_news_Chn-pdf-232x300.jpg` | 232x300 | 11,333 | — | w04_news_chn-4 |
| `W04_news_Eng-pdf-232x300.jpg` | 232x300 | 9,753 | — | w04_news_eng-4 |
| `W12_news_Chn-pdf-232x300.jpg` | 232x300 | 13,282 | — | w12_news_chn-3 |
| `W12_news_Eng-pdf-232x300.jpg` | 232x300 | 12,961 | — | w12_news_eng-3 |
| `W13_news_Chn-pdf-232x300.jpg` | 232x300 | 14,782 | — | w13_news_chn-2 |
| `W13_news_Eng-pdf-232x300.jpg` | 232x300 | 15,248 | — | w13_news_eng-2 |
| `W14_news_Chn-pdf-232x300.jpg` | 232x300 | 14,117 | — | w14_news_chn-3 |
| `W14_news_Eng-pdf-232x300.jpg` | 232x300 | 14,854 | — | w14_news_eng-3 |
| `W15_news_Chn-pdf-232x300.jpg` | 232x300 | 12,910 | — | w15_news_chn-3 |
| `W15_news_Eng-pdf-232x300.jpg` | 232x300 | 14,723 | — | w15_news_eng-3 |
| `W16_news_Chn-pdf-232x300.jpg` | 232x300 | 13,240 | — | w16_news_chn-3 |
| `W16_news_Eng-pdf-232x300.jpg` | 232x300 | 13,114 | — | w16_news_eng-3 |
| `W17_news_Chn-pdf-232x300.jpg` | 232x300 | 13,123 | — | w17_news_chn-3 |
| `W17_news_Eng-pdf-232x300.jpg` | 232x300 | 12,965 | — | w17_news_eng-3 |
| `W18_news_Chn-1-pdf-232x300.jpg` | 232x300 | 12,843 | — | w18_news_chn-4 |
| `W18_news_Chn-pdf-232x300.jpg` | 232x300 | 12,843 | — | w18_news_chn-3 |
| `W18_news_Eng-1-pdf-232x300.jpg` | 232x300 | 12,956 | — | w18_news_eng-4 |
| `W18_news_Eng-pdf-232x300.jpg` | 232x300 | 12,956 | — | w18_news_eng-3 |
| `W19_news_Chn-pdf-232x300.jpg` | 232x300 | 13,840 | — | w19_news_chn-3 |
| `W19_news_Eng-pdf-232x300.jpg` | 232x300 | 12,285 | — | w19_news_eng-3 |
| `W20_news_Chn-pdf-232x300.jpg` | 232x300 | 11,872 | — | w20_news_chn-2 |
| `W20_news_Eng-pdf-232x300.jpg` | 232x300 | 10,367 | — | w20_news_eng-2 |
| `W21_news_Chn-pdf-232x300.jpg` | 232x300 | 10,697 | — | w21_news_chn-2 |
| `W21_news_Eng-pdf-232x300.jpg` | 232x300 | 14,862 | — | w21_news_eng-2 |
| `W22_news_Chn-pdf-232x300.jpg` | 232x300 | 10,233 | — | w22_news_chn-3 |
| `W22_news_Eng-pdf-232x300.jpg` | 232x300 | 14,571 | — | w22_news_eng-3 |
| `W23_news_Chn-pdf-232x300.jpg` | 232x300 | 12,148 | — | w23_news_chn-2 |
| `W23_news_Eng-pdf-232x300.jpg` | 232x300 | 12,201 | — | w23_news_eng-2 |
| `W24_news_Chn-pdf-232x300.jpg` | 232x300 | 8,546 | — | w24_news_chn-3 |
| `W24_news_Eng-pdf-232x300.jpg` | 232x300 | 11,587 | — | w24_news_eng-3 |
| `W25_news_Chn-pdf-232x300.jpg` | 232x300 | 6,814 | — | w25_news_chn-3 |
| `W25_news_Eng-pdf-232x300.jpg` | 232x300 | 9,963 | — | w25_news_eng-3 |
| `W26_news_Chn-pdf-232x300.jpg` | 232x300 | 10,258 | — | w26_news_chn-4 |
| `W26_news_Eng-pdf-232x300.jpg` | 232x300 | 12,992 | — | w26_news_eng-3 |
| `W27_news_Chn-pdf-232x300.jpg` | 232x300 | 8,994 | — | w27_news_chn-3 |
| `W27_news_Eng-pdf-232x300.jpg` | 232x300 | 12,006 | — | w27_news_eng-3 |
| `W28_news_Chn-pdf-232x300.jpg` | 232x300 | 10,008 | — | w28_news_chn-3 |
| `W28_news_Eng-pdf-232x300.jpg` | 232x300 | 11,895 | — | w28_news_eng-3 |
| `W29_news_Chn-1-pdf-232x300.jpg` | 232x300 | 9,797 | — | w29_news_chn-5 |
| `W29_news_Chn-2-pdf-232x300.jpg` | 232x300 | 9,797 | — | w29_news_chn-6 |
| `W29_news_Chn-pdf-232x300.jpg` | 232x300 | 9,797 | — | w29_news_chn-4 |
| `W29_news_Eng-1-pdf-232x300.jpg` | 232x300 | 9,575 | — | w29_news_eng-5 |
| `W29_news_Eng-pdf-232x300.jpg` | 232x300 | 9,575 | — | w29_news_eng-4 |
| `____-pdf-232x300.jpg` | 232x300 | 18,978 | — | (not inline on crawled pages) |

## 6. Duplicates (Elementor/optimiser hashed copies)

57 files are byte-identical copies of another asset (WordPress/Elementor adds an 8-hex suffix when the same file is re-uploaded). The hashed one is the duplicate — keep the clean-named original, drop the hashed one.

| Duplicate file | Original | Bytes |
|---|---|---|
| `2018-2019-Teachers.6e2da143.jpg` | `2018-2019-Teachers.jpg` | 3,251,925 |
| `2026-27_School_Calendar-pdf-232x300.9ed5012e.jpg` | `2026-27_School_Calendar-pdf-232x300.jpg` | 21,103 |
| `Adult.9730cd1e.jpg` | `Adult.jpg` | 1,077,811 |
| `BOD.3d3b6140.jpg` | `BOD.jpg` | 1,370,462 |
| `Class-of-2020-1.fab7fd8d.jpg` | `Class-of-2020-1.jpg` | 291,552 |
| `IMG_3544.03739f14.jpg` | `IMG_3544.jpg` | 1,037,017 |
| `IMG_4188.64975cf7.jpg` | `IMG_4188.jpg` | 200,067 |
| `IMG_4189.6a1c223c.jpg` | `IMG_4189.jpg` | 206,694 |
| `IMG_4190.02de01cb.jpg` | `IMG_4190.jpg` | 223,651 |
| `IMG_4864.eeca5dee.jpg` | `IMG_4864.jpg` | 367,333 |
| `IMG_4871.10b189b2.jpg` | `IMG_4871.jpg` | 345,319 |
| `IMG_5827.4241c3de.jpg` | `IMG_5827.jpg` | 1,146,448 |
| `IMG_5828.bf643493.jpg` | `IMG_5828.jpg` | 490,789 |
| `IMG_8986.5044e7bb.jpg` | `IMG_8986.jpg` | 493,884 |
| `IMG_8987.d569198b.jpg` | `IMG_8987.jpg` | 497,064 |
| `IMG_8988.7f0696ff.jpg` | `IMG_8988.jpg` | 510,638 |
| `IMG_8989.55342cf5.jpg` | `IMG_8989.jpg` | 481,053 |
| `SDCA-30th-Anniversary-5.dbbd3020.jpg` | `SDCA-30th-Anniversary-5.jpg` | 474,700 |
| `SDCA-Ad-half-page.d161d891.jpg` | `SDCA-Ad-half-page.jpg` | 2,516,322 |
| `SDCA-Community-Service.afeae869.jpeg` | `SDCA-Community-Service.jpeg` | 5,988,090 |
| `SDCA-Cultural-Day.f3d89943.jpeg` | `SDCA-Cultural-Day.jpeg` | 244,492 |
| `SDCA-Qigong-Seminar.9caf4036.jpeg` | `SDCA-Qigong-Seminar.jpeg` | 2,568,482 |
| `image0.0a583c58.jpeg` | `image0.jpeg` | 404,118 |
| `image0.31a20f48.jpeg` | `image0.jpeg` | 2,322,643 |
| `image0.456af342.jpeg` | `image0.jpeg` | 461,723 |
| `image0.560f410a.jpeg` | `image0.jpeg` | 124,086 |
| `image0.9a396b37.jpeg` | `image0.jpeg` | 519,427 |
| `image0.a387f319.jpeg` | `image0.jpeg` | 480,310 |
| `image0.b1fb3f92.jpeg` | `image0.jpeg` | 788,945 |
| `image0.c0bebe21.jpeg` | `image0.jpeg` | 38,766 |
| `image0.c2c31c4f.jpeg` | `image0.jpeg` | 871,259 |
| `image0.c55fe514.jpeg` | `image0.jpeg` | 1,833,961 |
| `image0.cd17634f.jpeg` | `image0.jpeg` | 2,279,458 |
| `image0.e2b5ecc7.jpeg` | `image0.jpeg` | 446,061 |
| `image0.e3b93305.jpeg` | `image0.jpeg` | 2,653,707 |
| `image1-225x300.17f2f1ac.jpeg` | `image1-225x300.jpeg` | 32,170 |
| `image1-225x300.74422ba7.jpeg` | `image1-225x300.jpeg` | 24,525 |
| `image1-225x300.c60e5345.jpeg` | `image1-225x300.jpeg` | 52,061 |
| `image2-1.1030810f.jpeg` | `image2-1.jpeg` | 4,070,507 |
| `image2.074b50b9.jpeg` | `image2.jpeg` | 434,866 |
| `image2.1576aa1f.jpeg` | `image2.jpeg` | 359,922 |
| `image2.179b113c.jpeg` | `image2.jpeg` | 2,420,356 |
| `image2.2de9ca97.jpeg` | `image2.jpeg` | 2,085,019 |
| `image2.3c9b51cb.jpeg` | `image2.jpeg` | 2,392,271 |
| `image2.4fbbc0a4.jpeg` | `image2.jpeg` | 456,460 |
| `image2.611e67e6.jpeg` | `image2.jpeg` | 2,034,665 |
| `image2.74ec2934.jpeg` | `image2.jpeg` | 2,619,908 |
| `image2.ae9b28f0.jpeg` | `image2.jpeg` | 908,573 |
| `image2.af571161.jpeg` | `image2.jpeg` | 78,150 |
| `image3.0b0f6dfa.jpeg` | `image3.jpeg` | 1,859,187 |
| `image3.47457d56.jpeg` | `image3.jpeg` | 319,988 |
| `image3.7af71bd4.jpeg` | `image3.jpeg` | 317,941 |
| `image3.914ac280.jpeg` | `image3.jpeg` | 1,882,049 |
| `image3.c1969bfb.jpeg` | `image3.jpeg` | 298,389 |
| `image3.e3e6fcf8.jpeg` | `image3.jpeg` | 173,135 |
| `image3.efb326e1.jpeg` | `image3.jpeg` | 441,890 |
| `image4-225x300.a883eece.jpeg` | `image4-225x300.jpeg` | 33,413 |

## 7. PDFs

85 PDFs in assets.json, all linked from at least one crawled page. Topics derived from the linking page text.

| File | Bytes | Title/topic | Pages linking |
|---|---|---|---|
| `2016-Class-Info-Bilingual-Class.pdf` | 2,014,751 | 2016-Class-Info-Bilingual-Class | class-placement |
| `2016-Class-Info-Regular-Class-1.pdf` | 1,395,837 | 2016-Class-Info-Regular-Class-1 | class-placement |
| `2018-19_week_07_announcement_Chinese.pdf` | 396,652 | 2018-19 week 07 announcement Chinese | 2018/10/19/2018-19_week_07_announcement_chinese |
| `2018-19_week_07_announcement_English.pdf` | 456,341 | 2018-19 week 07 announcement English | 2018/10/19/2018-19_week_07_announcement_english |
| `2018-2019-P07_Textbook_list_20180831.pdf` | 411,783 | 2018-2019-P07 Textbook list 20180831 | /, %E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1, %E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1, 2018/10/19/2018-19_week_07_announcement_chinese (+128) |
| `2025-2026-_E8_81_96_E5_9C_B0_E7_89_99_E5_93_A5_E4_B8_AD_E8_8F_AF_E5_AD_B8_E8_8B_9138_E9_80_B1_E5_B9_B4_E6_A0_A1_E6_85_B6_E6_9A_A8_E6_98_A5_E7_AF_80_E5_9C_92_E9_81_8A_E6_9C_83program_guide.pdf` | 1,297,202 | 2025-2026- E8 81 96 E5 9C B0 E7 89 99 E5 93 A5 E4 B8 AD E8 8F AF E5 AD B8 E8 8B 9138 E9 80 B1 E5 B9 B4 E6 A0 A1 E6 85 B6 E6 9A A8 E6 98 A5 E7 AF 80 E5 9C 92 E9 81 8A E6 9C 83program guide | 2025-2026-%E8%81%96%E5%9C%B0%E7%89%99%E5%93%A5%E4%B8%AD%E8%8F%AF%E5%AD%B8%E8%8B%9138%E9%80%B1%E5%B9%B4%E6%A0%A1%E6%85%B6%E6%9A%A8%E6%98%A5%E7%AF%80%E5%9C%92%E9%81%8A%E6%9C%83program_guide |
| `2025-2026-_E8_A9_A9_E8_A9_9E_E6_9C_97_E8_AA_A6_E6_AF_94_E8_B3_BD_E8_A6_8F_E5_89_87_E5_8F_8A_E8_A9_A9_E8_A9_9E-1.pdf` | 4,732,434 | 2025-2026- E8 A9 A9 E8 A9 9E E6 9C 97 E8 AA A6 E6 AF 94 E8 B3 BD E8 A6 8F E5 89 87 E5 8F 8A E8 A9 A9 E8 A9 9E-1 | 2025-2026-%E8%A9%A9%E8%A9%9E%E6%9C%97%E8%AA%A6%E6%AF%94%E8%B3%BD%E8%A6%8F%E5%89%87%E5%8F%8A%E8%A9%A9%E8%A9%9E-2 |
| `2025-2026-_E8_A9_A9_E8_A9_9E_E6_9C_97_E8_AA_A6_E6_AF_94_E8_B3_BD_E8_A6_8F_E5_89_87_E5_8F_8A_E8_A9_A9_E8_A9_9E.pdf` | 4,732,268 | 2025-2026- E8 A9 A9 E8 A9 9E E6 9C 97 E8 AA A6 E6 AF 94 E8 B3 BD E8 A6 8F E5 89 87 E5 8F 8A E8 A9 A9 E8 A9 9E | 2025-2026-%E8%A9%A9%E8%A9%9E%E6%9C%97%E8%AA%A6%E6%AF%94%E8%B3%BD%E8%A6%8F%E5%89%87%E5%8F%8A%E8%A9%A9%E8%A9%9E |
| `2025-2026_School_Calendar-03152026.pdf` | 634,143 | 2025-2026 School Calendar-03152026 | /, 2025-2026_school_calendar-03152026, ?oceanwp_library=sdca-header |
| `2025-26_SDCA__E4_BD_9C_E6_96_87_E6_AF_94_E8_B3_BD_E8_BE_A6_E6_B3_95.pdf` | 135,700 | 2025-26 SDCA  E4 BD 9C E6 96 87 E6 AF 94 E8 B3 BD E8 BE A6 E6 B3 95 | 2025-26_sdca_%E4%BD%9C%E6%96%87%E6%AF%94%E8%B3%BD%E8%BE%A6%E6%B3%95 |
| `2026-27_School_Calendar.pdf` | 590,908 | 2026-27 School Calendar | 2026-27_school_calendar |
| `2026-27_School_Calendar.pdf` | 590,908 | 2026-27 School Calendar | /, %E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1, %E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1, 2018/10/19/2018-19_week_07_announcement_chinese (+128) |
| `2026-Essay-Application.pdf` | 199,576 | 2026-Essay-Application | 2026-essay-application |
| `2026-HOC-Essay-English-Announcement.pdf` | 198,584 | 2026-HOC-Essay-English-Announcement | 2026-hoc-essay-english-announcement |
| `2026-_E4_B8_AD_E5_9C_8B_E9_A4_A8_E4_B8_AD_E6_96_87_E6_AF_94_E8_B3_BD_E9_80_9A_E7_9F_A5.pdf` | 174,676 | 2026- E4 B8 AD E5 9C 8B E9 A4 A8 E4 B8 AD E6 96 87 E6 AF 94 E8 B3 BD E9 80 9A E7 9F A5 | 2026-%E4%B8%AD%E5%9C%8B%E9%A4%A8%E4%B8%AD%E6%96%87%E6%AF%94%E8%B3%BD%E9%80%9A%E7%9F%A5 |
| `2026_2027_Classroom-Map.pdf` | 657,569 | 2026 2027 Classroom-Map | 2026_2027_classroom-map |
| `98255_2021_E6_96_B0_E6_98_A5_E5_89_B5_E6_84_8F_E6_B4_BB_E5_8B_95_E7_B0_A1_E7_AB_A0.pdf` | 180,019 | 98255 2021 E6 96 B0 E6 98 A5 E5 89 B5 E6 84 8F E6 B4 BB E5 8B 95 E7 B0 A1 E7 AB A0 | media |
| `Beginner-Class.pdf` | 482,735 | Beginner-Class | class-placement |
| `Class-Schedule.pdf` | 400,312 | Class-Schedule | /, %E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1, %E6%A0%A1%E9%95%B7%E7%9A%84%E8%A9%B1, 2018/10/19/2018-19_week_07_announcement_chinese (+128) |
| `Credit-Class.pdf` | 674,941 | Credit-Class | class-placement |
| `Credit_Student_Handbook.pdf` | 442,741 | Credit Student Handbook | handbook-and-policy |
| `Expense-Reimbursement-Request-Form.pdf` | 235,485 | Expense-Reimbursement-Request-Form | handbook-and-policy |
| `Policy-for-Guest-Students.pdf` | 308,940 | Policy-for-Guest-Students | handbook-and-policy |
| `Pre-K-Intro-2016.pdf` | 991,274 | Pre-K-Intro-2016 | 2018/10/22/pre-k-program, class-placement |
| `Registration_20Notice_20Chinese.pdf` | 1,028,459 | Registration 20Notice 20Chinese | /, ?oceanwp_library=sdca-header |
| `Registration_20Notice_20English.pdf` | 1,270,013 | Registration 20Notice 20English | /, ?oceanwp_library=sdca-header |
| `SDCA-Yearbook-Cover-Art-Contest-Guidelines-2025-2026.pdf` | 165,633 | SDCA-Yearbook-Cover-Art-Contest-Guidelines-2025-2026 | sdca-yearbook-cover-art-contest-guidelines-2025-2026 |
| `SDCAParentHandbook.pdf` | 193,258 | SDCAParentHandbook | handbook-and-policy |
| `Scrip-Program.pdf` | 289,774 | Scrip-Program | scrip |
| `Scrip_20Logos.pdf` | 1,191,547 | Scrip 20Logos | scrip |
| `Scrip_20Schedule.pdf` | 132,714 | Scrip 20Schedule | scrip |
| `Second-Semester-Late-Registration-Policy.pdf` | 781,310 | Second-Semester-Late-Registration-Policy | handbook-and-policy |
| `Student-Store-Schedule.pdf` | 325,373 | Student-Store-Schedule | student-store-schedule |
| `Transaction-History.pdf` | 505,039 | Transaction-History | scrip |
| `W01_news_Chn.pdf` | 411,784 | W01 news Chn | w01_news_chn-4 |
| `W01_news_Eng.pdf` | 554,964 | W01 news Eng | w01_news_eng-4 |
| `W02_news_Chn.pdf` | 328,615 | W02 news Chn | w02_news_chn-4 |
| `W02_news_Eng.pdf` | 521,371 | W02 news Eng | w02_news_eng-4 |
| `W03_news_Chn.pdf` | 319,827 | W03 news Chn | upcoming-event, w03_news_chn-4 |
| `W03_news_Eng.pdf` | 528,808 | W03 news Eng | upcoming-event, w03_news_eng-4 |
| `W04_news_Chn.pdf` | 263,598 | W04 news Chn | upcoming-event, w04_news_chn-4 |
| `W04_news_Eng.pdf` | 526,044 | W04 news Eng | upcoming-event, w04_news_eng-4 |
| `W12_news_Chn.pdf` | 421,493 | W12 news Chn | w12_news_chn-3 |
| `W12_news_Eng.pdf` | 396,567 | W12 news Eng | w12_news_eng-3 |
| `W13_news_Chn.pdf` | 362,159 | W13 news Chn | w13_news_chn-2 |
| `W13_news_Eng.pdf` | 372,526 | W13 news Eng | w13_news_eng-2 |
| `W14_news_Chn.pdf` | 248,097 | W14 news Chn | w14_news_chn-3 |
| `W14_news_Eng.pdf` | 268,204 | W14 news Eng | w14_news_eng-3 |
| `W15_news_Chn.pdf` | 241,205 | W15 news Chn | w15_news_chn-3 |
| `W15_news_Eng.pdf` | 264,871 | W15 news Eng | w15_news_eng-3 |
| `W16_news_Chn.pdf` | 232,502 | W16 news Chn | w16_news_chn-3 |
| `W16_news_Eng.pdf` | 257,482 | W16 news Eng | w16_news_eng-3 |
| `W17_news_Chn.pdf` | 225,448 | W17 news Chn | w17_news_chn-3 |
| `W17_news_Eng.pdf` | 269,824 | W17 news Eng | w17_news_eng-3 |
| `W18_news_Chn-1.pdf` | 231,193 | W18 news Chn-1 | w18_news_chn-4 |
| `W18_news_Chn.pdf` | 231,193 | W18 news Chn | w18_news_chn-3 |
| `W18_news_Eng-1.pdf` | 270,138 | W18 news Eng-1 | w18_news_eng-4 |
| `W18_news_Eng.pdf` | 270,138 | W18 news Eng | w18_news_eng-3 |
| `W19_news_Chn.pdf` | 236,053 | W19 news Chn | w19_news_chn-3 |
| `W19_news_Eng.pdf` | 274,306 | W19 news Eng | w19_news_eng-3 |
| `W20_news_Chn.pdf` | 386,496 | W20 news Chn | w20_news_chn-2 |
| `W20_news_Eng.pdf` | 342,044 | W20 news Eng | w20_news_eng-2 |
| `W21_news_Chn.pdf` | 434,730 | W21 news Chn | w21_news_chn-2 |
| `W21_news_Eng.pdf` | 409,762 | W21 news Eng | w21_news_eng-2 |
| `W22_news_Chn.pdf` | 400,671 | W22 news Chn | w22_news_chn-3 |
| `W22_news_Eng.pdf` | 370,851 | W22 news Eng | w22_news_eng-3 |
| `W23_news_Chn.pdf` | 401,042 | W23 news Chn | w23_news_chn-2 |
| `W23_news_Eng.pdf` | 380,093 | W23 news Eng | w23_news_eng-2 |
| `W24_news_Chn.pdf` | 342,520 | W24 news Chn | w24_news_chn-3 |
| `W24_news_Eng.pdf` | 526,356 | W24 news Eng | w24_news_eng-3 |
| `W25_news_Chn.pdf` | 280,196 | W25 news Chn | /, ?oceanwp_library=sdca-header, w25_news_chn-3 |
| `W25_news_Eng.pdf` | 559,552 | W25 news Eng | /, ?oceanwp_library=sdca-header, w25_news_eng-3 |
| `W26_news_Chn.pdf` | 329,021 | W26 news Chn | /, ?oceanwp_library=sdca-header, w26_news_chn-4 |
| `W26_news_Eng.pdf` | 559,087 | W26 news Eng | /, ?oceanwp_library=sdca-header, w26_news_eng-3 |
| `W27_news_Chn.pdf` | 331,714 | W27 news Chn | w27_news_chn-3 |
| `W27_news_Eng.pdf` | 560,478 | W27 news Eng | w27_news_eng-3 |
| `W28_news_Chn.pdf` | 307,330 | W28 news Chn | w28_news_chn-3 |
| `W28_news_Eng.pdf` | 521,453 | W28 news Eng | w28_news_eng-3 |
| `W29_news_Chn-1.pdf` | 182,545 | W29 news Chn-1 | w29_news_chn-5 |
| `W29_news_Chn-2.pdf` | 182,545 | W29 news Chn-2 | w29_news_chn-6 |
| `W29_news_Chn.pdf` | 182,545 | W29 news Chn | w29_news_chn-4 |
| `W29_news_Eng-1.pdf` | 503,061 | W29 news Eng-1 | w29_news_eng-5 |
| `W29_news_Eng.pdf` | 503,061 | W29 news Eng | w29_news_eng-4 |
| `_E5_90_89_E4_BB_96_E6_B5_B7_E5_A0_B1.pdf` | 764,095 | E5 90 89 E4 BB 96 E6 B5 B7 E5 A0 B1 | %E5%90%89%E4%BB%96%E6%B5%B7%E5%A0%B1 |
| `student_handbook.pdf` | 837,795 | student handbook | handbook-and-policy |

### Registration-portal PDFs (extra, not in assets.json)

- `reg_Online_Registration_User_Guide.pdf` — 1,511,214 bytes (from register.sandiegochineseschool.com)
- `reg_Registration_Notice_Chinese.pd.pdf` — 1,032,709 bytes (from register.sandiegochineseschool.com)
- `reg_SDCA_School_Portal_User_Manual.pdf` — 2,979,232 bytes (from register.sandiegochineseschool.com)
- `reg_notice.pdf` — 1,131,657 bytes (from register.sandiegochineseschool.com)

## 8. Duplicates / tiny / broken flags

- **Failed download (broken):** `IMG_3218.jpg` (`/wp-content/uploads/2025/12/IMG_3218.jpg`) — 0 bytes, no local file (assets.json entry exists). Re-download if needed.
- **Duplicate pair (4.7 MB each, byte-identical):** `2025-2026-詩詞朗誦比賽規則及詩詞.pdf` and `...-1.pdf` (4,732,268 vs 4,732,434 — near-identical poetry-recitation rules). Keep one.
- **No tiny/broken PDFs** (min 132,714 bytes). No 0-byte PDFs.
- **Hashed duplicates:** 57 image files listed in §6.