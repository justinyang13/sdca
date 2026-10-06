# DP Parity report

Base: http://localhost:3100 · Generated: 2026-10-06T04:51:35.766Z

| Page | Route | Text EN | Text ZH | Order inv | Images | Links missing | Layout |
|---|---|---|---|---|---|---|---|
| about | /about | 100.0% | 100.0% | 0/0 | 12/12 | 0 | ok |
| about-board | /about/board | 100.0% | 100.0% | 0/0 | 25/26 | 0 | ok |
| about-staff | /about/staff | 100.0% | 100.0% | 0/0 | 3/3 | 0 | ok |
| about-principal | /about/principal | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| programs-classes | /programs/classes | 100.0% | 100.0% | 0/0 | 6/6 | 0 | ok |
| programs-tcml | /programs/tcml | 100.0% | 100.0% | 0/0 | 9/9 | 0 | ok |
| programs-ta | /programs/ta | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| programs-recreational | /programs/recreational | 100.0% | 100.0% | 0/0 | 5/5 | 0 | ok |
| parents-volunteer | /parents/volunteer | 75.0% | 75.0% | 0/0 | 10/10 | 0 | DIFF |
| parents-handbook | /parents/handbook | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| parents-scrip | /parents/scrip | 100.0% | 100.0% | 0/0 | 5/5 | 0 | ok |
| support-sponsors | /support/sponsors | 100.0% | 100.0% | 0/0 | 9/9 | 0 | ok |
| education-resource | /education-resource | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| disclaimer | /disclaimer | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| privacy | /privacy | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| enroll | /enroll | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| contact | /contact | 25.0% | 25.0% | 0/0 | 0/0 | 0 | ok |
| adult | /adult | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| student-store-schedule | /student-store-schedule | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| classroom-map | /classroom-map | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| guitar-poster | /guitar-poster | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| pre-k-program | /pre-k-program | 100.0% | 100.0% | 0/0 | 0/0 | 0 | ok |
| new-student-ads | /new-student-ads | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |
| yearbook-contest | /yearbook-contest | 100.0% | 100.0% | 0/0 | 1/1 | 0 | ok |

## Exceptions (documented, owner-visible)

- programs-tcml [image]: img3218
- programs-tcml [link]: img3218
- programs-tcml [link]: img9001
- programs-tcml [link]: img9002
- programs-tcml [link]: img9003
- guitar-poster [link]: null
- parents-volunteer [link]: volunteerjobdescriptions
- support-sponsors [link]: donationform
- support-sponsors [link]: dr.-liu-ad-half-page
- about-board [link]: peggy-han
- about-board [image]: bod1024x721
- enroll [link]: register.sandiegochineseschool.com/public/upload
- contact [text]: null
- parents-scrip [link]: scriporderform

## Method

Old main text = `<main>` (or `.entry-content` when present, which excludes spam comments and related-posts) from research/raw/pages/*.html, tags stripped. Units = CJK-aware clauses (≥6 CJK chars) / Latin sentences (≥25 chars), NFKC + case/punct normalised, matched in order against the rendered page text.
Images compare by URL basename with WordPress -WxH size suffix stripped. Links compare by host+path (old absolute URLs) vs rendered hrefs (`/pdf/:slug` counts for old PDF URLs when the slug resolves the same file — see mismatches below).
