package cn.govproc.supplychain.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RichTextSanitizerTest {
    private final RichTextSanitizer sanitizer = new RichTextSanitizer();

    @Test
    void preservesRootRelativeImageSources() {
        String html = "<img src=\"/api/public/uploads/images/product.jpg\" alt=\"商品图\" loading=\"lazy\">";

        assertThat(sanitizer.clean(html))
            .isEqualTo("<img src=\"/api/public/uploads/images/product.jpg\" alt=\"商品图\" loading=\"lazy\">");
    }

    @Test
    void removesUnsafeImageSources() {
        String html = "<img src=\"javascript:alert(1)\" alt=\"bad\">";

        assertThat(sanitizer.clean(html)).isEqualTo("<img alt=\"bad\">");
    }
}
