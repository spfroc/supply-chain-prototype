package cn.govproc.supplychain.business;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.ObjectMetadata;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.InputStreamResource;
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
    private static final Logger log = LoggerFactory.getLogger(ProductImageController.class);
    private static final Set<String> CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private final Path uploadDirectory;
    private final OSS ossClient;
    private final String ossBucket;
    private final String ossPublicUrl;
    private final String ossObjectPrefix;

    public ProductImageController(
        @Value("${app.upload-dir:/app/uploads}") String uploadDirectory,
        @Value("${app.oss.endpoint:}") String ossEndpoint,
        @Value("${app.oss.bucket:}") String ossBucket,
        @Value("${app.oss.access-key-id:}") String ossAccessKeyId,
        @Value("${app.oss.access-key-secret:}") String ossAccessKeySecret,
        @Value("${app.oss.public-url:}") String ossPublicUrl,
        @Value("${app.oss.object-prefix:supply-chain/}") String ossObjectPrefix,
        @Value("${app.oss.migrate-local-on-start:false}") boolean migrateLocalOnStart
    ) throws IOException {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDirectory);
        this.ossBucket = ossBucket.trim();
        this.ossObjectPrefix = normalizePrefix(ossObjectPrefix);
        this.ossPublicUrl = normalizePublicUrl(ossPublicUrl, this.ossBucket, ossEndpoint);
        this.ossClient = isConfigured(ossEndpoint, this.ossBucket, ossAccessKeyId, ossAccessKeySecret)
            ? new OSSClientBuilder().build(ossEndpoint.trim(), ossAccessKeyId.trim(), ossAccessKeySecret.trim())
            : null;
        if (migrateLocalOnStart && this.ossClient != null) migrateLocalImages();
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
            case "contentIcon" -> new ImageProfile(128, 128, 1024, 1024, 1.0, 2);
            case "qr" -> new ImageProfile(300, 300, 2000, 2000, 1.0, 2);
            case "solutionMobile" -> new ImageProfile(720, 1280, 2160, 3840, 9.0 / 16.0, 5);
            case "adWeb" -> new ImageProfile(800, 160, 6000, 3000, 0, 8);
            case "adH5" -> new ImageProfile(600, 240, 3000, 4000, 0, 8);
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
            throw new IllegalArgumentException("当前图片为" + width + "×" + height
                + "像素；要求宽高在" + profile.minWidth() + "×" + profile.minHeight()
                + "至" + profile.maxWidth() + "×" + profile.maxHeight() + "像素之间");
        double ratio = (double) width / height;
        if (profile.ratio() > 0 && Math.abs(ratio - profile.ratio()) / profile.ratio() > 0.03)
            throw new IllegalArgumentException("当前图片比例为" + String.format("%.2f:1", ratio)
                + "；要求比例为" + ratioLabel(profile.ratio()) + "，允许3%误差");

        String extension = "image/png".equals(file.getContentType()) ? ".png" : ".jpg";
        String filename = UUID.randomUUID() + extension;
        if (ossClient != null) {
            try {
                String objectKey = ossObjectPrefix + "images/" + filename;
                ObjectMetadata metadata = new ObjectMetadata();
                metadata.setContentType(file.getContentType());
                metadata.setContentLength(file.getSize());
                metadata.setCacheControl("public, max-age=31536000, immutable");
                ossClient.putObject(ossBucket, objectKey, file.getInputStream(), metadata);
                return Map.of(
                    "url", "/api/public/uploads/images/" + filename,
                    "width", width,
                    "height", height,
                    "size", file.getSize(),
                    "storage", "OSS"
                );
            } catch (OSSException exception) {
                log.warn("OSS upload failed, storing locally: {}", exception.getErrorMessage());
            }
        }
        Path target = uploadDirectory.resolve(filename).normalize();
        if (!target.getParent().equals(uploadDirectory)) throw new IllegalArgumentException("非法文件名");
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return Map.of(
            "url", "/api/public/uploads/images/" + filename,
            "width", width,
            "height", height,
            "size", file.getSize(),
            "storage", "LOCAL"
        );
    }

    private boolean isConfigured(String... values) {
        for (String value : values) if (value == null || value.isBlank()) return false;
        return true;
    }

    private String normalizePrefix(String value) {
        String prefix = value == null ? "" : value.trim().replace('\\', '/');
        while (prefix.startsWith("/")) prefix = prefix.substring(1);
        return prefix.isEmpty() || prefix.endsWith("/") ? prefix : prefix + "/";
    }

    private String normalizePublicUrl(String value, String bucket, String endpoint) {
        String url = value == null ? "" : value.trim();
        if (url.isEmpty() && !bucket.isEmpty() && endpoint != null && !endpoint.isBlank()) {
            String serviceEndpoint = endpoint.trim().replaceFirst("^https?://", "");
            url = "https://" + bucket + "." + serviceEndpoint;
        }
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private void migrateLocalImages() throws IOException {
        int uploaded = 0;
        int skipped = 0;
        try (var paths = Files.list(uploadDirectory)) {
            for (Path path : paths.filter(Files::isRegularFile).toList()) {
                String objectKey = ossObjectPrefix + "images/" + path.getFileName();
                if (ossClient.doesObjectExist(ossBucket, objectKey)) {
                    skipped++;
                    continue;
                }
                ObjectMetadata metadata = new ObjectMetadata();
                String contentType = Files.probeContentType(path);
                metadata.setContentType(contentType == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : contentType);
                metadata.setContentLength(Files.size(path));
                metadata.setCacheControl("public, max-age=31536000, immutable");
                try (var input = Files.newInputStream(path)) {
                    ossClient.putObject(ossBucket, objectKey, input, metadata);
                }
                uploaded++;
            }
        }
        log.info("OSS local image migration completed: uploaded={}, skipped={}, source={}", uploaded, skipped, uploadDirectory);
    }

    @PreDestroy
    void closeOssClient() {
        if (ossClient != null) ossClient.shutdown();
    }

    private record ImageProfile(
        int minWidth, int minHeight, int maxWidth, int maxHeight, double ratio, int maxMegabytes
    ) {}

    private String ratioLabel(double ratio) {
        if (Math.abs(ratio - 1) < 0.01) return "1:1";
        if (Math.abs(ratio - 3) < 0.01) return "3:1";
        if (Math.abs(ratio - 16.0 / 9.0) < 0.01) return "16:9";
        if (Math.abs(ratio - 9.0 / 16.0) < 0.01) return "9:16";
        return String.format("%.2f:1", ratio);
    }

    @GetMapping("/public/uploads/images/{filename:.+}")
    ResponseEntity<Resource> image(@PathVariable String filename) throws IOException {
        if (!filename.matches("[0-9a-fA-F-]+\\.(jpg|png)")) return ResponseEntity.notFound().build();
        if (ossClient != null) {
            String objectKey = ossObjectPrefix + "images/" + filename;
            try {
                var object = ossClient.getObject(ossBucket, objectKey);
                String contentType = object.getObjectMetadata().getContentType();
                return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable())
                    .contentLength(object.getObjectMetadata().getContentLength())
                    .contentType(contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType))
                    .body(new InputStreamResource(object.getObjectContent()));
            } catch (OSSException exception) {
                if (!"NoSuchKey".equals(exception.getErrorCode())) {
                    log.warn("OSS download failed, trying local file: {}", exception.getErrorMessage());
                }
            }
        }
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
