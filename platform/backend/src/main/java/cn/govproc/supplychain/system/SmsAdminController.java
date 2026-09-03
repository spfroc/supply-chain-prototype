package cn.govproc.supplychain.system;

import cn.govproc.supplychain.integration.SmsGatewayService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/system/sms")
public class SmsAdminController {
    private final SmsGatewayService sms;
    public SmsAdminController(SmsGatewayService sms){this.sms=sms;}

    @GetMapping("/balance") Map<String,Object> balance(){return sms.balance();}
    @PostMapping("/test") Map<String,Object> test(@Valid @RequestBody TestRequest request){
        return sms.send(request.mobile(),request.content());
    }
    public record TestRequest(@NotBlank @Pattern(regexp="1\\d{10}") String mobile,@NotBlank String content){}
}
