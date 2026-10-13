-- 007_portal.sql — SDCA Portal (families, people, classes, registration, finance, volunteers, roles & permissions).
-- Every table: id + created_at/updated_at/created_by/updated_by + deleted_at (soft delete). Money = integer cents.
-- (The website's own `people` table is unrelated; portal humans live in `persons`.)

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  mailing_street TEXT NOT NULL DEFAULT '',
  mailing_city TEXT NOT NULL DEFAULT '',
  mailing_state TEXT NOT NULL DEFAULT 'CA',
  mailing_zip TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS school_years (
  id INTEGER PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  label TEXT NOT NULL UNIQUE,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  registration_open INTEGER NOT NULL DEFAULT 0,
  early_reg_deadline TEXT,
  first_day TEXT,
  last_day TEXT,
  second_semester_start TEXT,
  placement_visible_days_before INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY,
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'CA',
  zipcode TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'US',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY,
  english_last_name TEXT NOT NULL,
  english_first_name TEXT NOT NULL,
  chinese_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'M' CHECK (gender IN ('M','F')),
  birth_date TEXT,
  native_language TEXT NOT NULL DEFAULT 'Mandarin',
  email TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  regular_school TEXT NOT NULL DEFAULT '',
  regular_grade INTEGER,
  allergy TEXT NOT NULL DEFAULT '',
  special_medical_needs TEXT NOT NULL DEFAULT '',
  speak_chinese_home TEXT NOT NULL DEFAULT 'N',
  took_chinese_lessons TEXT NOT NULL DEFAULT 'N',
  prior_chinese_school TEXT NOT NULL DEFAULT '',
  prior_chinese_years INTEGER,
  prior_chinese_hours_week INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  personal_address_id INTEGER REFERENCES addresses(id),
  photo_consent INTEGER NOT NULL DEFAULT 1,
  is_faculty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(english_last_name, english_first_name);
CREATE INDEX IF NOT EXISTS idx_persons_zh ON persons(chinese_name);

CREATE TABLE IF NOT EXISTS user_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  landing_route TEXT NOT NULL DEFAULT '/portal',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_staff INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  permission_id INTEGER NOT NULL REFERENCES permissions(id),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','own_family','own_classes','own_record')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permission ON role_permissions(role_id, permission_id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  user_type_id INTEGER REFERENCES user_types(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','pending','disabled')),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  last_login_at TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_person ON users(person_id);

CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  school_year_id INTEGER REFERENCES school_years(id),
  school_class_id INTEGER REFERENCES school_classes(id),
  starts_on TEXT,
  ends_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY,
  address_id INTEGER REFERENCES addresses(id),
  home_phone TEXT NOT NULL DEFAULT '',
  cell_phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  list_in_directory TEXT NOT NULL DEFAULT 'Y' CHECK (list_in_directory IN ('Y','N')),
  emergency_contact TEXT NOT NULL DEFAULT '',
  emergency_home_phone TEXT NOT NULL DEFAULT '',
  emergency_cell_phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS family_members (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  relationship TEXT NOT NULL CHECK (relationship IN ('parent_one','parent_two','guardian','child')),
  is_primary_contact INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_member ON family_members(family_id, person_id);
CREATE INDEX IF NOT EXISTS idx_family_members_person ON family_members(person_id);

CREATE TABLE IF NOT EXISTS parent_students (
  id INTEGER PRIMARY KEY,
  parent_person_id INTEGER NOT NULL REFERENCES persons(id),
  student_person_id INTEGER NOT NULL REFERENCES persons(id),
  relationship TEXT NOT NULL DEFAULT 'parent',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_student ON parent_students(parent_person_id, student_person_id);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  email TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS class_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  is_credit INTEGER NOT NULL DEFAULT 0,
  weeks INTEGER NOT NULL DEFAULT 30,
  meets_start TEXT NOT NULL DEFAULT '13:30',
  meets_end TEXT NOT NULL DEFAULT '16:30',
  books_included INTEGER NOT NULL DEFAULT 1,
  min_age INTEGER,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS class_levels (
  id INTEGER PRIMARY KEY,
  class_type_id INTEGER NOT NULL REFERENCES class_types(id),
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  grade_label TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_level ON class_levels(class_type_id, code);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  building TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS textbooks (
  id INTEGER PRIMARY KEY,
  title_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS school_classes (
  id INTEGER PRIMARY KEY,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  class_type_id INTEGER NOT NULL REFERENCES class_types(id),
  class_level_id INTEGER REFERENCES class_levels(id),
  code TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  room_id INTEGER REFERENCES rooms(id),
  textbook_id INTEGER REFERENCES textbooks(id),
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_class_code ON school_classes(school_year_id, code);

CREATE TABLE IF NOT EXISTS assignment_roles (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS class_assignments (
  id INTEGER PRIMARY KEY,
  school_class_id INTEGER NOT NULL REFERENCES school_classes(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  assignment_role_id INTEGER NOT NULL REFERENCES assignment_roles(id),
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_class_assign_class ON class_assignments(school_class_id);
CREATE INDEX IF NOT EXISTS idx_class_assign_person ON class_assignments(person_id);

CREATE TABLE IF NOT EXISTS student_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  registered_by_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','paid','cancelled')),
  scrip_purchase_cents INTEGER NOT NULL DEFAULT 0,
  scrip_deposit_cents INTEGER NOT NULL DEFAULT 0,
  service_fee_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  grand_total_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  waiver_accepted_at TEXT,
  form_printed_at TEXT,
  submitted_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_registrations_family ON registrations(family_id, school_year_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY,
  student_person_id INTEGER NOT NULL REFERENCES persons(id),
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  school_class_id INTEGER REFERENCES school_classes(id),
  class_type_id INTEGER REFERENCES class_types(id),
  class_level_id INTEGER REFERENCES class_levels(id),
  grade_label TEXT NOT NULL DEFAULT '',
  student_type_id INTEGER REFERENCES student_types(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','registered','placed','withdrawn')),
  placed_at TEXT,
  registration_id INTEGER REFERENCES registrations(id),
  withdrawn_at TEXT,
  withdrawal_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment ON enrollments(student_person_id, school_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class ON enrollments(school_class_id);

CREATE TABLE IF NOT EXISTS registration_items (
  id INTEGER PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES registrations(id),
  student_person_id INTEGER NOT NULL REFERENCES persons(id),
  class_type_id INTEGER NOT NULL REFERENCES class_types(id),
  grade_label TEXT NOT NULL DEFAULT '',
  birth_date_snapshot TEXT,
  registration_fee_cents INTEGER NOT NULL DEFAULT 0,
  early_reg_discount_cents INTEGER NOT NULL DEFAULT 0,
  tuition_cents INTEGER NOT NULL DEFAULT 0,
  misc_fee_cents INTEGER NOT NULL DEFAULT 0,
  sibling_discount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reg_items_reg ON registration_items(registration_id);

CREATE TABLE IF NOT EXISTS school_districts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS student_school_info (
  id INTEGER PRIMARY KEY,
  student_person_id INTEGER NOT NULL REFERENCES persons(id),
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  school_name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  mailing_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CA',
  zipcode TEXT NOT NULL,
  counselor_name TEXT NOT NULL,
  counselor_phone TEXT NOT NULL DEFAULT '',
  counselor_extension TEXT NOT NULL DEFAULT '',
  school_district_id INTEGER REFERENCES school_districts(id),
  other_school_district TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_school ON student_school_info(student_person_id, school_year_id);

CREATE TABLE IF NOT EXISTS credit_grades (
  id INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  term TEXT NOT NULL DEFAULT 'S1',
  course_name TEXT NOT NULL DEFAULT '',
  letter_grade TEXT NOT NULL DEFAULT '',
  percent REAL,
  credits REAL NOT NULL DEFAULT 0.5,
  teacher_comment TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_grades_enrollment ON credit_grades(enrollment_id);

CREATE TABLE IF NOT EXISTS fee_schedules (
  id INTEGER PRIMARY KEY,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'student' CHECK (applies_to IN ('student','family')),
  class_type_id INTEGER REFERENCES class_types(id),
  percent REAL,
  from_nth_child INTEGER,
  deadline TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_code ON fee_schedules(school_year_id, code, IFNULL(class_type_id,0));

CREATE TABLE IF NOT EXISTS transaction_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'in' CHECK (direction IN ('in','out')),
  is_registration INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  needs_check_number INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS scrip_products (
  id INTEGER PRIMARY KEY,
  vendor TEXT NOT NULL,
  name TEXT NOT NULL,
  denomination_cents INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  person_id INTEGER REFERENCES persons(id),
  registration_id INTEGER REFERENCES registrations(id),
  school_year_id INTEGER REFERENCES school_years(id),
  transaction_type_id INTEGER NOT NULL REFERENCES transaction_types(id),
  transaction_date TEXT NOT NULL,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
  check_number TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  executed_by_person_id INTEGER REFERENCES persons(id),
  recorded_by_user_id INTEGER REFERENCES users(id),
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  void_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_transactions_family ON transactions(family_id, transaction_date);

CREATE TABLE IF NOT EXISTS transaction_lines (
  id INTEGER PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  description TEXT NOT NULL,
  scrip_product_id INTEGER REFERENCES scrip_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS withdrawal_fee_rules (
  id INTEGER PRIMARY KEY,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  label_en TEXT NOT NULL,
  label_zh TEXT NOT NULL DEFAULT '',
  from_date TEXT,
  to_date TEXT,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  no_refund INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  applied_on TEXT NOT NULL,
  processing_fee_cents INTEGER NOT NULL DEFAULT 0,
  refund_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS volunteer_jobs (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  reserved_for_preschool INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS volunteer_signups (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  school_year_id INTEGER NOT NULL REFERENCES school_years(id),
  job_id INTEGER REFERENCES volunteer_jobs(id),
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  signed_up_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','assigned','completed','declined')),
  assigned_job_id INTEGER REFERENCES volunteer_jobs(id),
  hours_completed REAL NOT NULL DEFAULT 0,
  service_fee_refunded_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vol_signups_family ON volunteer_signups(family_id, school_year_id);

CREATE TABLE IF NOT EXISTS waiver_documents (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL DEFAULT '',
  effective_from TEXT,
  applies_under_age INTEGER,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_waiver ON waiver_documents(code, version);

CREATE TABLE IF NOT EXISTS waiver_acceptances (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id),
  family_id INTEGER REFERENCES families(id),
  registration_id INTEGER REFERENCES registrations(id),
  waiver_document_id INTEGER NOT NULL REFERENCES waiver_documents(id),
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY,
  to_email TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('queued','sent','failed','logged')),
  related_type TEXT NOT NULL DEFAULT '',
  related_id INTEGER,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS portal_audit (
  id INTEGER PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id INTEGER,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  user_id INTEGER,
  ip TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_portal_audit_row ON portal_audit(table_name, row_id);
