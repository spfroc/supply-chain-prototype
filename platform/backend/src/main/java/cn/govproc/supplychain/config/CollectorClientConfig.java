package cn.govproc.supplychain.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class CollectorClientConfig {
    @Bean
    RestClient collectorRestClient(@Value("${app.collector-url:}") String collectorUrl) {
        var httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        var factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(180));
        var builder = RestClient.builder().requestFactory(factory);
        if (collectorUrl != null && !collectorUrl.isBlank()) {
            builder.baseUrl(collectorUrl.trim());
        }
        return builder.build();
    }
}
