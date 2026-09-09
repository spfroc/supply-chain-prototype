ALTER TABLE home_floor
  ADD COLUMN brand_groups_json JSON NULL COMMENT '品牌分类展示楼层配置' AFTER link_url;

