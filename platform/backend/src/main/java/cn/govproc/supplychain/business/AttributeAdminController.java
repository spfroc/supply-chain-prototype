package cn.govproc.supplychain.business;

import cn.govproc.supplychain.common.PageResult;
import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/business/attributes")
public class AttributeAdminController {
    private final JdbcClient jdbc;
    public AttributeAdminController(JdbcClient jdbc) { this.jdbc=jdbc; }

    @GetMapping
    Object definitions(@RequestParam(required=false) Integer page,@RequestParam(defaultValue="10") int pageSize,
                       @RequestParam(defaultValue="") String keyword,@RequestParam(required=false) Integer status,
                       @RequestParam(required=false) Long categoryId,@RequestParam(required=false) Boolean associated) {
        String base="""
          SELECT a.id,a.code,a.name,a.group_name AS groupName,a.attribute_type AS attributeType,
            a.input_type AS inputType,a.unit,a.required_flag AS requiredFlag,a.filterable,a.searchable,
            a.visible_flag AS visibleFlag,a.allow_custom AS allowCustom,a.sort_order AS sortOrder,a.status
          FROM attribute_definition a WHERE a.deleted_at IS NULL
          """;
        var params=new LinkedHashMap<String,Object>();
        if(categoryId!=null&&associated!=null) {
            base += Boolean.TRUE.equals(associated)
              ? " AND EXISTS(SELECT 1 FROM category_attribute ca WHERE ca.attribute_id=a.id AND ca.category_id=:categoryId)"
              : " AND NOT EXISTS(SELECT 1 FROM category_attribute ca WHERE ca.attribute_id=a.id AND ca.category_id=:categoryId)";
            params.put("categoryId",categoryId);
        }
        if(page==null) return enrich(jdbc.sql(base+" ORDER BY sortOrder,id").params(params).query().listOfRows());
        var result=PageSupport.query(jdbc,base,"q.sortOrder,q.id",params,page,pageSize,keyword,status,
          List.of("code","name","groupName","attributeType","inputType","unit"),"status");
        return new PageResult<>(enrich(result.records()),result.total(),result.page(),result.pageSize());
    }

    private List<Map<String,Object>> enrich(List<Map<String,Object>> rows) {
        var result=new ArrayList<Map<String,Object>>();
        for(var source:rows) {
            var row=new LinkedHashMap<>(source);
            long id=((Number)row.get("id")).longValue();
            row.put("categoryIds",jdbc.sql("SELECT category_id FROM category_attribute WHERE attribute_id=:id ORDER BY id")
              .param("id",id).query(Long.class).list());
            row.put("options",options(id));
            result.add(row);
        }
        return result;
    }

    @GetMapping("/category/{categoryId}")
    List<Map<String,Object>> categoryTemplate(@PathVariable long categoryId) {
        var rows=jdbc.sql("""
          WITH RECURSIVE ancestors AS (
            SELECT id,parent_id,0 AS distance FROM category WHERE id=:categoryId AND deleted_at IS NULL
            UNION ALL SELECT c.id,c.parent_id,a.distance+1 FROM category c JOIN ancestors a ON a.parent_id=c.id
          )
          SELECT a.id,a.code,a.name,a.group_name AS groupName,a.attribute_type AS attributeType,
            a.input_type AS inputType,a.unit,COALESCE(MAX(ca.required_override),a.required_flag) AS requiredFlag,
            a.filterable,a.visible_flag AS visibleFlag,a.allow_custom AS allowCustom,
            MIN(anc.distance) AS inheritedLevel,MIN(ca.sort_order) AS sortOrder
          FROM ancestors anc JOIN category_attribute ca ON ca.category_id=anc.id
          JOIN attribute_definition a ON a.id=ca.attribute_id AND a.status=1 AND a.deleted_at IS NULL
          GROUP BY a.id ORDER BY sortOrder,a.id
          """).param("categoryId",categoryId).query().listOfRows();
        var result=new ArrayList<Map<String,Object>>();
        for(var source:rows) {
            var row=new LinkedHashMap<>(source);
            row.put("options",options(((Number)row.get("id")).longValue()));
            result.add(row);
        }
        return result;
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    void create(@Valid @RequestBody AttributeRequest r) {
        jdbc.sql("""
          INSERT INTO attribute_definition(code,name,group_name,attribute_type,input_type,unit,required_flag,
            filterable,searchable,visible_flag,allow_custom,sort_order,status)
          VALUES(:code,:name,:groupName,:attributeType,:inputType,:unit,:requiredFlag,:filterable,
            :searchable,:visibleFlag,:allowCustom,:sortOrder,:status)
          """).params(params(r)).update();
        long id=jdbc.sql("SELECT id FROM attribute_definition WHERE code=:code").param("code",r.code()).query(Long.class).single();
        saveCategories(id,r.categoryIds());
    }

    @PutMapping("/{id}") @Transactional
    void update(@PathVariable long id,@Valid @RequestBody AttributeRequest r) {
        int changed=jdbc.sql("""
          UPDATE attribute_definition SET code=:code,name=:name,group_name=:groupName,attribute_type=:attributeType,
            input_type=:inputType,unit=:unit,required_flag=:requiredFlag,filterable=:filterable,
            searchable=:searchable,visible_flag=:visibleFlag,allow_custom=:allowCustom,sort_order=:sortOrder,status=:status
          WHERE id=:id AND deleted_at IS NULL
          """).params(params(r)).param("id",id).update();
        if(changed==0) throw new IllegalArgumentException("属性不存在");
        jdbc.sql("DELETE FROM category_attribute WHERE attribute_id=:id").param("id",id).update();
        saveCategories(id,r.categoryIds());
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) {
        long used=jdbc.sql("SELECT COUNT(*) FROM product_attribute_value WHERE attribute_id=:id").param("id",id).query(Long.class).single();
        if(used>0) throw new IllegalArgumentException("属性已被商品使用，只能停用，不能删除");
        jdbc.sql("DELETE FROM category_attribute WHERE attribute_id=:id").param("id",id).update();
        if(jdbc.sql("UPDATE attribute_definition SET deleted_at=NOW(),status=0 WHERE id=:id AND deleted_at IS NULL").param("id",id).update()==0)
            throw new IllegalArgumentException("属性不存在");
    }

    @GetMapping("/{id}/options") List<Map<String,Object>> optionList(@PathVariable long id){ return options(id); }
    @PostMapping("/{id}/options") @ResponseStatus(HttpStatus.CREATED)
    void createOption(@PathVariable long id,@Valid @RequestBody OptionRequest r){
        jdbc.sql("INSERT INTO attribute_option(attribute_id,option_code,option_label,color_value,sort_order,status) VALUES(:id,:code,:label,:color,:sort,:status)")
          .params(Map.of("id",id,"code",r.optionCode(),"label",r.optionLabel(),"color",value(r.colorValue()),"sort",r.sortOrder(),"status",r.status())).update();
    }
    @PutMapping("/{id}/options/{optionId}")
    void updateOption(@PathVariable long id,@PathVariable long optionId,@Valid @RequestBody OptionRequest r){
        if(jdbc.sql("UPDATE attribute_option SET option_code=:code,option_label=:label,color_value=:color,sort_order=:sort,status=:status WHERE id=:optionId AND attribute_id=:id AND deleted_at IS NULL")
          .params(Map.of("id",id,"optionId",optionId,"code",r.optionCode(),"label",r.optionLabel(),"color",value(r.colorValue()),"sort",r.sortOrder(),"status",r.status())).update()==0)
            throw new IllegalArgumentException("选项不存在");
    }
    @DeleteMapping("/{id}/options/{optionId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteOption(@PathVariable long id,@PathVariable long optionId){
        jdbc.sql("UPDATE attribute_option SET deleted_at=NOW(),status=0 WHERE id=:optionId AND attribute_id=:id").params(Map.of("id",id,"optionId",optionId)).update();
    }

    private List<Map<String,Object>> options(long id){return jdbc.sql("SELECT id,option_code AS optionCode,option_label AS optionLabel,color_value AS colorValue,sort_order AS sortOrder,status FROM attribute_option WHERE attribute_id=:id AND deleted_at IS NULL ORDER BY sort_order,id").param("id",id).query().listOfRows();}
    private void saveCategories(long id,List<Long> categoryIds){for(long categoryId:categoryIds) jdbc.sql("INSERT INTO category_attribute(category_id,attribute_id,sort_order) VALUES(:categoryId,:id,0)").params(Map.of("categoryId",categoryId,"id",id)).update();}
    private Map<String,Object> params(AttributeRequest r){var p=new LinkedHashMap<String,Object>();p.put("code",r.code().trim().toUpperCase());p.put("name",r.name());p.put("groupName",r.groupName());p.put("attributeType",r.attributeType());p.put("inputType",r.inputType());p.put("unit",value(r.unit()));p.put("requiredFlag",r.requiredFlag());p.put("filterable",r.filterable());p.put("searchable",r.searchable());p.put("visibleFlag",r.visibleFlag());p.put("allowCustom",r.allowCustom());p.put("sortOrder",r.sortOrder());p.put("status",r.status());return p;}
    private static String value(String value){return value==null?"":value;}
    public record AttributeRequest(@NotBlank String code,@NotBlank String name,@NotBlank String groupName,@NotBlank String attributeType,@NotBlank String inputType,String unit,int requiredFlag,int filterable,int searchable,int visibleFlag,int allowCustom,int sortOrder,int status,@NotEmpty List<Long> categoryIds){}
    public record OptionRequest(@NotBlank String optionCode,@NotBlank String optionLabel,String colorValue,int sortOrder,int status){}
}
