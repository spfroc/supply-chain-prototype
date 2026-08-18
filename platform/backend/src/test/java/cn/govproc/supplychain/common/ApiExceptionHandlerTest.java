package cn.govproc.supplychain.common;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ApiExceptionHandlerTest {
    @Test
    void exposesResponseStatusReasonAsProblemDetail() {
        var result = new ApiExceptionHandler().responseStatus(
            new ResponseStatusException(HttpStatus.FORBIDDEN,
                "账号正在审核中，请等待平台管理员审核通过后登录"));

        assertEquals(HttpStatus.FORBIDDEN.value(), result.getStatus());
        assertEquals("账号正在审核中，请等待平台管理员审核通过后登录", result.getDetail());
    }
}
