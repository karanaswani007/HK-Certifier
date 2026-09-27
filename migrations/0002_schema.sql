create table if not exists profiles (
  user_id text primary key,
  email text,
  name text not null default '',
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admins (
  user_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  type text not null default 'institute',
  official_email text,
  phone text,
  website text,
  address text,
  city text,
  state text,
  country text not null default 'India',
  contact_person text,
  logo_url text,
  description text,
  status text not null default 'PENDING_APPROVAL',
  rejection_reason text,
  brand_color text,
  custom_footer text,
  email_from_name text,
  email_reply_to text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists organizations_status_idx on organizations (status);

create table if not exists organization_members (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null,
  role text not null default 'ORGANIZATION_VIEWER',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on organization_members (user_id);

create table if not exists organization_approvals (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  actor_user_id text,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists subscription_plans (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  price_inr integer not null default 0,
  interval text not null default 'month',
  monthly_certificates integer not null default 25,
  monthly_emails integer not null default 25,
  max_students integer not null default 50,
  max_programs integer not null default 3,
  max_templates integer not null default 3,
  max_team_members integer not null default 2,
  storage_mb integer not null default 200,
  advanced_analytics boolean not null default false,
  ai_generation boolean not null default false,
  custom_branding boolean not null default false,
  bulk_operations boolean not null default true,
  api_access boolean not null default false,
  priority_support boolean not null default false,
  white_label boolean not null default false,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  plan_id text not null references subscription_plans(id),
  status text not null default 'ACTIVE',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_org_idx on subscriptions (organization_id);

create table if not exists usage_counters (
  organization_id text not null,
  period text not null,
  certificates integer not null default 0,
  emails integer not null default 0,
  reserved_certificates integer not null default 0,
  reserved_emails integer not null default 0,
  primary key (organization_id, period)
);

create table if not exists programs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  type text not null default 'Internship',
  description text,
  start_date date,
  end_date date,
  duration text,
  mentor_name text,
  location text,
  certificate_title text,
  skills text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists programs_org_idx on programs (organization_id);

create table if not exists student_field_defs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  key text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists students (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  program_id text references programs(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  student_code text,
  college text,
  course text,
  branch text,
  batch text,
  registration_number text,
  custom_fields text not null default '{}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_org_idx on students (organization_id);
create index if not exists students_email_idx on students (organization_id, email);
create index if not exists students_program_idx on students (program_id);

create table if not exists certificate_templates (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  layout_json text not null,
  is_default boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_org_idx on certificate_templates (organization_id);

create table if not exists certificate_template_versions (
  id text primary key,
  template_id text not null references certificate_templates(id) on delete cascade,
  version integer not null,
  layout_json text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists certificates (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  program_id text references programs(id) on delete set null,
  student_id text references students(id) on delete set null,
  template_id text references certificate_templates(id) on delete set null,
  public_id text not null unique,
  verification_token text not null unique,
  title text,
  student_name text not null,
  student_email text,
  organization_name text,
  program_name text,
  duration text,
  issue_date date,
  status text not null default 'VALID',
  layout_json text not null,
  qr_svg text,
  pdf_asset_id text,
  download_count integer not null default 0,
  view_count integer not null default 0,
  reissued_from_id text,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists certificates_org_idx on certificates (organization_id);
create index if not exists certificates_public_idx on certificates (public_id);
create index if not exists certificates_student_idx on certificates (student_id);

create table if not exists certificate_generation_jobs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  program_id text,
  template_id text,
  status text not null default 'QUEUED',
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists certificate_generation_items (
  id text primary key,
  job_id text not null references certificate_generation_jobs(id) on delete cascade,
  student_id text,
  certificate_id text,
  status text not null default 'QUEUED',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists generation_items_job_idx on certificate_generation_items (job_id, status);

create table if not exists email_jobs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  status text not null default 'QUEUED',
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_deliveries (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  job_id text,
  certificate_id text,
  to_email text not null,
  subject text not null,
  body_text text,
  status text not null default 'QUEUED',
  error text,
  provider text not null default 'log',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_deliveries_org_idx on email_deliveries (organization_id);

create table if not exists verification_events (
  id text primary key,
  certificate_id text,
  public_id text,
  result text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists verification_events_cert_idx on verification_events (public_id);

create table if not exists payment_requests (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  plan_id text not null references subscription_plans(id),
  order_ref text not null unique,
  amount_inr integer not null,
  status text not null default 'PENDING',
  utr text,
  payment_date date,
  screenshot_url text,
  note text,
  admin_note text,
  created_by text,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_requests_org_idx on payment_requests (organization_id);

create table if not exists payments (
  id text primary key,
  organization_id text not null,
  payment_request_id text,
  amount_inr integer not null,
  method text not null default 'QR_MANUAL',
  status text not null default 'SUCCESS',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  organization_id text,
  user_id text,
  action text not null,
  resource text,
  resource_id text,
  metadata text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_org_idx on audit_logs (organization_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  organization_id text,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists support_tickets (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  user_id text not null,
  subject text not null,
  category text not null default 'general',
  priority text not null default 'normal',
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_messages (
  id text primary key,
  ticket_id text not null references support_tickets(id) on delete cascade,
  user_id text not null,
  body text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists file_assets (
  id text primary key,
  organization_id text,
  kind text not null,
  filename text,
  mime text,
  byte_size integer,
  content_base64 text,
  created_at timestamptz not null default now()
);

create table if not exists ai_requests (
  id text primary key,
  organization_id text,
  user_id text,
  kind text not null,
  prompt text,
  result_json text,
  tokens integer,
  status text not null default 'SUCCESS',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text
);

create table if not exists system_settings (
  key text primary key,
  value text not null
);

create table if not exists team_invites (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'ORGANIZATION_EDITOR',
  token text not null unique,
  invited_by text,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

insert into subscription_plans (
  id, name, slug, description, price_inr, sort_order,
  monthly_certificates, monthly_emails, max_students, max_programs, max_templates, max_team_members, storage_mb,
  advanced_analytics, ai_generation, custom_branding, bulk_operations, api_access, priority_support, white_label
) values
  ('plan_free', 'Free', 'free', 'Issue a limited number of verified certificates each month.', 0, 0,
    25, 25, 50, 3, 3, 2, 200, false, false, false, true, false, false, false),
  ('plan_starter', 'Starter', 'starter', 'For institutes running regular internships and workshops.', 999, 1,
    250, 250, 500, 15, 10, 5, 2048, false, true, true, true, false, false, false),
  ('plan_professional', 'Professional', 'professional', 'Automation, analytics and higher volume for growing training teams.', 2999, 2,
    2000, 2000, 5000, 50, 40, 15, 10240, true, true, true, true, true, true, false),
  ('plan_business', 'Business', 'business', 'High volume issuing with priority support and white-label ready architecture.', 7999, 3,
    10000, 10000, 50000, 200, 100, 50, 51200, true, true, true, true, true, true, true)
on conflict (id) do nothing;

insert into feature_flags (key, enabled, description) values
  ('AI_TEMPLATE_GENERATOR', true, 'Natural-language certificate template generation'),
  ('BULK_EMAIL', true, 'Batch certificate email delivery'),
  ('ADVANCED_ANALYTICS', true, 'Advanced analytics charts'),
  ('CUSTOM_BRANDING', true, 'Organization branding on certificates and verification'),
  ('API_ACCESS', false, 'Public API access'),
  ('TEAM_MANAGEMENT', true, 'Invite organization team members'),
  ('WHITE_LABEL', false, 'Remove HK Certifier branding'),
  ('LINKEDIN_SHARING', true, 'LinkedIn share on public certificates')
on conflict (key) do nothing;

insert into system_settings (key, value) values
  ('platform_name', 'HK Certifier'),
  ('platform_tagline', 'Create. Deliver. Verify.'),
  ('support_email', 'hello@hksofttech.in'),
  ('payment_upi_id', 'hksofttech@upi'),
  ('payment_instructions', 'Pay the displayed amount using any UPI app. Enter the UTR / UPI reference after payment. HK SoftTech admin will activate your plan after verification.'),
  ('payment_account_name', 'HK SoftTech'),
  ('email_from_name', 'HK Certifier')
on conflict (key) do nothing;
