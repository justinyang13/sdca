# SDCA Portal — data model (SQLite) — DRAFT for review

**Conventions (every table):** `id INTEGER PRIMARY KEY`, `created_at`, `updated_at` (ISO UTC), `created_by`, `updated_by` (→ users.id), `deleted_at` (soft delete, NULL = active). Money in integer cents. Names stored as the old portal does: English last/first + Chinese name. Tables below omit these seven columns.
Prefix `p_` is NOT used; the portal tables live in the same DB as the website (`data/sdca.db`) next to `pages`, `slides`, etc.

## A. Identity, roles, permissions
| Table | Key columns |
|---|---|
| **schools** | name_en, name_zh, tax_id, mailing_address, phone, email, website, logo (one row today; keeps the model multi-school ready) |
| **school_years** | school_id, label (2026-2027), start_date, end_date, is_current, registration_open, early_reg_deadline, first_day, last_day |
| **people** | english_last_name*, english_first_name*, chinese_name, title, gender* (M/F), birth_date*, native_language, regular_school, regular_grade, allergy, special_medical_needs, speak_chinese_home (Y/N), took_chinese_lessons (Y/N), prior_chinese_school, prior_chinese_years, prior_chinese_hours_week, notes, personal_address_id, photo_consent |
| **addresses** | street*, city*, state, zipcode*, country |
| **users** | person_id, username (unique), password_hash (scrypt), user_type (staff/volunteer/parent/room_parent/student — primary landing), status (active/locked/pending), preferred_language (en/zh), last_login_at, failed_attempts, must_change_password |
| **user_types** | code, name_en, name_zh, landing_route (lookup) |
| **roles** | code (admin, principal, secretary, registrar, teacher, accountant, pta_coordinator, room_parent, volunteer, parent, student), name_en, name_zh, is_staff, is_system |
| **permissions** | code (`people.list`, `people.create`, `finance.void`…), resource, action, description |
| **role_permissions** | role_id, permission_id (+ `scope`: all / own_family / own_classes) |
| **user_roles** | user_id, role_id, school_year_id (NULL = every year), school_class_id (for teacher/room-parent scope), starts_on, ends_on |
| **invitations** | family_id, email, token_hash, expires_at (72 h), used_at |
| **password_resets** | user_id, token_hash, expires_at (6 h), used_at, verified_by_phone |
| **sessions** (exists) / **audit_log** | table_name, row_id, action, before_json, after_json, user_id, ip, at |

## B. Families and relationships
| Table | Key columns |
|---|---|
| **families** | address_id*, home_phone*, cell_phone, email*, list_in_directory (Y/N), emergency_contact*, emergency_home_phone*, emergency_cell_phone*, status, notes |
| **family_members** | family_id, person_id, relationship (parent_one / parent_two / guardian / child), is_primary_contact, sort — one family → many children, one child → one or two parents (the old "Parent One / Parent Two / Children") |
| **person_relationships** | parent_person_id, student_person_id, relationship (mother/father/guardian) — explicit ParentStudent 1→N |

## C. Academics
| Table | Key columns |
|---|---|
| **class_types** | code (preschool / regular / bilingual / credit / adult), name_en, name_zh ("普通(注音)班", "雙語(拼音)班", "學分班"), is_credit, default_weeks, meets_start_time, meets_end_time, default_tuition_cents, books_included |
| **class_levels** | class_type_id, code, name_en, name_zh (e.g. 學前, K, 1…9, Credit 1–4), grade_label (八年級(8th Grade)), sort — the "different levels of non-credit classes" |
| **rooms** | code (MS213), building, capacity, notes |
| **textbooks** | title_en, title_zh (美洲華語第四冊), level, publisher, price_cents |
| **school_classes** | school_year_id, class_type_id, class_level_id, code (PA, CSLKA, CSL1A, 五甲), name_zh (學分二甲), name_en (Credit 2A), room_id, textbook_id, capacity, min_age, status |
| **class_assignments** | school_class_id, person_id, assignment_role_id, school_year_id, start_date, end_date — covers instructors AND room parents |
| **assignment_roles** | code (primary_instructor, assistant_instructor, teaching_assistant, substitute, room_parent), name_en, name_zh |
| **student_types** | code (new / returning / credit / preschool / adult …) |
| **enrollments** | student_person_id, school_year_id, school_class_id, class_type_id, class_level_id, grade_label, student_type_id, status (pending/registered/placed/withdrawn), placed_at (分班日期), registration_id, withdrawn_at, withdrawal_reason |
| **student_school_info** (credit) | student_person_id, school_year_id, school_name*, grade*, mailing_address*, city*, state*, zipcode*, counselor_name*, counselor_phone, counselor_extension, school_district_id*, other_school_district, notes |
| **school_districts** | name (Poway Unified, …) |
| **attendance** *(recommended)* | school_class_id, student_person_id, session_date, status |

## D. Registration and money
| Table | Key columns |
|---|---|
| **registrations** | family_id, school_year_id, registered_by_user_id, status (draft/submitted/paid/cancelled), waiver_acceptance_id, early_reg_discount_cents, scrip_purchase_cents, scrip_deposit_cents, service_fee_cents, subtotal_cents, grand_total_cents, note, form_printed_at, submitted_at, paid_at |
| **registration_items** | registration_id, student_person_id, class_type_id, grade_label, birth_date_snapshot, registration_fee_cents, tuition_cents, misc_fee_cents, sibling_discount_cents, faculty_discount_cents |
| **fee_schedules** | school_year_id, code (registration_fee, tuition_regular, tuition_credit, misc, service_fee…), name_en, name_zh, amount_cents, applies_to (student/family), rule_json (sibling-from-3rd, early-reg deadline, faculty %) |
| **transaction_types** | code (registration, service_refund, scrip_purchase, scrip_redeem, scrip_refund, withdrawal, adjustment), name_en, name_zh, direction (in/out) |
| **payment_methods** | code (check, cash, scrip, other), name_en, name_zh (no card — per school policy) |
| **transactions** | family_id, person_id (student/parent the entry is for), registration_id, transaction_type_id, transaction_date, payment_method_id, check_number, amount_cents, note, executed_by_person_id ("executed by"), recorded_by_user_id ("recorded by … at"), voided_at, voided_by, void_reason |
| **transaction_lines** | transaction_id, description ("IN-N-OUT burger ($10)"), scrip_product_id, quantity, unit_cents, amount_cents |
| **scrip_products** | vendor, denomination_cents, name, active |
| **withdrawals** | enrollment_id, applied_on, processing_fee_cents, refund_cents, status, form_document_id |
| **withdrawal_fee_rules** | school_year_id, from_date, to_date, fee_cents, no_refund |
| **receipts** | transaction_id, number, printed_at (tax-ID text comes from schools) |

## E. Volunteers, waivers, communication
| Table | Key columns |
|---|---|
| **volunteer_jobs** | name_en, name_zh, description_en, description_zh, reserved_for_preschool, sort, active (15 jobs seeded) |
| **volunteer_signups** | family_id, person_id (parent), school_year_id, job_id, priority (1–3), signed_up_at, status (requested/assigned/completed/declined — "I cannot volunteer"), assigned_job_id, hours_completed, service_fee_refunded_at |
| **waiver_documents** | code (consent_release, media_release, under5), version, body_en, body_zh, effective_from |
| **waiver_acceptances** | person_id, family_id, registration_id, waiver_document_id, accepted_at, ip |
| **email_outbox** | to_email, template, subject, body, status (queued/sent/failed/logged), related_type, related_id, sent_at |
| **announcements_targets** *(recommended)* | announcement_id, school_class_id / role_id |
| **documents / uploads** | owner_type, owner_id, kind, file_path (withdrawal forms, adoption proof) |
| **settings** (exists) | tax_id text, fee notes, email templates |

## F. Relationships (summary)
```
schools 1─* school_years 1─* school_classes *─1 class_types, class_levels, rooms, textbooks
users *─1 people;  users *─* roles (user_roles, scoped by year/class);  roles *─* permissions
families 1─* family_members *─1 people ;  families *─1 addresses ; people *─0..1 addresses
people(student) 1─* enrollments *─1 school_classes ;  enrollments *─1 registrations 1─* registration_items
families 1─* registrations 1─* transactions 1─* transaction_lines
people 1─* class_assignments *─1 school_classes (instructors, TAs, room parents)
families 1─* volunteer_signups *─1 volunteer_jobs ;  registrations *─1 waiver_acceptances *─1 waiver_documents
```

## G. Permission model (enforced server-side on every route)
Resources × actions: `list / view / create / update / delete / export` for: people, families, students, enrollments, classes, class_types, class_levels, rooms, textbooks, school_years, registrations, transactions, fee_schedules, volunteer_jobs, volunteer_signups, assignments, waivers, reports, announcements, users; plus special: `registration.register_own_family`, `finance.record_payment`, `finance.void`, `roles.manage` (**Admin only**), `audit.view`, `settings.manage`.
Scopes: `all`, `own_family` (parent), `own_classes` (teacher / room parent), `own_record` (student).
Default roles → admin: everything; principal: view all + export + assignments; secretary/registrar: people/families/enrollments/registrations CRUD + exports + payment entry; accountant: transactions + fee_schedules + receipts; teacher: own class list + attendance; pta_coordinator: volunteer_jobs/signups CRUD + export; room_parent: own class list; parent: own family + register + volunteer + own transactions; volunteer: own sign-ups; student: own record.
