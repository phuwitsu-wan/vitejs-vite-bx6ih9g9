-- =====================================================================
--  ฐานข้อมูลเว็บแอป "เครือข่ายอารักขาพืช จังหวัดเพชรบูรณ์"
--  วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run
--  (รันซ้ำได้ ไม่ทำให้ข้อมูลหาย)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- ประเภทจุด (แก้ชื่อ/สี/ไอคอนได้จากหน้าแอดมิน) ----------
create table if not exists public.categories (
  key         text primary key,
  name        text not null,
  short_name  text,
  color       text not null default '#16a34a',
  icon        text not null default 'MapPin',
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- จุดข้อมูลทั้งหมด ----------
create table if not exists public.sites (
  id               uuid primary key default gen_random_uuid(),
  category         text not null references public.categories(key) on update cascade,
  name             text not null,
  subtype          text,
  level            text,
  amphoe           text,
  tambon           text,
  moo              text,
  address          text,
  lat              double precision,
  lng              double precision,
  phone            text,
  contact_name     text,
  main_crops       text,
  members          int,
  established_year int,
  service_hours    text,
  status           text,
  description      text,
  extra            jsonb not null default '{}'::jsonb,
  image_url        text,
  is_published     boolean not null default true,
  source           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists sites_category_idx on public.sites(category);
create index if not exists sites_amphoe_idx   on public.sites(amphoe);

-- ---------- ค่าตั้งค่าเว็บ ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb
);

-- ---------- รายชื่อแอดมิน ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------- ฟังก์ชันตรวจสิทธิ์แอดมิน ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- updated_at อัตโนมัติ ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists sites_touch on public.sites;
create trigger sites_touch before update on public.sites
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.categories enable row level security;
alter table public.sites      enable row level security;
alter table public.settings   enable row level security;
alter table public.admins     enable row level security;

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read published sites" on public.sites;
create policy "public read published sites" on public.sites for select using (is_published or public.is_admin());
drop policy if exists "admin write sites" on public.sites;
create policy "admin write sites" on public.sites for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select using (true);
drop policy if exists "admin write settings" on public.settings;
create policy "admin write settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin read admins" on public.admins;
create policy "admin read admins" on public.admins for select using (public.is_admin());

-- ---------- Realtime: หน้าเว็บอัปเดตเองเมื่อแอดมินแก้ข้อมูล ----------
do $$ begin
  begin alter publication supabase_realtime add table public.sites;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.categories; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settings;   exception when duplicate_object then null; end;
end $$;

-- ---------- ที่เก็บรูปภาพ ----------
insert into storage.buckets (id, name, public) values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "public read site images" on storage.objects;
create policy "public read site images" on storage.objects for select using (bucket_id = 'site-images');
drop policy if exists "admin upload site images" on storage.objects;
create policy "admin upload site images" on storage.objects for insert with check (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "admin delete site images" on storage.objects;
create policy "admin delete site images" on storage.objects for delete using (bucket_id = 'site-images' and public.is_admin());

-- ---------- ประเภทเริ่มต้น ----------
insert into public.categories (key, name, short_name, color, icon, sort_order, description) values
  ('soil',     'ศูนย์จัดการดินปุ๋ยชุมชน', 'ศดปช.',       '#b45309', 'Layers',        1, 'ศูนย์ถ่ายทอดความรู้การวิเคราะห์ดิน การใช้ปุ๋ยตามค่าวิเคราะห์ดิน และการผลิตปุ๋ยอินทรีย์'),
  ('cpmc',     'ศูนย์จัดการศัตรูพืชชุมชน', 'ศจช.',        '#dc2626', 'Bug',           2, 'ศูนย์เรียนรู้การจัดการศัตรูพืชแบบผสมผสาน ผลิตและใช้ชีวภัณฑ์ เฝ้าระวังการระบาดในชุมชน'),
  ('forecast', 'แปลงพยากรณ์',             'แปลงพยากรณ์', '#2563eb', 'Radar',         3, 'แปลงติดตามสถานการณ์การระบาดศัตรูพืชรายสัปดาห์ เพื่อแจ้งเตือนและพยากรณ์การระบาด'),
  ('ffs',      'โรงเรียนเกษตรกร',          'รร.เกษตรกร',  '#7c3aed', 'GraduationCap', 4, 'กระบวนการเรียนรู้แบบมีส่วนร่วมในแปลงเกษตรกร (Farmer Field School)'),
  ('clinic',   'จุดบริการคลินิกพืช',        'คลินิกพืช',   '#0d9488', 'Stethoscope',   5, 'บริการวินิจฉัยอาการผิดปกติของพืช แนะนำวิธีจัดการศัตรูพืชอย่างถูกต้องและปลอดภัย')
on conflict (key) do nothing;

-- =====================================================================
--  ขั้นตอนสุดท้าย: เพิ่มแอดมิน
--  1) Supabase > Authentication > Users > Add user (ใส่อีเมล + รหัสผ่าน, ติ๊ก Auto Confirm)
--  2) รันคำสั่งด้านล่าง (เปลี่ยนอีเมลเป็นของจริง)
--
--  insert into public.admins (user_id, email)
--  select id, email from auth.users where email = 'admin@example.com'
--  on conflict do nothing;
-- =====================================================================
