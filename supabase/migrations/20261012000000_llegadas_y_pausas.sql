-- =============================================================================
-- Llegada a la parada (con validacion de distancia) y pausas/estacionamientos
-- =============================================================================

-- Parametros globales
alter table public.configuracion
  add column radio_llegada_m           integer not null default 100 check (radio_llegada_m > 0),
  add column umbral_estacionamiento_min integer not null default 7   check (umbral_estacionamiento_min > 0);

-- Momento en que el chofer llego a la tienda (boton "He llegado") y a cuantos metros estaba.
-- Tiempo de atencion = marcada_at - llegada_at.
alter table public.paradas
  add column llegada_at          timestamptz,
  add column llegada_distancia_m numeric(8,1);

-- Distancia en metros entre dos coordenadas (Haversine)
create or replace function public.distancia_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe set search_path = ''
as $$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- Chofer: "He llegado". Solo se registra si esta a <= radio_llegada_m de la tienda.
create or replace function public.registrar_llegada(
  p_parada_id uuid,
  p_lat       double precision,
  p_lng       double precision
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_chofer uuid := public.chofer_actual_id();
  v_row    record;
  v_radio  integer;
  v_dist   double precision;
begin
  if v_chofer is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicacion invalida';
  end if;

  select p.estado, p.llegada_at, r.estado as ruta_estado, c.lat, c.lng
    into v_row
    from public.paradas p
    join public.rutas r    on r.id = p.ruta_id
    join public.clientes c on c.id = p.cliente_id
   where p.id = p_parada_id
     and r.chofer_id = v_chofer
     for update of p;

  if not found then
    raise exception 'Parada no encontrada';
  end if;
  if v_row.ruta_estado <> 'en_curso' then
    raise exception 'La ruta no esta en curso';
  end if;
  if v_row.estado <> 'pendiente' then
    raise exception 'La parada ya fue marcada';
  end if;
  if v_row.llegada_at is not null then  -- idempotente: no se pisa la primera llegada
    return jsonb_build_object('llegada_at', v_row.llegada_at, 'ya_registrada', true);
  end if;
  if v_row.lat is null or v_row.lng is null then
    raise exception 'El cliente no tiene coordenadas';
  end if;

  select radio_llegada_m into v_radio from public.configuracion where id;
  v_dist := public.distancia_m(p_lat, p_lng, v_row.lat::double precision, v_row.lng::double precision);

  if v_dist > v_radio then
    raise exception 'Estas a % m de la tienda. Debes estar a menos de % m para marcar que llegaste.',
      round(v_dist), v_radio;
  end if;

  update public.paradas
     set llegada_at = now(), llegada_distancia_m = round(v_dist::numeric, 1)
   where id = p_parada_id;

  return jsonb_build_object('llegada_at', now(), 'distancia_m', round(v_dist::numeric, 1), 'ya_registrada', false);
end;
$$;

-- Pausas / estacionamientos con su motivo (los registra la app del chofer)
create table public.pausas (
  id         uuid primary key default gen_random_uuid(),
  ruta_id    uuid not null references public.rutas (id) on delete cascade,
  chofer_id  uuid not null references public.choferes (id),
  parada_id  uuid references public.paradas (id) on delete set null,  -- si ocurrio junto a una tienda de la ruta
  lat        numeric(9,6),
  lng        numeric(9,6),
  inicio_at  timestamptz not null default now(),
  fin_at     timestamptz,
  motivo     text not null check (length(btrim(motivo)) >= 3),
  created_at timestamptz not null default now(),
  check (fin_at is null or fin_at >= inicio_at)
);
create index idx_pausas_ruta_inicio on public.pausas (ruta_id, inicio_at);

alter table public.pausas enable row level security;
create policy admin_all on public.pausas
  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy chofer_ve_sus_pausas on public.pausas
  for select to authenticated using (chofer_id = (select public.chofer_actual_id()));

-- Chofer: registra una pausa con su motivo (la inserta por RPC, no directamente)
create or replace function public.registrar_pausa(
  p_ruta_id   uuid,
  p_inicio_at timestamptz,
  p_fin_at    timestamptz,
  p_lat       double precision,
  p_lng       double precision,
  p_motivo    text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_chofer uuid := public.chofer_actual_id();
  v_radio  integer;
  v_parada uuid;
  v_id     uuid;
begin
  if v_chofer is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rutas where id = p_ruta_id and chofer_id = v_chofer) then
    raise exception 'Ruta no encontrada';
  end if;

  select radio_llegada_m into v_radio from public.configuracion where id;
  if p_lat is not null and p_lng is not null then
    select p.id into v_parada
      from public.paradas p
      join public.clientes c on c.id = p.cliente_id
     where p.ruta_id = p_ruta_id
       and c.lat is not null
       and public.distancia_m(p_lat, p_lng, c.lat::double precision, c.lng::double precision) <= v_radio
     order by public.distancia_m(p_lat, p_lng, c.lat::double precision, c.lng::double precision)
     limit 1;
  end if;

  insert into public.pausas (ruta_id, chofer_id, parada_id, lat, lng, inicio_at, fin_at, motivo)
  values (p_ruta_id, v_chofer, v_parada, p_lat, p_lng, coalesce(p_inicio_at, now()), p_fin_at, btrim(p_motivo))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.distancia_m(double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.registrar_llegada(uuid, double precision, double precision) from public, anon;
revoke all on function public.registrar_pausa(uuid, timestamptz, timestamptz, double precision, double precision, text) from public, anon;
grant execute on function public.distancia_m(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.registrar_llegada(uuid, double precision, double precision) to authenticated;
grant execute on function public.registrar_pausa(uuid, timestamptz, timestamptz, double precision, double precision, text) to authenticated;
