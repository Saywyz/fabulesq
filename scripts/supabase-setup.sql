-- Table de persistance des parties (Phase 6) : reprise si l'hôte se déconnecte.
-- À exécuter une fois dans le SQL Editor du projet Supabase.
-- Sans cette table, le jeu fonctionne normalement (la reprise est simplement désactivée).

create table if not exists public.games (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Jeu entre amis, clé anon côté client (TECH_ARCHITECTURE.md §6.3) :
-- lecture/écriture ouvertes, assumé comme limite connue (pas de service_role côté client).
create policy "games_select" on public.games for select using (true);
create policy "games_insert" on public.games for insert with check (true);
create policy "games_update" on public.games for update using (true);

-- Ménage optionnel : purger les parties de plus de 7 jours (à planifier via pg_cron si souhaité)
-- delete from public.games where updated_at < now() - interval '7 days';
