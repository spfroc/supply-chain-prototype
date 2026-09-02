package cn.govproc.supplychain.client;

import cn.govproc.supplychain.auth.ClientAuthService;
import cn.govproc.supplychain.auth.EnterpriseAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/client/purchase-tools")
public class PurchaseEfficiencyController {
    private final JdbcClient jdbc;private final ClientAuthService auth;private final EnterpriseAuthorizationService authorization;
    public PurchaseEfficiencyController(JdbcClient jdbc,ClientAuthService auth,EnterpriseAuthorizationService authorization){this.jdbc=jdbc;this.auth=auth;this.authorization=authorization;}

    @GetMapping("/frequent-items")
    List<Map<String,Object>> frequentItems(){authorization.require("purchase:view");return jdbc.sql("""
      SELECT f.id,f.sku_id AS skuId,f.default_quantity AS defaultQuantity,f.remark,f.sort_order AS sortOrder,
        p.id AS productId,p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,s.sku_code AS skuCode,
        CAST(s.spec_json AS CHAR) AS specJson,s.market_price AS marketPrice,s.member_price AS memberPrice,
        s.stock-s.reserved_stock AS availableStock,s.status AS skuStatus
      FROM frequent_purchase_item f JOIN product_sku s ON s.id=f.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE f.user_id=:userId AND s.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY f.sort_order,f.id DESC
      """).param("userId",userId()).query().listOfRows();}
    @GetMapping("/frequent-items/{skuId}") Map<String,Object> frequentState(@PathVariable long skuId){authorization.require("purchase:view");int count=jdbc.sql("SELECT COUNT(*) FROM frequent_purchase_item WHERE user_id=:userId AND sku_id=:skuId").params(Map.of("userId",userId(),"skuId",skuId)).query(Integer.class).single();return Map.of("favorite",count>0);}

    @PostMapping("/frequent-items") @ResponseStatus(HttpStatus.CREATED)
    void addFrequent(@Valid @RequestBody FrequentRequest request){authorization.require("purchase:manage");requireSku(request.skuId());jdbc.sql("""
      INSERT INTO frequent_purchase_item(enterprise_id,user_id,sku_id,default_quantity,remark)
      VALUES(:enterpriseId,:userId,:skuId,:quantity,:remark)
      ON DUPLICATE KEY UPDATE default_quantity=:quantity,remark=:remark
      """).param("enterpriseId",enterpriseId()).param("userId",userId()).param("skuId",request.skuId()).param("quantity",request.quantity()).param("remark",request.remark()).update();}

    @PutMapping("/frequent-items/{skuId}")
    void updateFrequent(@PathVariable long skuId,@Valid @RequestBody FrequentRequest request){authorization.require("purchase:manage");int changed=jdbc.sql("UPDATE frequent_purchase_item SET default_quantity=:quantity,remark=:remark WHERE user_id=:userId AND sku_id=:skuId").param("quantity",request.quantity()).param("remark",request.remark()).param("userId",userId()).param("skuId",skuId).update();if(changed==0)throw new IllegalArgumentException("常购商品不存在");}
    @DeleteMapping("/frequent-items/{skuId}") void deleteFrequent(@PathVariable long skuId){authorization.require("purchase:manage");jdbc.sql("DELETE FROM frequent_purchase_item WHERE user_id=:userId AND sku_id=:skuId").params(Map.of("userId",userId(),"skuId",skuId)).update();}

    @PostMapping("/frequent-items/add-to-cart") @Transactional
    Map<String,Object> addFrequentToCart(@RequestBody(required=false) SelectionRequest request){authorization.require("purchase:manage");List<Long> selected=request==null||request.skuIds()==null?List.of():request.skuIds();String condition=selected.isEmpty()?"":" AND f.sku_id IN (:skuIds)";var spec=jdbc.sql("""
      SELECT f.sku_id AS skuId,LEAST(f.default_quantity,s.stock-s.reserved_stock) AS quantity
      FROM frequent_purchase_item f JOIN product_sku s ON s.id=f.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE f.user_id=:userId AND s.status=1 AND p.status=1 AND s.deleted_at IS NULL AND p.deleted_at IS NULL AND s.stock-s.reserved_stock>0
      """+condition).param("userId",userId());if(!selected.isEmpty())spec.param("skuIds",selected);return addRowsToCart(spec.query().listOfRows());}

    @PostMapping("/orders/{orderId}/repurchase") @Transactional
    Map<String,Object> repurchase(@PathVariable long orderId){authorization.require("purchase:manage");int owned=jdbc.sql("SELECT COUNT(*) FROM order_main WHERE id=:id AND user_id=:userId").params(Map.of("id",orderId,"userId",userId())).query(Integer.class).single();if(owned==0)throw new IllegalArgumentException("订单不存在或不可复购");var rows=jdbc.sql("""
      SELECT oi.sku_id AS skuId,LEAST(SUM(oi.quantity),s.stock-s.reserved_stock) AS quantity
      FROM order_item oi JOIN product_sku s ON s.id=oi.sku_id JOIN product_spu p ON p.id=s.spu_id
      WHERE oi.order_main_id=:orderId AND oi.fulfillment_status<>4 AND s.status=1 AND p.status=1
        AND s.deleted_at IS NULL AND p.deleted_at IS NULL AND s.stock-s.reserved_stock>0 GROUP BY oi.sku_id
      """).param("orderId",orderId).query().listOfRows();if(rows.isEmpty())throw new IllegalArgumentException("原订单商品均已下架或暂无库存");return addRowsToCart(rows);}

    @GetMapping("/imports/template")
    void downloadTemplate(HttpServletResponse response) throws IOException {
      authorization.require("purchase:view");
      response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition","attachment; filename*=UTF-8''"+URLEncoder.encode("批量采购导入模板.xlsx",StandardCharsets.UTF_8));
      try(var workbook=new XSSFWorkbook()){
        var sheet=workbook.createSheet("采购商品");var header=sheet.createRow(0);
        header.createCell(0).setCellValue("SKU编码");header.createCell(1).setCellValue("采购数量");
        var example=sheet.createRow(1);example.createCell(0).setCellValue("请填写系统SKU编码");example.createCell(1).setCellValue(1);
        sheet.setColumnWidth(0,7200);sheet.setColumnWidth(1,3600);workbook.write(response.getOutputStream());
      }
    }

    @PostMapping(value="/imports",consumes="multipart/form-data") @Transactional
    Map<String,Object> importWorkbook(@RequestParam("file") MultipartFile file) throws IOException {
      authorization.require("purchase:manage");
      if(file.isEmpty())throw new IllegalArgumentException("请选择 Excel 文件");
      String name=file.getOriginalFilename()==null?"import.xlsx":file.getOriginalFilename();
      if(!name.toLowerCase().endsWith(".xlsx"))throw new IllegalArgumentException("仅支持 .xlsx 文件");
      jdbc.sql("INSERT INTO purchase_import_task(enterprise_id,user_id,file_name) VALUES(:enterpriseId,:userId,:fileName)")
        .param("enterpriseId",enterpriseId()).param("userId",userId()).param("fileName",name).update();
      long taskId=jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();int total=0,valid=0;
      try(var workbook=WorkbookFactory.create(file.getInputStream())){
        var sheet=workbook.getSheetAt(0);var formatter=new DataFormatter();
        for(int index=1;index<=sheet.getLastRowNum();index++){
          var row=sheet.getRow(index);if(row==null)continue;String code=formatter.formatCellValue(row.getCell(0)).trim();String quantityText=formatter.formatCellValue(row.getCell(1)).trim();
          if(code.isBlank()&&quantityText.isBlank())continue;total++;Integer quantity=null;String error=null;Long skuId=null;
          try{quantity=Integer.valueOf(quantityText);}catch(Exception ignored){error="采购数量必须是整数";}
          if(code.isBlank())error="SKU编码不能为空";else if(error==null&&(quantity==null||quantity<1||quantity>9999))error="采购数量应为1至9999";
          if(error==null){var sku=jdbc.sql("SELECT s.id FROM product_sku s JOIN product_spu p ON p.id=s.spu_id WHERE s.sku_code=:code AND s.status=1 AND p.status=1 AND s.deleted_at IS NULL AND p.deleted_at IS NULL LIMIT 1").param("code",code).query(Long.class).optional();if(sku.isEmpty())error="SKU不存在或已下架";else{skuId=sku.get();int stock=jdbc.sql("SELECT stock-reserved_stock FROM product_sku WHERE id=:id").param("id",skuId).query(Integer.class).single();if(stock<quantity)error="库存不足，可售库存 "+Math.max(stock,0);}}
          String status=error==null?"VALID":"INVALID";if(error==null)valid++;
          jdbc.sql("INSERT INTO purchase_import_item(task_id,source_row,sku_code,quantity,sku_id,status,error_message) VALUES(:taskId,:rowNumber,:skuCode,:quantity,:skuId,:status,:error)")
            .param("taskId",taskId).param("rowNumber",index+1).param("skuCode",code).param("quantity",quantity).param("skuId",skuId).param("status",status).param("error",error).update();
        }
      }
      jdbc.sql("UPDATE purchase_import_task SET total_rows=:total,valid_rows=:valid,invalid_rows=:invalid WHERE id=:id").param("total",total).param("valid",valid).param("invalid",total-valid).param("id",taskId).update();
      return importTask(taskId);
    }

    @GetMapping("/imports") List<Map<String,Object>> importTasks(){authorization.require("purchase:view");return jdbc.sql("SELECT id,file_name AS fileName,status,total_rows AS totalRows,valid_rows AS validRows,invalid_rows AS invalidRows,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt FROM purchase_import_task WHERE user_id=:userId ORDER BY id DESC LIMIT 30").param("userId",userId()).query().listOfRows();}
    @GetMapping("/imports/{taskId}") Map<String,Object> importTask(@PathVariable long taskId){authorization.require("purchase:view");var task=jdbc.sql("SELECT id,file_name AS fileName,status,total_rows AS totalRows,valid_rows AS validRows,invalid_rows AS invalidRows,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS createdAt FROM purchase_import_task WHERE id=:id AND user_id=:userId").params(Map.of("id",taskId,"userId",userId())).query().singleRow();var items=jdbc.sql("""
      SELECT i.id,i.source_row AS rowNumber,i.sku_code AS skuCode,i.quantity,i.sku_id AS skuId,i.status,i.error_message AS errorMessage,
        p.title,COALESCE(NULLIF(s.sku_image,''),p.main_image) AS image,s.spec_json AS specJson,s.stock-s.reserved_stock AS availableStock,
        s.market_price AS marketPrice,s.member_price AS memberPrice,
        COALESCE((SELECT MIN(ai.agreement_price) FROM agreement_item ai JOIN agreement a ON a.id=ai.agreement_id WHERE ai.sku_id=s.id AND ai.status=1 AND ai.deleted_at IS NULL AND a.enterprise_id=:enterpriseId AND a.status=1 AND a.deleted_at IS NULL AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date),s.member_price) AS salePrice
      FROM purchase_import_item i LEFT JOIN product_sku s ON s.id=i.sku_id LEFT JOIN product_spu p ON p.id=s.spu_id WHERE i.task_id=:taskId ORDER BY i.source_row
      """).params(Map.of("enterpriseId",enterpriseId(),"taskId",taskId)).query().listOfRows();return Map.of("task",task,"items",items);}
    @PostMapping("/imports/{taskId}/add-to-cart") @Transactional Map<String,Object> addImportToCart(@PathVariable long taskId){authorization.require("purchase:manage");int owned=jdbc.sql("SELECT COUNT(*) FROM purchase_import_task WHERE id=:id AND user_id=:userId").params(Map.of("id",taskId,"userId",userId())).query(Integer.class).single();if(owned==0)throw new IllegalArgumentException("导入任务不存在");var rows=jdbc.sql("SELECT sku_id AS skuId,quantity FROM purchase_import_item WHERE task_id=:taskId AND status='VALID'").param("taskId",taskId).query().listOfRows();if(rows.isEmpty())throw new IllegalArgumentException("没有可加入购物车的有效商品");var result=addRowsToCart(rows);jdbc.sql("UPDATE purchase_import_task SET status='ADDED' WHERE id=:id").param("id",taskId).update();return result;}

    @PutMapping("/imports/{taskId}/items/{itemId}") @Transactional
    Map<String,Object> updateImportItem(@PathVariable long taskId,@PathVariable long itemId,@Valid @RequestBody ImportItemRequest request){authorization.require("purchase:manage");requireImportOwner(taskId);var row=jdbc.sql("SELECT sku_id AS skuId FROM purchase_import_item WHERE id=:itemId AND task_id=:taskId").params(Map.of("itemId",itemId,"taskId",taskId)).query().singleRow();if(row.get("skuId")==null)throw new IllegalArgumentException("未识别的 SKU 不能修改数量");long skuId=((Number)row.get("skuId")).longValue();int stock=jdbc.sql("SELECT stock-reserved_stock FROM product_sku WHERE id=:id AND status=1 AND deleted_at IS NULL").param("id",skuId).query(Integer.class).optional().orElse(0);String status=stock>=request.quantity()?"VALID":"INVALID";String message=stock>=request.quantity()?null:"库存不足，可售库存 "+Math.max(stock,0);jdbc.sql("UPDATE purchase_import_item SET quantity=:quantity,status=:status,error_message=:message WHERE id=:itemId AND task_id=:taskId").param("quantity",request.quantity()).param("status",status).param("message",message).param("itemId",itemId).param("taskId",taskId).update();refreshImportCounts(taskId);return importTask(taskId);}

    @DeleteMapping("/imports/{taskId}/items/{itemId}") @Transactional
    Map<String,Object> deleteImportItem(@PathVariable long taskId,@PathVariable long itemId){authorization.require("purchase:manage");requireImportOwner(taskId);int changed=jdbc.sql("DELETE FROM purchase_import_item WHERE id=:itemId AND task_id=:taskId").params(Map.of("itemId",itemId,"taskId",taskId)).update();if(changed==0)throw new IllegalArgumentException("导入明细不存在");refreshImportCounts(taskId);return importTask(taskId);}

    @GetMapping("/imports/{taskId}/errors.xlsx") void exportImportErrors(@PathVariable long taskId,HttpServletResponse response)throws IOException{authorization.require("purchase:view");requireImportOwner(taskId);var rows=jdbc.sql("SELECT source_row AS rowNumber,sku_code AS skuCode,quantity,error_message AS errorMessage FROM purchase_import_item WHERE task_id=:taskId AND status='INVALID' ORDER BY source_row").param("taskId",taskId).query().listOfRows();writeWorkbook(response,"导入错误明细.xlsx",List.of("原始行号","SKU编码","采购数量","错误原因"),rows.stream().map(r->java.util.Arrays.asList(r.get("rowNumber"),r.get("skuCode"),r.get("quantity"),r.get("errorMessage"))).toList());}

    @GetMapping("/imports/{taskId}/quotation.xlsx") void exportQuotation(@PathVariable long taskId,HttpServletResponse response)throws IOException{authorization.require("purchase:view");requireImportOwner(taskId);var rows=jdbc.sql("""
      SELECT i.sku_code AS skuCode,p.title,i.quantity,s.market_price AS marketPrice,s.member_price AS memberPrice,
       COALESCE((SELECT MIN(ai.agreement_price) FROM agreement_item ai JOIN agreement a ON a.id=ai.agreement_id WHERE ai.sku_id=s.id AND ai.status=1 AND ai.deleted_at IS NULL AND a.enterprise_id=:enterpriseId AND a.status=1 AND a.deleted_at IS NULL AND CURRENT_DATE BETWEEN a.effective_date AND a.expiry_date),s.member_price) AS salePrice
      FROM purchase_import_item i JOIN product_sku s ON s.id=i.sku_id JOIN product_spu p ON p.id=s.spu_id WHERE i.task_id=:taskId AND i.status='VALID' ORDER BY i.source_row
      """).params(Map.of("taskId",taskId,"enterpriseId",enterpriseId())).query().listOfRows();writeWorkbook(response,"采购报价单.xlsx",List.of("SKU编码","商品名称","数量","市场价","会员价","当前采购价","小计"),rows.stream().map(r->List.of(r.get("skuCode"),r.get("title"),r.get("quantity"),r.get("marketPrice"),r.get("memberPrice"),r.get("salePrice"),new java.math.BigDecimal(String.valueOf(r.get("salePrice"))).multiply(new java.math.BigDecimal(String.valueOf(r.get("quantity")))))).toList());}

    private void requireImportOwner(long taskId){int count=jdbc.sql("SELECT COUNT(*) FROM purchase_import_task WHERE id=:id AND user_id=:userId").params(Map.of("id",taskId,"userId",userId())).query(Integer.class).single();if(count==0)throw new IllegalArgumentException("导入任务不存在");}
    private void refreshImportCounts(long taskId){jdbc.sql("UPDATE purchase_import_task t SET total_rows=(SELECT COUNT(*) FROM purchase_import_item i WHERE i.task_id=t.id),valid_rows=(SELECT COUNT(*) FROM purchase_import_item i WHERE i.task_id=t.id AND i.status='VALID'),invalid_rows=(SELECT COUNT(*) FROM purchase_import_item i WHERE i.task_id=t.id AND i.status='INVALID'),status='PARSED' WHERE t.id=:id").param("id",taskId).update();}
    private void writeWorkbook(HttpServletResponse response,String fileName,List<String> headers,List<List<Object>> rows)throws IOException{response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");response.setHeader("Content-Disposition","attachment; filename*=UTF-8''"+URLEncoder.encode(fileName,StandardCharsets.UTF_8));try(var workbook=new XSSFWorkbook()){var sheet=workbook.createSheet("数据");var header=sheet.createRow(0);for(int i=0;i<headers.size();i++)header.createCell(i).setCellValue(headers.get(i));for(int r=0;r<rows.size();r++){var sheetRow=sheet.createRow(r+1);for(int c=0;c<rows.get(r).size();c++){Object value=rows.get(r).get(c);var cell=sheetRow.createCell(c);if(value instanceof Number number)cell.setCellValue(number.doubleValue());else cell.setCellValue(value==null?"":String.valueOf(value));}}for(int i=0;i<headers.size();i++)sheet.setColumnWidth(i,i==1?12000:4500);workbook.write(response.getOutputStream());}}

    private Map<String,Object> addRowsToCart(List<Map<String,Object>> rows){int added=0;List<Long> skipped=new ArrayList<>();for(var row:rows){long skuId=((Number)row.get("skuId")).longValue();int quantity=((Number)row.get("quantity")).intValue();if(quantity<1){skipped.add(skuId);continue;}var existing=jdbc.sql("SELECT id FROM cart_item WHERE user_id=:userId AND sku_id=:skuId AND solution_id IS NULL ORDER BY id LIMIT 1").params(Map.of("userId",userId(),"skuId",skuId)).query(Long.class).optional();if(existing.isPresent())jdbc.sql("UPDATE cart_item c JOIN product_sku s ON s.id=c.sku_id SET c.quantity=LEAST(c.quantity+:quantity,s.stock-s.reserved_stock),c.selected=1 WHERE c.id=:id").param("quantity",quantity).param("id",existing.get()).update();else jdbc.sql("INSERT INTO cart_item(user_id,sku_id,quantity,selected) VALUES(:userId,:skuId,:quantity,1)").param("userId",userId()).param("skuId",skuId).param("quantity",quantity).update();added++;}return Map.of("addedKinds",added,"skippedSkuIds",skipped);}
    private void requireSku(long skuId){int count=jdbc.sql("SELECT COUNT(*) FROM product_sku s JOIN product_spu p ON p.id=s.spu_id WHERE s.id=:id AND s.status=1 AND p.status=1 AND s.deleted_at IS NULL AND p.deleted_at IS NULL").param("id",skuId).query(Integer.class).single();if(count==0)throw new IllegalArgumentException("商品不存在或已下架");}
    private long userId(){return auth.current().userId();}private long enterpriseId(){return auth.current().enterpriseId();}
    record FrequentRequest(@NotNull Long skuId,@Min(1) @Max(9999) int quantity,String remark){}record SelectionRequest(List<Long> skuIds){}record ImportItemRequest(@Min(1) @Max(9999) int quantity){}
}
