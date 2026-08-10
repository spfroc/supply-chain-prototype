package cn.govproc.supplychain.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RichTextSanitizerTest {
    private final RichTextSanitizer sanitizer = new RichTextSanitizer();

    @Test
    void removesScriptsEventsAndUnsafeProtocols() {
        String cleaned = sanitizer.clean("""
            <h2 onclick="alert(1)">商品说明</h2>
            <script>alert(2)</script>
            <img src="javascript:alert(3)" onerror="alert(4)">
            <a href="javascript:alert(5)">危险链接</a>
            """);

        assertThat(cleaned)
            .contains("<h2>商品说明</h2>")
            .doesNotContain("script", "onclick", "onerror", "javascript:");
    }

    @Test
    void keepsSupportedImagesLinksAndNetworkVideo() {
        String cleaned = sanitizer.clean("""
            <p><img src="https://img.example.com/product.jpg" alt="商品图" loading="lazy"></p>
            <a href="https://example.com/manual" target="_blank">说明书</a>
            <video controls poster="/uploads/poster.jpg"><source src="https://cdn.example.com/demo.mp4" type="video/mp4"></video>
            <iframe src="https://video.example.com/embed/1" allowfullscreen title="演示"></iframe>
            """);

        assertThat(cleaned)
            .contains("https://img.example.com/product.jpg", "noopener noreferrer")
            .contains("<video", "https://cdn.example.com/demo.mp4")
            .contains("<iframe", "https://video.example.com/embed/1");
    }
}
