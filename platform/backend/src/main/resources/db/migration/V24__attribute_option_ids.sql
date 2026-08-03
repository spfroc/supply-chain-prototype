-- Backfill single-choice option ids from historical label values.
UPDATE product_attribute_value pav
JOIN attribute_option ao ON ao.attribute_id=pav.attribute_id AND ao.option_label=pav.value_text
SET pav.option_ids=JSON_ARRAY(ao.id)
WHERE pav.option_ids IS NULL AND ao.deleted_at IS NULL;
