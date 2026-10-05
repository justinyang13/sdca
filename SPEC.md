# SDCA SPEC (San Diego Chinese Academy website rebuild)
## BRD
- Goal: replace https://sandiegochineseschool.com/ (WordPress) with a top-tier, clean, enterprise-grade site for San Diego Chinese Academy 聖地牙哥中華學苑, a non-profit Chinese language school (since 1988).
- Audience: parents, students, teachers, volunteers, donors; bilingual English / Traditional Chinese (繁體), Simplified optional.
- Must keep: all real classroom photos, the logo identity (may be modernized/redrawn but recognizably the same), every feature of the old site.
- Public GitHub repo justinyang13/sdca; release as new project "sdca".
- Rule: built entirely by local Qwen; Claude kicks off, architects, and quality-gates.
## FRD  (written after research, see research/)
## TRD  (written after research by Claude: architecture.md)
- Node app + SQLite (better-sqlite3 or node:sqlite), simple staff admin for news/events/classes.

## CONTENT PRESERVATION RULE (owner rule, 2026-10-05) — applies to EVERY phase and every future change
Presentation may be redesigned freely (layout, cards, galleries, typography), BUT for every old page its CONTENT AND ORDER MUST BE PRESERVED: all text (EN and ZH), all images/photos with their captions, all PDFs/links/embeds/forms, and the ORDER of sections/items as on the old page (e.g. the order of board members, staff, programs, announcements, sponsors, FAQs, list items, photo sequence). Nothing may be dropped, merged away, shortened or reordered. If something cannot be placed, add it to research/CONTENT-LEDGER.md under NEEDS OWNER REVIEW instead of silently omitting it. Every phase report must state how this rule was verified (content-audit + image-parity + order check). Add an ORDER CHECK to scripts/content-audit.js: for each old page, the sequence of its headings and of its content images/links must appear in the same relative order on the new page (report any inversions).
