# Photo selection — Phase 2

Selection date: 2026-10-05 (re-verified 2026-10-05 by vision review of contact sheets).
Method: candidates from `research/wiki/assets.md §4` + `research/assets/images` listed at
≥1000 px via `sips`; contact sheets built with sips thumbnails + PIL; reviewed with the
vision model (view_image). Criteria: sharp, well lit, happy/engaged, no private info
(documents, IDs, flyers with contact details visible), no distress. Cropping/resizing only —
no faces generated or altered. Sources are the original files in `research/assets/images`
(never modified).

## Chosen (24) — processed by `scripts/process-images.js` into `public/img/`

| name (output base) | source file | role | why |
|---|---|---|---|
| classroom-bilingual | SDCA-Bilingual-Class-1-1.jpeg (2300x1188) | **home-hero** | brightest, sharpest real classroom; clean composition; used on class-placement page |
| teachers-2018 | 2018-2019-Teachers.jpg (4664x1988) | staff-group | official staff-page group photo |
| preschool-class | Pre-K-Program-5.jpeg | programs (preschool) | program page photo used on home |
| beginner-class | SDCA-Beginner-Class-1.jpeg | programs (beginner) | class-placement page |
| regular-class | SDCA-Regular-Class-Original.jpeg | programs (regular) | class-placement page |
| graduation-2023 | IMG_3544.jpg | events | graduation ceremony, sharp gowns |
| cultural-day | Cultural-Day-WJ-2.jpg | events | cultural day + poetry contest |
| lantern-performance | IMG_4189.jpg | events | stage performance with lanterns (dark stage bg acceptable for events) |
| anniversary-30th | SDCA-30th-Anniversary-5.jpg (2000x1333) | events | 30th anniversary, happy faces, sharp |
| spring-ceremony | IMG_5827.jpg (2359x1558) | events | spring ceremony group, well lit (source site's upcoming-event post) |
| stage-performance | IMG_5817-scaled.jpeg (2560x1920) | events | stage performance (source site's upcoming-event post) |
| yoga-class | Yoga-Class-1024x683.jpg | programs (adult/recreational) | recreational program page |
| teacher-meeting | SDCA-Teacher-Meeting-2-1024x648.jpg | staff | staff page photo |
| community-gathering | IMG_2885-scaled.jpg | media gallery | families preparing food |
| gallery-community-outdoor | IMG_2892-scaled.jpg (2560x1920) | media gallery | sunny outdoor group, best of sheet 2 |
| field-trip | IMG_5351-scaled.jpeg | media gallery | outdoor field trip |
| poetry-award | Credit-Class-Poetry-Recitation.jpeg | media gallery | contest award moment |
| contest-trophies | IMG_4215-scaled.jpeg | media gallery | finalists + trophies |
| cultural-food | Credit-Class-Food-Activity.jpeg | media gallery | adult class food activity |
| teacher-dinner | SDCA-Teacher-Appreciation-Dinner.jpg | media gallery | 謝師宴 |
| karaoke-contest | SDCA-Karaoke-Contest.jpg | media gallery | singing contest |
| tai-chi | IMG_4686-225x300.jpg | media gallery | tai chi (low-res source; 225 px set only — kept for variety, not hero) |
| students-perform | IMG_4188.jpg | media gallery | red costumes on stage |
| food-fair | IMG_4190.jpg | media gallery | food fair crowd |

Notes:
- `teacher-dinner` (400x535) and `tai-chi` (225x300) sources are smaller than 1000 px;
  they are **gallery-only** and never used as hero. Hero and program images all have
  ≥1000 px sources.
- Roles `programs-*` cover preschool/beginner/regular (+ yoga for recreational) — the three
  required program cards plus adult program.

## Rejected (sheet 2 review, 2026-10-05)
- SDCA-Fundamental-Class-Regular.jpeg — motion blur
- Textbook-Pickup-Day.jpg — flyers/text (possible names) visible
- Dinner-scaled.jpg — flyer with address/phone/date prominent
- IMG_4108-scaled.jpeg — motion blur (lion dance)
- SDCA-2017-2018-Graduates.jpeg, SDCA-Chinese-Typing.jpeg — usable but weaker than chosen set
- All `*150x150*` headshot thumbnails — too small (150 px) for web cards; see headshots note

## Board/staff headshots
The source site crops board photos into 150x150 thumbnails (e.g. `SDCA-BOD-page-*-150x150`,
`Ana-150x150.jpg`, `kathy-150x150.jpg`, `vegafish-2022-profile_2048x2048-1-150x150.png`).
Full-size group shots: `BOD.jpg` (2048x1442) and `2018-2019-Teachers.jpg` (used as
staff-group above). **Decision:** use the 150 px originals as-is for board cards (real
people, keep originals per ARCHITECTURE §3), or the group shots; do NOT upscale. Board
individual name→photo mapping will be done in Phase 3 (seed `people`) from the
board-of-directors page, where names sit next to these crops.
