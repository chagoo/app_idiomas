-- setup_clean.sql
-- Limpieza de duplicados en public.school_items antes de crear el índice único.
-- Objetivo: eliminar filas duplicadas donde "es" es NULL, conservando
-- preferentemente la fila que sí tiene traducción (es NOT NULL) o, si todas
-- son NULL, dejar solo una por (week,kind,idx).
-- Ejecutar en SQL Editor (Production) con rol 'postgres'.

begin;

-- 0) (Opcional) Vista previa de duplicados por clave natural
-- select week, kind, idx, count(*) as n
-- from public.school_items
-- group by 1,2,3
-- having count(*) > 1
-- order by 1,2,3;

-- 1) Borrar todas las filas con es IS NULL cuando existe al menos una fila
--    del mismo (week,kind,idx) con es NOT NULL (preferimos conservar la traducida)
delete from public.school_items s
where s.es is null
  and exists (
    select 1 from public.school_items t
    where t.week = s.week and t.kind = s.kind and t.idx = s.idx
      and t.es is not null
  );

-- 2) Si aún quedan grupos duplicados en los que TODAS las filas tienen es IS NULL,
--    dejar solo una (la más reciente por created_at, y como desempate por id)
with ranked as (
  select id, week, kind, idx,
         row_number() over (
           partition by week, kind, idx
           order by created_at desc, id desc
         ) rn
  from public.school_items
  where es is null
)
delete from public.school_items s
using ranked r
where s.id = r.id and r.rn > 1;

commit;

-- 3) (Opcional) Verificación final
-- select week, kind, idx, count(*) as n
-- from public.school_items
-- group by 1,2,3
-- having count(*) > 1;

