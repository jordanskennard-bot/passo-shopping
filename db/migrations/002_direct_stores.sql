-- Shops that asked to be listed directly (For shops page, the Shopify app later).
create table if not exists direct_stores (
  id serial primary key,
  name text not null,
  domain text not null,
  type text not null check (type in ('google', 'shopify')),
  url text not null,
  country text not null default 'GB',
  delivery_pence integer check (delivery_pence is null or delivery_pence >= 0),
  contact_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (domain, country)
);
