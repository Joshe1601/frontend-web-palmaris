-- =============================================================================
-- Grupo Palmaris - Esquema de base de datos (Supabase / Postgres)
-- Ejecutar UNA sola vez en un proyecto nuevo (SQL Editor).
-- Orden: enums > tablas > indices > funciones > RLS > grants > realtime
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
create type public.rol_usuario    as enum ('admin', 'chofer', 'vendedor');
create type public.estado_pedido  as enum ('pendiente', 'entregado', 'rechazado', 'pospuesto', 'cancelado');
create type public.estado_ruta    as enum ('pendiente', 'en_curso', 'finalizada');
create type public.estado_parada  as enum ('pendiente', 'entregado', 'rechazado');


-- -----------------------------------------------------------------------------
-- 2. TABLAS
-- -----------------------------------------------------------------------------

-- Perfil de cada usuario de Supabase Auth (define su rol; lo usan las politicas RLS)
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  rol        public.rol_usuario not null,
  nombre     text not null,
  created_at timestamptz not null default now()
);

-- Configuracion global (una sola fila)
create table public.configuracion (
  id                       boolean primary key default true check (id),
  almacen_lat              numeric(9,6),
  almacen_lng              numeric(9,6),
  velocidad_promedio_kmh   numeric(5,1) not null default 25 check (velocidad_promedio_kmh > 0),
  tiempo_atencion_min      integer      not null default 10 check (tiempo_atencion_min >= 0),
  updated_at               timestamptz  not null default now(),
  -- las coordenadas del almacen van las dos o ninguna
  check ((almacen_lat is null) = (almacen_lng is null))
);
insert into public.configuracion (id) values (true);
-- IMPORTANTE: completar luego las coordenadas reales del almacen:
-- update public.configuracion set almacen_lat = ..., almacen_lng = ...;

create table public.clientes (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  direccion              text not null,
  lat                    numeric(9,6),
  lng                    numeric(9,6),
  zona                   text,
  vendedor_id            uuid references public.perfiles (id) on delete set null,
  ventana_horario_inicio time,
  ventana_horario_fin    time,
  activo                 boolean not null default true,
  created_at             timestamptz not null default now(),
  -- coordenadas opcionales (cliente nuevo aun sin ubicar), pero las dos o ninguna
  check ((lat is null) = (lng is null)),
  -- rango aproximado de Peru: detecta lat/lng invertidas o con signo equivocado
  check (lat is null or (lat between -18.5 and 0.1 and lng between -81.5 and -68.5)),
  -- ventana horaria: las dos o ninguna, y fin posterior al inicio
  check ((ventana_horario_inicio is null) = (ventana_horario_fin is null)),
  check (ventana_horario_inicio is null or ventana_horario_fin > ventana_horario_inicio)
);

create table public.choferes (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  usuario      text not null unique,          -- DNI
  telefono     text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.vehiculos (
  id           uuid primary key default gen_random_uuid(),
  placa        text not null unique,
  alias        text,
  capacidad_kg numeric(10,2) check (capacidad_kg is null or capacidad_kg > 0),  -- uso futuro
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes (id),
  vendedor_id  uuid references public.perfiles (id) on delete set null,
  estado       public.estado_pedido not null default 'pendiente',
  peso_kg      numeric(10,2) check (peso_kg is null or peso_kg >= 0),           -- uso futuro
  fecha_pedido date not null default current_date,
  created_at   timestamptz not null default now()
);

create table public.rutas (
  id                  uuid primary key default gen_random_uuid(),
  fecha               date not null,
  chofer_id           uuid not null references public.choferes (id),
  vehiculo_id         uuid not null references public.vehiculos (id),
  zona                text,
  estado              public.estado_ruta not null default 'pendiente',
  distancia_km        numeric(8,2),
  tiempo_estimado_min integer,
  iniciada_at         timestamptz,
  finalizada_at       timestamptz,
  created_at          timestamptz not null default now()
);

create table public.paradas (
  id                          uuid primary key default gen_random_uuid(),
  ruta_id                     uuid not null references public.rutas (id) on delete cascade,
  cliente_id                  uuid not null references public.clientes (id),
  orden                       integer not null check (orden > 0),
  estado                      public.estado_parada not null default 'pendiente',
  distancia_desde_anterior_km numeric(8,2),
  tiempo_estimado_min         integer,
  hora_estimada_llegada       time,
  advertencia_ventana         boolean not null default false,  -- ETA fuera de la ventana horaria del cliente
  motivo_rechazo              text,
  marcada_at                  timestamptz,                     -- momento en que el chofer marco la parada
  -- un cliente aparece una sola vez por ruta (varios pedidos se consolidan en una parada)
  unique (ruta_id, cliente_id),
  -- deferrable: permite reordenar paradas (intercambiar posiciones) dentro de una transaccion
  constraint paradas_ruta_orden_uq unique (ruta_id, orden) deferrable initially deferred
);

-- Pedidos incluidos en cada parada (una parada puede consolidar varios pedidos del mismo cliente)
create table public.parada_pedidos (
  parada_id uuid not null references public.paradas (id) on delete cascade,
  pedido_id uuid not null references public.pedidos (id),
  primary key (parada_id, pedido_id)
);

-- Pings GPS del celular del chofer
create table public.ubicaciones (
  id            bigint generated always as identity primary key,
  chofer_id     uuid not null references public.choferes (id),
  ruta_id       uuid not null references public.rutas (id) on delete cascade,
  lat           numeric(9,6) not null check (lat between -90 and 90),
  lng           numeric(9,6) not null check (lng between -180 and 180),
  precision_m   numeric(7,1),
  registrado_at timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 3. INDICES
-- -----------------------------------------------------------------------------
create index idx_clientes_zona          on public.clientes (zona);
create index idx_clientes_vendedor      on public.clientes (vendedor_id);
create index idx_pedidos_cliente_estado on public.pedidos (cliente_id, estado);
create index idx_rutas_fecha_chofer     on public.rutas (fecha, chofer_id);
create index idx_paradas_ruta_orden     on public.paradas (ruta_id, orden);
create index idx_paradas_cliente        on public.paradas (cliente_id);
create index idx_parada_pedidos_pedido  on public.parada_pedidos (pedido_id);
create index idx_ubic_ruta_tiempo       on public.ubicaciones (ruta_id, registrado_at desc);
create index idx_ubic_chofer_tiempo     on public.ubicaciones (chofer_id, registrado_at desc);

-- Un chofer solo puede tener una ruta en curso a la vez
create unique index uq_rutas_una_en_curso_por_chofer
  on public.rutas (chofer_id) where estado = 'en_curso';


-- -----------------------------------------------------------------------------
-- 4. FUNCIONES AUXILIARES (usadas por las politicas RLS)
-- -----------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

create or replace function public.chofer_actual_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.choferes
  where auth_user_id = (select auth.uid()) and activo
  limit 1;
$$;


-- -----------------------------------------------------------------------------
-- 5. FUNCIONES RPC
-- -----------------------------------------------------------------------------

-- 5.1 Admin: crea ruta + paradas + pedidos asociados en una sola transaccion.
-- p_paradas es un arreglo JSON, ya ordenado por el algoritmo:
--   [{ "cliente_id": "...", "orden": 1, "distancia_km": 1.2, "tiempo_min": 4,
--      "hora_estimada_llegada": "08:35", "advertencia_ventana": false,
--      "pedido_ids": ["...", "..."] }, ...]
create or replace function public.crear_ruta_con_paradas(
  p_fecha               date,
  p_chofer_id           uuid,
  p_vehiculo_id         uuid,
  p_zona                text,
  p_distancia_km        numeric,
  p_tiempo_estimado_min integer,
  p_paradas             jsonb
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_ruta_id   uuid;
  v_item      jsonb;
  v_parada_id uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede crear rutas' using errcode = '42501';
  end if;

  insert into public.rutas (fecha, chofer_id, vehiculo_id, zona, distancia_km, tiempo_estimado_min)
  values (p_fecha, p_chofer_id, p_vehiculo_id, p_zona, p_distancia_km, p_tiempo_estimado_min)
  returning id into v_ruta_id;

  for v_item in select * from jsonb_array_elements(p_paradas) loop
    insert into public.paradas (
      ruta_id, cliente_id, orden, distancia_desde_anterior_km,
      tiempo_estimado_min, hora_estimada_llegada, advertencia_ventana
    )
    values (
      v_ruta_id,
      (v_item->>'cliente_id')::uuid,
      (v_item->>'orden')::integer,
      (v_item->>'distancia_km')::numeric,
      (v_item->>'tiempo_min')::integer,
      (v_item->>'hora_estimada_llegada')::time,
      coalesce((v_item->>'advertencia_ventana')::boolean, false)
    )
    returning id into v_parada_id;

    insert into public.parada_pedidos (parada_id, pedido_id)
    select v_parada_id, value::uuid
    from jsonb_array_elements_text(coalesce(v_item->'pedido_ids', '[]'::jsonb));
  end loop;

  return v_ruta_id;
end;
$$;

-- 5.2 Chofer: inicia su ruta
create or replace function public.iniciar_ruta(p_ruta_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_chofer uuid := public.chofer_actual_id();
begin
  if v_chofer is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.rutas
     set estado = 'en_curso', iniciada_at = now()
   where id = p_ruta_id
     and chofer_id = v_chofer
     and estado = 'pendiente';

  if not found then
    raise exception 'La ruta no existe, no es tuya o ya fue iniciada';
  end if;
end;
$$;

-- 5.3 Chofer: marca una parada como entregada o rechazada (atomico).
-- Actualiza parada + pedidos, y finaliza la ruta si era la ultima parada pendiente.
create or replace function public.marcar_parada(
  p_parada_id uuid,
  p_estado    public.estado_parada,
  p_motivo    text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_chofer        uuid := public.chofer_actual_id();
  v_ruta_id       uuid;
  v_ruta_estado   public.estado_ruta;
  v_parada_estado public.estado_parada;
  v_pendientes    integer;
  v_siguiente     uuid;
begin
  if v_chofer is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_estado not in ('entregado', 'rechazado') then
    raise exception 'Estado invalido: solo entregado o rechazado';
  end if;

  select p.ruta_id, p.estado, r.estado
    into v_ruta_id, v_parada_estado, v_ruta_estado
    from public.paradas p
    join public.rutas r on r.id = p.ruta_id
   where p.id = p_parada_id
     and r.chofer_id = v_chofer
     for update of p;

  if not found then
    raise exception 'Parada no encontrada';
  end if;
  if v_ruta_estado <> 'en_curso' then
    raise exception 'La ruta no esta en curso';
  end if;
  if v_parada_estado <> 'pendiente' then
    raise exception 'La parada ya fue marcada';
  end if;

  update public.paradas
     set estado         = p_estado,
         motivo_rechazo = case when p_estado = 'rechazado' then p_motivo else null end,
         marcada_at     = now()
   where id = p_parada_id;

  update public.pedidos
     set estado = case p_estado
                    when 'entregado' then 'entregado'::public.estado_pedido
                    else 'rechazado'::public.estado_pedido
                  end
   where id in (select pedido_id from public.parada_pedidos where parada_id = p_parada_id);

  select count(*) into v_pendientes
    from public.paradas
   where ruta_id = v_ruta_id and estado = 'pendiente';

  if v_pendientes = 0 then
    update public.rutas
       set estado = 'finalizada', finalizada_at = now()
     where id = v_ruta_id;
  else
    select id into v_siguiente
      from public.paradas
     where ruta_id = v_ruta_id and estado = 'pendiente'
     order by orden
     limit 1;
  end if;

  return jsonb_build_object(
    'ruta_finalizada',     v_pendientes = 0,
    'siguiente_parada_id', v_siguiente
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.perfiles       enable row level security;
alter table public.configuracion  enable row level security;
alter table public.clientes       enable row level security;
alter table public.choferes       enable row level security;
alter table public.vehiculos      enable row level security;
alter table public.pedidos        enable row level security;
alter table public.rutas          enable row level security;
alter table public.paradas        enable row level security;
alter table public.parada_pedidos enable row level security;
alter table public.ubicaciones    enable row level security;

-- Admin: acceso total a todo
create policy admin_all on public.perfiles       for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.configuracion  for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.clientes       for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.choferes       for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.vehiculos      for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.pedidos        for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.rutas          for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.paradas        for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.parada_pedidos for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_all on public.ubicaciones    for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

-- Cualquier usuario autenticado: ve su propio perfil y la configuracion
create policy perfil_propio on public.perfiles
  for select to authenticated using (id = (select auth.uid()));

create policy config_lectura on public.configuracion
  for select to authenticated using (true);

-- Chofer: solo lectura de lo que le corresponde (las escrituras van por RPC)
create policy chofer_ve_su_perfil on public.choferes
  for select to authenticated using (auth_user_id = (select auth.uid()));

create policy chofer_ve_sus_rutas on public.rutas
  for select to authenticated using (chofer_id = (select public.chofer_actual_id()));

create policy chofer_ve_sus_paradas on public.paradas
  for select to authenticated using (
    exists (
      select 1 from public.rutas r
      where r.id = paradas.ruta_id
        and r.chofer_id = (select public.chofer_actual_id())
    )
  );

create policy chofer_ve_sus_parada_pedidos on public.parada_pedidos
  for select to authenticated using (
    exists (
      select 1 from public.paradas p
      join public.rutas r on r.id = p.ruta_id
      where p.id = parada_pedidos.parada_id
        and r.chofer_id = (select public.chofer_actual_id())
    )
  );

create policy chofer_ve_sus_clientes on public.clientes
  for select to authenticated using (
    exists (
      select 1 from public.paradas p
      join public.rutas r on r.id = p.ruta_id
      where p.cliente_id = clientes.id
        and r.chofer_id = (select public.chofer_actual_id())
    )
  );

create policy chofer_ve_sus_pedidos on public.pedidos
  for select to authenticated using (
    exists (
      select 1 from public.parada_pedidos pp
      join public.paradas p on p.id = pp.parada_id
      join public.rutas r on r.id = p.ruta_id
      where pp.pedido_id = pedidos.id
        and r.chofer_id = (select public.chofer_actual_id())
    )
  );

create policy chofer_ve_su_vehiculo on public.vehiculos
  for select to authenticated using (
    exists (
      select 1 from public.rutas r
      where r.vehiculo_id = vehiculos.id
        and r.chofer_id = (select public.chofer_actual_id())
    )
  );

-- Chofer: solo puede insertar pings propios, de una ruta suya que este en curso
create policy chofer_inserta_ubicacion on public.ubicaciones
  for insert to authenticated with check (
    chofer_id = (select public.chofer_actual_id())
    and exists (
      select 1 from public.rutas r
      where r.id = ubicaciones.ruta_id
        and r.chofer_id = (select public.chofer_actual_id())
        and r.estado = 'en_curso'
    )
  );


-- -----------------------------------------------------------------------------
-- 7. PERMISOS DE EJECUCION DE FUNCIONES
-- (por defecto Postgres las deja ejecutables por PUBLIC; las restringimos)
-- -----------------------------------------------------------------------------
revoke all on function public.es_admin()                 from public, anon;
revoke all on function public.chofer_actual_id()         from public, anon;
revoke all on function public.iniciar_ruta(uuid)         from public, anon;
revoke all on function public.marcar_parada(uuid, public.estado_parada, text) from public, anon;
revoke all on function public.crear_ruta_con_paradas(date, uuid, uuid, text, numeric, integer, jsonb) from public, anon;

grant execute on function public.es_admin()                 to authenticated;
grant execute on function public.chofer_actual_id()         to authenticated;
grant execute on function public.iniciar_ruta(uuid)         to authenticated;
grant execute on function public.marcar_parada(uuid, public.estado_parada, text) to authenticated;
grant execute on function public.crear_ruta_con_paradas(date, uuid, uuid, text, numeric, integer, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- 8. REALTIME (mapa en vivo y estados de ruta en el dashboard admin)
-- Realtime respeta RLS: solo el admin recibira estos eventos.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.ubicaciones;
alter publication supabase_realtime add table public.paradas;
alter publication supabase_realtime add table public.rutas;


-- -----------------------------------------------------------------------------
-- 9. PRIMER ADMIN (manual)
-- 1) Crear el usuario en Authentication > Users del dashboard de Supabase.
-- 2) Copiar su UUID y ejecutar:
--
-- insert into public.perfiles (id, rol, nombre)
-- values ('<UUID-del-usuario-en-Auth>', 'admin', 'Nombre Apellido');
-- -----------------------------------------------------------------------------
