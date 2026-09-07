package cn.govproc.supplychain.common;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ProblemDetail responseStatus(ResponseStatusException exception) {
        var reason = exception.getReason();
        var detail = ProblemDetail.forStatusAndDetail(exception.getStatusCode(),
            reason == null || reason.isBlank() ? "请求无法完成" : reason);
        detail.setTitle("请求无法完成");
        return detail;
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    ProblemDetail validation(Exception exception) {
        String message="请检查填写内容";
        if(exception instanceof MethodArgumentNotValidException validation&&validation.getBindingResult().hasErrors()) {
            var error=validation.getBindingResult().getFieldErrors().getFirst();
            message=switch(error.getField()) {
                case "password" -> "登录密码需为8至72位";
                case "creditCode" -> "请输入正确的18位统一社会信用代码";
                case "phone","contactPhone" -> "请输入正确的11位手机号码";
                case "email" -> "请输入正确的邮箱地址";
                default -> error.getDefaultMessage()==null?message:error.getDefaultMessage();
            };
        } else if(exception instanceof ConstraintViolationException violation&&!violation.getConstraintViolations().isEmpty()) {
            message=violation.getConstraintViolations().iterator().next().getMessage();
        }
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, message);
        detail.setTitle("填写内容有误");
        return detail;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception exception) {
        var detail=ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,"系统暂时无法完成请求，请稍后重试");
        detail.setTitle("操作失败");
        return detail;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail conflict(DataIntegrityViolationException exception) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "数据冲突或仍被其他业务引用");
        detail.setTitle("无法完成操作");
        return detail;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail businessRule(IllegalArgumentException exception) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        detail.setTitle("业务操作无法完成");
        return detail;
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail uploadTooLarge(MaxUploadSizeExceededException exception) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE,
            "上传文件超过服务器10MB上限，请压缩图片后重试");
        detail.setTitle("上传文件过大");
        return detail;
    }
}
