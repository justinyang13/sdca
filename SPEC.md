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
