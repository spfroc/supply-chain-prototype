package cn.govproc.supplychain.system;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class SystemController {
    @GetMapping("/status")
    Map<String, Object> status() {
        return Map.of(
            "service", "政企采购供应链平台",
            "status", "UP",
            "version", "0.1.0",
            "time", OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).toString()
        );
    }
}
