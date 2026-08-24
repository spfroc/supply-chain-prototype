package cn.govproc.supplychain.business;

import cn.govproc.supplychain.common.PageResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/business/products")
public class CollectJobController {
    private final CollectJobService jobs;

    public CollectJobController(CollectJobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping("/collect-jobs")
    PageResult<Map<String, Object>> list(@RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "10") int pageSize,
                                         @RequestParam(defaultValue = "") String keyword,
                                         @RequestParam(required = false) String status) {
        return jobs.list(page, pageSize, keyword, status);
    }

    @GetMapping("/collect-jobs/{id}")
    Map<String, Object> detail(@PathVariable long id) {
        return jobs.get(id);
    }

    @PostMapping("/collect-jobs")
    Map<String, Object> create(@Valid @RequestBody BatchRequest request, HttpServletRequest http,
                               Principal principal) {
        return jobs.createBatch(request.items(), request.platform(),
            http.getHeader("Authorization"), principal == null ? null : principal.getName());
    }

    public record BatchRequest(String platform, @NotEmpty List<CollectJobService.ItemRequest> items) {}
}
