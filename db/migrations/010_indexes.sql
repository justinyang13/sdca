-- 010_indexes.sql — indexes for every foreign key that is joined or filtered on, plus the columns the lists, dashboards,
-- reports and the public site sort / filter by. (SQLite does not index foreign keys by itself.) Small look-up tables
-- (school_years, class_types, rooms, payment_methods …) are left out on purpose: a scan of a handful of rows is as fast.

-- people & families
CREATE INDEX IF NOT EXISTS idx_persons_address        ON persons(personal_address_id);
CREATE INDEX IF NOT EXISTS idx_families_address       ON families(address_id);
CREATE INDEX IF NOT EXISTS idx_families_email         ON families(email);
CREATE INDEX IF NOT EXISTS idx_parent_students_child  ON parent_students(student_person_id);
CREATE INDEX IF NOT EXISTS idx_invitations_family     ON invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user   ON password_resets(user_id);

-- roles & permissions
CREATE INDEX IF NOT EXISTS idx_user_roles_role        ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm  ON role_permissions(permission_id);

-- classes & staff assignments
CREATE INDEX IF NOT EXISTS idx_school_classes_type    ON school_classes(class_type_id);
CREATE INDEX IF NOT EXISTS idx_class_assign_year_role ON class_assignments(school_year_id, assignment_role_id);

-- registration & enrollment
CREATE INDEX IF NOT EXISTS idx_registrations_year_status ON registrations(school_year_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_status_sub  ON registrations(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_reg_items_student      ON registration_items(student_person_id);
CREATE INDEX IF NOT EXISTS idx_reg_items_ctype        ON registration_items(class_type_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_year_status ON enrollments(school_year_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollment_registration ON enrollments(registration_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_ctype       ON enrollments(class_type_id);
CREATE INDEX IF NOT EXISTS idx_student_school_year    ON student_school_info(school_year_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_enrollment ON withdrawals(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_waiver_acc_registration ON waiver_acceptances(registration_id);
CREATE INDEX IF NOT EXISTS idx_waiver_acc_family      ON waiver_acceptances(family_id);
CREATE INDEX IF NOT EXISTS idx_waiver_acc_person      ON waiver_acceptances(person_id);
CREATE INDEX IF NOT EXISTS idx_waiver_acc_document    ON waiver_acceptances(waiver_document_id);

-- money (paid amounts, daily deposit, year summary, scrip)
CREATE INDEX IF NOT EXISTS idx_transactions_registration ON transactions(registration_id);
CREATE INDEX IF NOT EXISTS idx_transactions_year_type    ON transactions(school_year_id, transaction_type_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date         ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_method       ON transactions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_transactions_person       ON transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type         ON transactions(transaction_type_id);
CREATE INDEX IF NOT EXISTS idx_tx_lines_transaction      ON transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_lines_product          ON transaction_lines(scrip_product_id);

-- volunteers
CREATE INDEX IF NOT EXISTS idx_vol_signups_year_job   ON volunteer_signups(school_year_id, job_id);
CREATE INDEX IF NOT EXISTS idx_vol_signups_year_status ON volunteer_signups(school_year_id, status);
CREATE INDEX IF NOT EXISTS idx_vol_signups_person     ON volunteer_signups(person_id);

-- audit / mail (viewing, retention)
CREATE INDEX IF NOT EXISTS idx_portal_audit_user      ON portal_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_audit_at        ON portal_audit(at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created   ON email_outbox(created_at);

-- public website
CREATE INDEX IF NOT EXISTS idx_announcements_document ON announcements(document_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pub      ON announcements(published, published_at);
CREATE INDEX IF NOT EXISTS idx_events_pub_start       ON events(published, starts_at);
CREATE INDEX IF NOT EXISTS idx_documents_pub_cat      ON documents(published, category);
