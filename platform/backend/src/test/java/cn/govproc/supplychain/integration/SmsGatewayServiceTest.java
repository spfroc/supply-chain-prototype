package cn.govproc.supplychain.integration;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class SmsGatewayServiceTest {
    @Test
    void sendsDocumentedPayloadAndSignature() throws Exception {
        var received=new AtomicReference<Map<String,Object>>();
        var server=HttpServer.create(new InetSocketAddress(0),0);
        server.createContext("/prod-api/source/httpd/submitSms",exchange->{
            received.set(new ObjectMapper().readValue(exchange.getRequestBody(),Map.class));
            byte[] body="{\"code\":0,\"msg\":\"\",\"data\":{\"taskId\":\"T1\",\"failList\":[]}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);
            exchange.getResponseBody().write(body);exchange.close();
        });
        server.start();
        try {
            var sms=new SmsGatewayService(RestClient.builder(),"http://127.0.0.1:"+server.getAddress().getPort(),"100078","10690","secret","unix");
            var response=sms.send("18698853145","接口测试");
            assertEquals(0,((Number)response.get("code")).intValue());
            var payload=received.get();String timestamp=String.valueOf(payload.get("timestamp"));
            assertEquals("100078",payload.get("spId"));assertEquals("10690",payload.get("accessCode"));
            assertEquals("18698853145",payload.get("mobile"));assertEquals(10,timestamp.length());
            String expected=HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(("100078"+timestamp+"secret").getBytes(StandardCharsets.UTF_8)));
            assertEquals(expected,payload.get("sign"));
        } finally { server.stop(0); }
    }

    @Test void rejectsInvalidMobileBeforeCallingGateway(){
        var sms=new SmsGatewayService(RestClient.builder(),"http://127.0.0.1:1","100078","10690","secret","unix");
        assertThrows(IllegalArgumentException.class,()->sms.send("123","测试"));
    }
}
