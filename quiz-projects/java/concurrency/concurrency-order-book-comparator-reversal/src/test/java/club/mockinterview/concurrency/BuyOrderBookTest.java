package club.mockinterview.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class BuyOrderBookTest {
    @Test
    void reversingTheWholeChainMakesTheLaterSequenceWinAPriceTie() {
        BuyOrderBook book = new BuyOrderBook();
        book.submit(order("earlier", 105, 41));
        book.submit(order("later", 105, 42));

        assertEquals("later", book.next().orderId());
    }

    @Test
    void reversingOnlyPricePreservesPriceTimePriority() {
        BuyOrderBook book = BuyOrderBook.withPriceTimePriority();
        book.submit(order("lower-price", 100, 1));
        book.submit(order("later-high-price", 105, 42));
        book.submit(order("earlier-high-price", 105, 41));

        assertEquals("earlier-high-price", book.next().orderId());
        assertEquals("later-high-price", book.next().orderId());
        assertEquals("lower-price", book.next().orderId());
    }

    private static BuyOrderBook.Order order(
            String orderId,
            long priceMicros,
            long sequence) {
        return new BuyOrderBook.Order(orderId, priceMicros, sequence);
    }
}
