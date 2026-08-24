package cn.govproc.supplychain.config;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class CollectJobExecutorConfig {
    @Bean(name = "collectJobExecutor")
    Executor collectJobExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("collect-job-");
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(50);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
