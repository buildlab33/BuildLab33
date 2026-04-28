-- =============================================================================
-- COP Platform — Initial Schema
-- Run this in the Supabase SQL Editor to create all core tables.
-- =============================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------
create table if not exists users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    name text not null,
    password_hash text not null,
    role text not null default 'user' check (role in ('super_admin','admin','user','guest')),
    theme text not null default 'midnight',
    archived boolean not null default false,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on users(email);
create index if not exists idx_users_role on users(role);

-- -----------------------------------------------------------------------------
-- BRANDS  (mirrors the JSON config; supports add/archive from the UI later)
-- -----------------------------------------------------------------------------
create table if not exists brands (
    id text primary key,                    -- e.g. 'yeon-studios'
    name text not null,
    industry text,
    config jsonb not null default '{}'::jsonb,
    archived boolean not null default false,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- USER ↔ BRAND access
-- -----------------------------------------------------------------------------
create table if not exists user_brands (
    user_id uuid references users(id) on delete cascade,
    brand_id text references brands(id) on delete cascade,
    primary key (user_id, brand_id)
);

-- -----------------------------------------------------------------------------
-- POSTS  (drafts → pending → approved → scheduled → published)
-- -----------------------------------------------------------------------------
create table if not exists posts (
    id uuid primary key default uuid_generate_v4(),
    brand_id text references brands(id) on delete restrict,
    platform text not null check (platform in ('instagram','linkedin','tiktok','youtube','facebook','x')),
    content_format text,
    campaign_goal text,
    audience text,
    growth_angle text,
    text text not null,
    status text not null default 'draft' check (status in ('draft','pending','approved','scheduled','published','removed')),
    scheduled_at timestamptz,
    published_at timestamptz,
    engagement jsonb default '{}'::jsonb,
    created_by uuid references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_posts_brand_status on posts(brand_id, status);
create index if not exists idx_posts_scheduled_at on posts(scheduled_at);
create index if not exists idx_posts_created_by on posts(created_by);

-- -----------------------------------------------------------------------------
-- POST VERSIONS  (every edit saved — restore any previous version)
-- -----------------------------------------------------------------------------
create table if not exists post_versions (
    id uuid primary key default uuid_generate_v4(),
    post_id uuid references posts(id) on delete cascade,
    text text not null,
    version_number integer not null,
    created_by uuid references users(id),
    created_at timestamptz not null default now()
);

create index if not exists idx_post_versions_post on post_versions(post_id, version_number desc);

-- -----------------------------------------------------------------------------
-- LEADS  (companies + contacts)
-- -----------------------------------------------------------------------------
create table if not exists leads (
    id uuid primary key default uuid_generate_v4(),
    brand_id text references brands(id) on delete restrict,
    company text not null,
    contact_name text,
    contact_title text,
    email text,
    linkedin_url text,
    industry text,
    location text,
    company_size text,
    score integer check (score between 0 and 10),
    status text not null default 'found' check (status in ('found','enriched','message_drafted','approved','contacted','replied','meeting_booked','closed','not_interested')),
    source text check (source in ('news','criteria','linkedin','manual')),
    duplicate_flag boolean not null default false,
    enriched_at timestamptz,
    created_by uuid references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_leads_brand_status on leads(brand_id, status);
create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_company on leads(company);

-- -----------------------------------------------------------------------------
-- OUTREACH MESSAGES
-- -----------------------------------------------------------------------------
create table if not exists outreach (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references leads(id) on delete cascade,
    brand_id text references brands(id) on delete restrict,
    channel text not null check (channel in ('email','linkedin_dm','linkedin_connect','manual')),
    sequence_step integer,
    subject text,
    body text not null,
    status text not null default 'draft' check (status in ('draft','approved','sent','replied','bounced','failed')),
    sent_at timestamptz,
    replied_at timestamptz,
    created_by uuid references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_outreach_lead on outreach(lead_id);
create index if not exists idx_outreach_brand_status on outreach(brand_id, status);

-- -----------------------------------------------------------------------------
-- SEQUENCES  (campaign-level outreach plans)
-- -----------------------------------------------------------------------------
create table if not exists sequences (
    id uuid primary key default uuid_generate_v4(),
    brand_id text references brands(id) on delete restrict,
    name text not null,
    description text,
    steps jsonb not null default '[]'::jsonb,
    end_action text default 'dormant' check (end_action in ('dormant','cold','nurturing','reenter')),
    is_template boolean not null default false,
    is_default boolean not null default false,
    created_by uuid references users(id),
    created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- NEWS ITEMS  (cached results from NewsAPI)
-- -----------------------------------------------------------------------------
create table if not exists news_items (
    id uuid primary key default uuid_generate_v4(),
    brand_id text references brands(id) on delete cascade,
    title text not null,
    url text not null,
    source text,
    published_at timestamptz,
    snippet text,
    keywords text[],
    created_at timestamptz not null default now()
);

create unique index if not exists ux_news_brand_url on news_items(brand_id, url);
create index if not exists idx_news_brand_published on news_items(brand_id, published_at desc);

-- -----------------------------------------------------------------------------
-- AUDIT LOG  (read-only, no role can delete)
-- -----------------------------------------------------------------------------
create table if not exists audit_log (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references users(id) on delete set null,
    brand_id text references brands(id) on delete set null,
    action text not null,
    detail text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_user on audit_log(user_id, created_at desc);
create index if not exists idx_audit_brand on audit_log(brand_id, created_at desc);

-- =============================================================================
-- SEED DATA — Brands
-- =============================================================================
insert into brands (id, name, industry) values
    ('yeon-studios', 'Yeon Studios', 'Media-tech and OTT infrastructure'),
    ('belive-studios', 'BeLive Studios', 'Digital content production, IP creation, microdrama')
on conflict (id) do update set
    name = excluded.name,
    industry = excluded.industry,
    updated_at = now();

-- =============================================================================
-- updated_at TRIGGER  (keeps updated_at fresh on UPDATE)
-- =============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
declare
    t text;
begin
    for t in select unnest(array['users','brands','posts','leads','outreach']) loop
        execute format('drop trigger if exists trg_%I_updated on %I', t, t);
        execute format('create trigger trg_%I_updated before update on %I for each row execute function set_updated_at()', t, t);
    end loop;
end$$;
