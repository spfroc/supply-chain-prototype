CREATE TEMPORARY TABLE category_cleanup_map (
  old_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  new_id BIGINT UNSIGNED NOT NULL
);

INSERT INTO category_cleanup_map(old_id,new_id)
SELECT bad.id,MIN(good.id)
FROM category bad
JOIN category good ON good.name=bad.name
  AND good.parent_id IS NOT NULL
  AND good.deleted_at IS NULL
JOIN upstream_category_mapping upstream
  ON upstream.category_id=good.id
  AND upstream.provider='miniapps'
WHERE bad.parent_id IS NULL
  AND bad.deleted_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM category child WHERE child.parent_id=bad.id AND child.deleted_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM upstream_category_mapping own_mapping WHERE own_mapping.category_id=bad.id)
GROUP BY bad.id;

UPDATE product_spu product
JOIN category_cleanup_map cleanup ON cleanup.old_id=product.category_id
SET product.category_id=cleanup.new_id;

INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT cleanup.new_id,relation.attribute_id,relation.sort_order
FROM category_attribute relation
JOIN category_cleanup_map cleanup ON cleanup.old_id=relation.category_id;

DELETE relation
FROM category_attribute relation
JOIN category_cleanup_map cleanup ON cleanup.old_id=relation.category_id;

DELETE category
FROM category
JOIN category_cleanup_map cleanup ON cleanup.old_id=category.id;

DROP TEMPORARY TABLE category_cleanup_map;
