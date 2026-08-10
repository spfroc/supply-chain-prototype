package cn.govproc.supplychain.common;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Component;

@Component
public class RichTextSanitizer {
    private static final Safelist POLICY = Safelist.relaxed()
        .addTags("figure", "figcaption", "video", "source", "iframe")
        .addAttributes(":all", "class")
        .addAttributes("a", "target", "title")
        .addAttributes("img", "width", "height", "loading")
        .addAttributes("video", "controls", "poster", "width", "height", "preload")
        .addAttributes("source", "src", "type")
        .addAttributes("iframe", "src", "width", "height", "frameborder", "allow", "allowfullscreen", "title")
        .addProtocols("img", "src", "http", "https", "data")
        .addProtocols("video", "src", "http", "https")
        .addProtocols("video", "poster", "http", "https", "data")
        .addProtocols("source", "src", "http", "https")
        .addProtocols("iframe", "src", "https")
        .addEnforcedAttribute("a", "rel", "noopener noreferrer")
        .preserveRelativeLinks(true);

    public String clean(String html) {
        if (html == null || html.isBlank()) return "";
        Document.OutputSettings output = new Document.OutputSettings().prettyPrint(false);
        return Jsoup.clean(html, "", POLICY, output);
    }

    public List<Map<String, Object>> cleanRows(List<Map<String, Object>> rows, String... fields) {
        return rows.stream().map(row -> {
            Map<String, Object> copy = new LinkedHashMap<>(row);
            for (String field : fields) {
                Object value = copy.get(field);
                if (value instanceof String html) copy.put(field, clean(html));
            }
            return copy;
        }).toList();
    }

    public PageResult<Map<String, Object>> cleanPage(PageResult<Map<String, Object>> page, String... fields) {
        return new PageResult<>(cleanRows(page.records(), fields), page.total(), page.page(), page.pageSize());
    }
}
