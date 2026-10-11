-- Trazado vial de la ruta (almacen -> paradas -> almacen), guardado una sola vez al crearla.
-- Formato: polyline codificado (precision 5). NULL = sin ruteo vial (se dibuja en linea recta).
alter table public.rutas add column geometria text;

comment on column public.rutas.geometria is
  'Polyline codificado (precision 5) del trazado por calles; NULL si no hubo ruteo vial.';
