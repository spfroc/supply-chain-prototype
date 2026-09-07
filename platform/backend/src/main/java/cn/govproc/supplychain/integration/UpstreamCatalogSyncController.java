package cn.govproc.supplychain.integration;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/business/products/upstream-sync")
public class UpstreamCatalogSyncController {
    private final UpstreamCatalogSyncService service;
    public UpstreamCatalogSyncController(UpstreamCatalogSyncService service){this.service=service;}

    @PostMapping @ResponseStatus(HttpStatus.ACCEPTED)
    Map<String,Object> start(){long id=service.startFullSync();return Map.of("id",id,"status","PENDING");}

    @GetMapping("/{id}")
    Map<String,Object> status(@PathVariable long id){return service.job(id);}

    @PostMapping("/messages")
    Map<String,Object> poll(){service.pollMessages();return Map.of("processed",true);}
}
