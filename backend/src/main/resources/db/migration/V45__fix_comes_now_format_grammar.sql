-- Fix COMES NOW grammar: "for {relief}" → "to {relief}" for 29 states.
-- "moves this Court for dismiss" is broken grammar; "moves this Court to dismiss" is correct.
-- CA and US (Federal) use "for an order {relief}" which is a different pattern and correct (expects gerund).
UPDATE state_court_configurations
SET comes_now_format = REPLACE(comes_now_format, 'for {relief}', 'to {relief}'),
    updated_at = NOW()
WHERE comes_now_format LIKE '%for {relief}%'
  AND comes_now_format NOT LIKE '%for an order {relief}%';
