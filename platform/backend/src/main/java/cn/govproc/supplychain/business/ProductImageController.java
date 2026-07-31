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
        ImageProfile profile = switch (kind) {
            case "main", "gallery" -> new ImageProfile(600, 600, 3000, 3000, 1.0, 5);
            case "brand" -> new ImageProfile(300, 300, 2000, 2000, 1.0, 2);
            case "banner" -> new ImageProfile(1200, 400, 3840, 1280, 3.0, 5);
            case "portal" -> new ImageProfile(800, 450, 3840, 2160, 16.0 / 9.0, 5);
            case "rich" -> new ImageProfile(300, 200, 3840, 3840, 0, 8);
            default -> throw new IllegalArgumentException("未知图片用途");
        };
        if (file.getSize() > profile.maxMegabytes() * 1024L * 1024L)
            throw new IllegalArgumentException("图片不能超过" + profile.maxMegabytes() + "MB");
        if (!CONTENT_TYPES.contains(file.getContentType())) throw new IllegalArgumentException("仅支持 JPG、PNG 图片");

        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null) throw new IllegalArgumentException("无法识别图片内容");
        int width = image.getWidth(), height = image.getHeight();
        if (width < profile.minWidth() || height < profile.minHeight()
            || width > profile.maxWidth() || height > profile.maxHeight())
            throw new IllegalArgumentException("图片尺寸不符合当前用途要求");
        double ratio = (double) width / height;
        if (profile.ratio() > 0 && Math.abs(ratio - profile.ratio()) / profile.ratio() > 0.03)
            throw new IllegalArgumentException("图片宽高比例不符合当前用途要求");

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

    private record ImageProfile(
        int minWidth, int minHeight, int maxWidth, int maxHeight, double ratio, int maxMegabytes
    ) {}

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
