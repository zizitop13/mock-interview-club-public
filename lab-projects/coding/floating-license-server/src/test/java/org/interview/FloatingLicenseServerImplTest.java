package org.interview;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class FloatingLicenseServerImplTest {

	static final int EXPIRE_AFTER_SECONDS = 1;
	static final int DEFAULT_LICENSE_NUMBER = 1;
	static final Clock CLOCK = Mockito.mock(Clock.class);

	LicenseServer licenseServer = new FloatingLicenseServerImpl(DEFAULT_LICENSE_NUMBER, CLOCK, EXPIRE_AFTER_SECONDS);
	Instant now;

	@BeforeEach
	void setUp() {
		now = Instant.now();
		Mockito.when(CLOCK.instant()).thenReturn(now);
	}

	@Test
	void obtainLicense() {
		assertThat(licenseServer.obtainLicense("test")).isTrue();
	}

	@Test
	void obtainLicenseAndPing() {
		assertThat(licenseServer.obtainLicense("test")).isTrue();
		assertThat(licenseServer.pingLicense("test")).isTrue();
	}

	@Test
	void obtainLicenseAndRelease() {
		assertThat(licenseServer.obtainLicense("test")).isTrue();
		assertThat(licenseServer.releaseLicense("test")).isTrue();
	}

	@Test
	void licenseNumberCannotBeLessOrEqualZero() {
		assertThatExceptionOfType(IllegalArgumentException.class)
				.isThrownBy(() -> licenseServer = new FloatingLicenseServerImpl(0));
		assertThatExceptionOfType(IllegalArgumentException.class)
				.isThrownBy(() -> licenseServer = new FloatingLicenseServerImpl(-1));
	}

	@Test
	void obtainLicense_exceedLicensesExpectedFalse() {
		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.obtainLicense("test2")).isFalse();
	}

	@Test
	void obtainReleasedLicense() {
		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.releaseLicense("test1")).isTrue();
		assertThat(licenseServer.obtainLicense("test2")).isTrue();
	}

	@Test
	void releaseTwice_expectedFalse() {
		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.releaseLicense("test1")).isTrue();
		assertThat(licenseServer.releaseLicense("test1")).isFalse();
	}

	@Test
	void obtainTwiceIsIdempotent() {
		licenseServer = new FloatingLicenseServerImpl(2);

		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.obtainLicense("test2")).isTrue();
	}

	@Test
	void pingObtained() {
		licenseServer.obtainLicense("test1");

		assertThat(licenseServer.pingLicense("test1")).isTrue();
	}

	@Test
	void pingUnobtained() {
		assertThat(licenseServer.pingLicense("test2")).isFalse();
	}

	@Test
	void obtainExpiredLicense() {
		licenseServer.obtainLicense("test1");
		Mockito.when(CLOCK.instant()).thenReturn(now.plusSeconds(2));

		assertThat(licenseServer.obtainLicense("test2")).isTrue();
	}

	@Test
	void obtainExpiredLicenseForSameUserCreatesANewActiveSession() {
		licenseServer.obtainLicense("test1");
		Mockito.when(CLOCK.instant()).thenReturn(now.plusSeconds(2));

		assertThat(licenseServer.obtainLicense("test1")).isTrue();
		assertThat(licenseServer.obtainLicense("test2")).isFalse();
	}

	@Test
	void pingExpiredLicenseReturnsFalseAndFreesCapacity() {
		licenseServer.obtainLicense("test1");
		Mockito.when(CLOCK.instant()).thenReturn(now.plusSeconds(2));

		assertThat(licenseServer.pingLicense("test1")).isFalse();
		assertThat(licenseServer.obtainLicense("test2")).isTrue();
	}

	@Test
	void tryToObtainPinkedLicense() {
		licenseServer.obtainLicense("test1");
		Mockito.when(CLOCK.instant()).thenReturn(now.plusMillis(500));
		licenseServer.pingLicense("test1");
		Mockito.when(CLOCK.instant()).thenReturn(now.plusMillis(1200));

		assertThat(licenseServer.obtainLicense("test2")).isFalse();
	}

	@RepeatedTest(value = 1000, failureThreshold = 1)
	void obtainLicenseConcurrentlyAndAfterPing() throws Exception {
		ExecutorService executorService = Executors.newFixedThreadPool(2);
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		CountDownLatch finished = new CountDownLatch(2);
		List<Boolean> results;

		try {
			Future<Boolean> first = executorService.submit(() -> {
				boolean res = obtainLicenseAfterSignal(ready, start, "test1");
				finished.countDown();
				return res;
			});
			Future<Boolean> second = executorService.submit(() -> {
				boolean res = obtainLicenseAfterSignal(ready, start, "test2");
				finished.countDown();
				return res;
			});

			ready.await();
			start.countDown();

			Future<Boolean> secondRetry = executorService.submit(() -> {
				finished.await();
				Mockito.when(CLOCK.instant()).thenReturn(now.plusSeconds(2));
				licenseServer.pingLicense("test1");
				return licenseServer.obtainLicense("test2");
			});

			results = List.of(first.get(), second.get(), secondRetry.get());
		} finally {
			executorService.shutdown();
		}

		assertThat(results).contains(true, false, true);
	}

	private boolean obtainLicenseAfterSignal(CountDownLatch ready, CountDownLatch start, String userId)
			throws InterruptedException {
		ready.countDown();
		start.await();
		return licenseServer.obtainLicense(userId);
	}
}
