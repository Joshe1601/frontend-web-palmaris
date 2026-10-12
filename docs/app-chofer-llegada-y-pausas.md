# App del chofer: «He llegado» (≤ 100 m) y pausas con motivo

Requiere la migración `20261012000000_llegadas_y_pausas.sql`. La regla de distancia **se valida en la base de
datos** (`registrar_llegada`); la app solo la refleja en la interfaz para guiar al chofer.

## 1. «He llegado»

1. Lee `configuracion.radio_llegada_m` (por defecto 100) una vez al iniciar sesión.
2. Con la posición GPS actual y las coordenadas del cliente de la parada, calcula la distancia (Haversine).
   - Si `distancia > radio`: deja el botón deshabilitado y muestra «Estás a X m de la tienda».
   - Si `distancia <= radio`: habilítalo.
3. Al pulsar, llama a la RPC con la posición actual (no la de hace minutos):

```ts
const { data, error } = await supabase.rpc("registrar_llegada", {
  p_parada_id: parada.id,
  p_lat: pos.coords.latitude,
  p_lng: pos.coords.longitude,
});
// error.message ya viene en español, p. ej.: "Estas a 240 m de la tienda. Debes estar a menos de 100 m ..."
// data: { llegada_at, distancia_m, ya_registrada }
```

- Es idempotente: pulsar dos veces no cambia la primera hora de llegada.
- Si hay mala precisión de GPS (`pos.coords.accuracy` > 50 m), conviene pedir otra lectura antes de llamar.
- Después se entrega/rechaza con `marcar_parada` como hasta ahora. El **tiempo de atención** en el panel es
  `marcada_at − llegada_at`.

## 2. Pausas y motivo

El panel detecta estacionamientos con los pings de `ubicaciones` (camión dentro de 50 m durante
`configuracion.umbral_estacionamiento_min`, por defecto 7 min). Para saber **por qué**, la app puede preguntar:

1. Si el camión lleva ≥ `umbral_estacionamiento_min` sin moverse, mostrar «¿Por qué te detuviste?» con motivos
   (tráfico, descarga lenta, cliente ausente, almuerzo, avería, otro…).
2. Registrar la respuesta:

```ts
await supabase.rpc("registrar_pausa", {
  p_ruta_id: ruta.id,
  p_inicio_at: inicioDetencion.toISOString(),
  p_fin_at: null,            // o el instante en que retomó la marcha
  p_lat: pos.coords.latitude,
  p_lng: pos.coords.longitude,
  p_motivo: "Cliente ausente, esperé que abriera",
});
```

La RPC enlaza la pausa con la parada más cercana (dentro del radio) si la hay. El panel cruza cada pausa con el
estacionamiento detectado; los que no tengan motivo aparecen como «Sin motivo registrado».

## 3. Endurecer (opcional)

Un chofer técnico podría llamar a `marcar_parada` sin pasar por `registrar_llegada`. Si quieres impedirlo, en una
migración nueva redefine `marcar_parada` para exigir `llegada_at is not null` antes de entregar. No se hizo por
defecto para no romper la versión actual de la app.
