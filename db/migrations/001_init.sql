-- Passo Shopping catalogue. Kept apart from the Passo client knowledge base.

create table if not exists merchants (
  id serial primary key,
  domain text not null unique,
  name text not null,
  network text not null,
  network_merchant_id text,
  delivers_to text[] not null default '{GB}',
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  is_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id bigserial primary key,
  gtin text unique,
  brand text,
  brand_key text,
  mpn_key text,
  title text not null,
  category text,
  category_slug text,
  image_url text,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('english', title), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_search_idx on products using gin (search);
create index if not exists products_category_idx on products (category_slug);
create index if not exists products_brand_mpn_idx on products (brand_key, mpn_key) where gtin is null;

create table if not exists offers (
  id bigserial primary key,
  merchant_id integer not null references merchants (id),
  product_id bigint not null references products (id),
  merchant_sku text not null,
  title text not null,
  price_pence integer not null check (price_pence > 0),
  delivery_pence integer check (delivery_pence is null or delivery_pence >= 0),
  currency text not null default 'GBP',
  in_stock boolean not null default true,
  url text not null,
  click_url text not null,
  country text not null default 'GB',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (merchant_id, merchant_sku, country)
);

create index if not exists offers_product_idx on offers (product_id);
create index if not exists offers_live_idx on offers (country, last_seen);

create table if not exists feed_runs (
  id serial primary key,
  network text not null,
  source text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_in integer not null default 0,
  rows_ok integer not null default 0,
  errors integer not null default 0,
  error_sample text
);

create table if not exists compliance_runs (
  id serial primary key,
  run_at timestamptz not null default now(),
  passed boolean not null,
  merchant_count integer not null,
  checks jsonb not null
);
