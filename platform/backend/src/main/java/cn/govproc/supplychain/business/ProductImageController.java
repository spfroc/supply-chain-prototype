package cn.govproc.supplychain.business;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ProductImageController {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final int MIN_SIDE = 600;
    private static final int MAX_SIDE = 3000;
    private static final Set<String> CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private final Path uploadDirectory;

    public ProductImageController(@Value("${app.upload-dir:/app/uploads}") String uploadDirectory) throws IOException {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDirectory);
    }

    @PostMapping("/admin/business/uploads/images")
    Map<String, Object> upload(@RequestParam MultipartFile file, @RequestParam(defaultValue = "gallery") String kind)
        throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("请选择图片文件");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("图片不能超过5MB");
        if (!CONTENT_TYPES.contains(file.getContentType())) throw new IllegalArgumentException("仅支持 JPG、PNG 图片");

        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null) throw new IllegalArgumentException("无法识别图片内容");
        int width = image.getWidth(), height = image.getHeight();
        if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE)
            throw new IllegalArgumentException("图片宽高须在600至3000像素之间");
        double ratio = (double) width / height;
        if (Math.abs(ratio - 1.0) > 0.03)
            throw new IllegalArgumentException(("main".equals(kind) ? "商品主图" : "商品配图") + "须为1:1正方形");

        String extension = "image/png".equals(file.getContentType()) ? ".png" : ".jpg";
        String filename = UUID.randomUUID() + extension;
        Path target = uploadDirectory.resolve(filename).normalize();
        if (!target.getParent().equals(uploadDirectory)) throw new IllegalArgumentException("非法文件名");
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return Map.of(
            "url", "/api/public/uploads/images/" + filename,
            "width", width,
            "height", height,
            "size", file.getSize()
        );
    }

    @GetMapping("/public/uploads/images/{filename:.+}")
    ResponseEntity<Resource> image(@PathVariable String filename) throws IOException {
        Path file = uploadDirectory.resolve(filename).normalize();
        if (!file.getParent().equals(uploadDirectory) || !Files.isRegularFile(file))
            return ResponseEntity.notFound().build();
        String type = Files.probeContentType(file);
        Resource resource = new UrlResource(file.toUri());
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noCache())
            .contentType(type == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(type))
            .body(resource);
    }
}
