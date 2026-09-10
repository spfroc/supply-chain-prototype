UPDATE category c
JOIN product_spu p ON p.category_id=c.id AND p.deleted_at IS NULL AND p.collection_platform='huiecai'
SET c.status=1,c.deleted_at=NULL
WHERE c.status<>1 OR c.deleted_at IS NOT NULL;

UPDATE category parent
JOIN category child ON child.parent_id=parent.id AND child.deleted_at IS NULL
JOIN product_spu p ON p.category_id=child.id AND p.deleted_at IS NULL AND p.collection_platform='huiecai'
SET parent.status=1,parent.deleted_at=NULL
WHERE parent.status<>1 OR parent.deleted_at IS NOT NULL;
