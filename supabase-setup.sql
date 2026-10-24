-- RoadSentry shared reports (run once in Supabase SQL Editor).
-- Photos and exact coordinates will be publicly readable by any site visitor.
-- Uploads require a Supabase anonymous-auth session; no service-role key belongs in the website.

create extension if not exists pgcrypto;

create table if not exists public.road_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  photo_path text not null unique,
  photo_name text not null,
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table public.road_reports enable row level security;
grant select on public.road_reports to anon, authenticated;
grant insert, delete on public.road_reports to authenticated;

drop policy if exists "Public can read road reports" on public.road_reports;
create policy "Public can read road reports" on public.road_reports
  for select to anon, authenticated using (true);

drop policy if exists "Signed anonymous users can add reports" on public.road_reports;
create policy "Signed anonymous users can add reports" on public.road_reports
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Report owners can delete their reports" on public.road_reports;
create policy "Report owners can delete their reports" on public.road_reports
  for delete to authenticated using (auth.uid() = created_by);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('road-reports', 'road-reports', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view road report photos" on storage.objects;
create policy "Public can view road report photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'road-reports');

drop policy if exists "Users can upload into their own report folder" on storage.objects;
create policy "Users can upload into their own report folder" on storage.objects
  for insert to authenticated with check (bucket_id = 'road-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own report photos" on storage.objects;
create policy "Users can delete their own report photos" on storage.objects
  for delete to authenticated using (bucket_id = 'road-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- In Supabase Dashboard, enable anonymous sign-ins under Authentication > Sign In / Providers.
-- Keep public client keys only in backend-config.js. Never expose the service_role key.
