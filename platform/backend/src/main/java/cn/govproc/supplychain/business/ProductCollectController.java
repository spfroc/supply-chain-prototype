package cn.govproc.supplychain.business;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/business")
public class ProductCollectController {
    private final CollectJobService jobs;

    public ProductCollectController(CollectJobService jobs) {
        this.jobs = jobs;
    }

    @PostMapping("/products/collect")
    Map<String, Object> collect(@Valid @RequestBody CollectRequest request, HttpServletRequest http,
                                Principal principal) {
        return jobs.runSingle(request.url().trim(), request.platform(), request.memberPrice(),
            http.getHeader("Authorization"), principal == null ? null : principal.getName());
    }

    public record CollectRequest(@NotBlank String url, String platform, Double memberPrice) {}
}
