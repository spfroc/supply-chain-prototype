package cn.govproc.supplychain.integration;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class SmsGatewayService {
    private final RestClient client;
    private final String baseUrl,spId,accessCode,password,timestampFormat;

    public SmsGatewayService(RestClient.Builder builder,
      @Value("${app.sms.base-url:}") String baseUrl,@Value("${app.sms.sp-id:}") String spId,
      @Value("${app.sms.access-code:}") String accessCode,@Value("${app.sms.password:}") String password,
      @Value("${app.sms.timestamp-format:unix}") String timestampFormat) {
        this.client=builder.build();this.baseUrl=trimSlash(baseUrl);this.spId=spId.trim();
        this.accessCode=accessCode.trim();this.password=password;this.timestampFormat=timestampFormat.trim();
    }

    public Map<String,Object> send(String mobile,String content) {
        requireConfigured();
        if(mobile==null||!mobile.matches("1\\d{10}")) throw new IllegalArgumentException("请输入正确的11位手机号码");
        if(content==null||content.isBlank()) throw new IllegalArgumentException("短信内容不能为空");
        String timestamp=timestamp();
        var payload=new LinkedHashMap<String,Object>();
        payload.put("sign",sign(timestamp));payload.put("spId",spId);payload.put("timestamp",timestampValue(timestamp));
        payload.put("mobile",mobile);payload.put("accessCode",accessCode);payload.put("content",content.trim());
        Map<String,Object> response=client.post().uri(baseUrl+"/prod-api/source/httpd/submitSms")
          .contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON).body(payload).retrieve().body(Map.class);
        return validate(response,"短信发送");
    }

    public Map<String,Object> balance() {
        requireConfigured();String timestamp=timestamp();
        Map<String,Object> response=client.get().uri(baseUrl+"/prod-api/source/httpd/balance?sign="+sign(timestamp)+"&spId="+spId+"&timestamp="+timestamp)
          .accept(MediaType.APPLICATION_JSON).retrieve().body(Map.class);
        return validate(response,"短信余额查询");
    }

    private Map<String,Object> validate(Map<String,Object> response,String action) {
        if(response==null)throw new IllegalArgumentException(action+"失败：网关未返回数据");
        if(Number.class.isInstance(response.get("code"))&&((Number)response.get("code")).intValue()==0)return response;
        throw new IllegalArgumentException(action+"失败："+String.valueOf(response.getOrDefault("msg","未知网关错误")));
    }
    private void requireConfigured(){if(baseUrl.isBlank()||spId.isBlank()||accessCode.isBlank()||password.isBlank())throw new IllegalArgumentException("短信网关配置不完整");}
    private String timestamp(){return timestampFormat.equalsIgnoreCase("YmdHms")?LocalDateTime.now(ZoneId.of("Asia/Shanghai")).format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")):String.valueOf(System.currentTimeMillis()/1000);}
    private Object timestampValue(String value){return timestampFormat.equalsIgnoreCase("YmdHms")?value:Long.parseLong(value);}
    private String sign(String timestamp){try{return HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest((spId+timestamp+password).getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("无法生成短信签名",e);}}
    private static String trimSlash(String value){return value==null?"":value.trim().replaceAll("/+$","");}
}
