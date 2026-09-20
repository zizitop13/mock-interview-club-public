package club.mockinterview.pool;

import java.util.concurrent.CyclicBarrier;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class QuizApplication {
    public static void main(String[] args) {
        SpringApplication.run(QuizApplication.class, args);
    }

    @Bean
    CyclicBarrier outerTransactionsReady(@Value("${quiz.concurrent-requests}") int requests) {
        return new CyclicBarrier(requests);
    }
}
