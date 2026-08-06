package cn.govproc.supplychain.agreement;

import cn.govproc.supplychain.common.PageSupport;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/agreements/{agreementId}/items")
public class AgreementItemController {
    private final JdbcClient jdbc;

    public AgreementItemController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    Object list(@PathVariable long agreementId,@RequestParam(required=false) Integer page,
                @RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword,
                @RequestParam(required=false) Integer status) {
        String base="""
            SELECT ai.id, ai.agreement_id AS agreementId, ai.sku_id AS skuId, p.title,
                   s.sku_code AS skuCode, s.market_price AS marketPrice,
                   ai.agreement_price AS agreementPrice, ai.status, ai.updated_at AS updatedAt
            FROM agreement_item ai
            JOIN product_sku s ON s.id = ai.sku_id
            JOIN product_spu p ON p.id = s.spu_id
            WHERE ai.agreement_id = :agreementId AND ai.deleted_at IS NULL
            """;
        var params=Map.of("agreementId",agreementId);
        if(page==null) return jdbc.sql(base+" ORDER BY id DESC").params(params).query().listOfRows();
        return PageSupport.query(jdbc,base,"q.id DESC",params,page,pageSize,keyword,status,
          List.of("title","skuCode"),"status");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    Map<String, Object> add(@PathVariable long agreementId, @Valid @RequestBody SaveItem request) {
        jdbc.sql("""
            INSERT INTO agreement_item (agreement_id, sku_id, agreement_price, status)
            VALUES (:agreementId, :skuId, :price, 1)
            ON DUPLICATE KEY UPDATE agreement_price = VALUES(agreement_price),
              status = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
            """).param("agreementId", agreementId).param("skuId", request.skuId())
            .param("price", request.agreementPrice()).update();
        return Map.of("agreementId", agreementId, "skuId", request.skuId(), "agreementPrice", request.agreementPrice());
    }

    @PutMapping("/{itemId}")
    @Transactional
    Map<String, Object> update(@PathVariable long agreementId, @PathVariable long itemId,
                               @Valid @RequestBody UpdatePrice request) {
        int changed = jdbc.sql("""
            UPDATE agreement_item SET agreement_price = :price, updated_at = CURRENT_TIMESTAMP
            WHERE id = :itemId AND agreement_id = :agreementId AND deleted_at IS NULL
            """).param("price", request.agreementPrice()).param("itemId", itemId)
            .param("agreementId", agreementId).update();
        return Map.of("updated", changed == 1, "itemId", itemId, "agreementPrice", request.agreementPrice());
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    void remove(@PathVariable long agreementId, @PathVariable long itemId) {
        jdbc.sql("""
            UPDATE agreement_item SET deleted_at = CURRENT_TIMESTAMP, status = 0
            WHERE id = :itemId AND agreement_id = :agreementId AND deleted_at IS NULL
            """).param("itemId", itemId).param("agreementId", agreementId).update();
    }

    public record SaveItem(@NotNull Long skuId,
                           @NotNull @DecimalMin(value = "0.00") BigDecimal agreementPrice) {}
    public record UpdatePrice(@NotNull @DecimalMin(value = "0.00") BigDecimal agreementPrice) {}
}
