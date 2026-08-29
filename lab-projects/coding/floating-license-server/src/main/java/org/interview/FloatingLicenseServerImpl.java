package org.interview;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Semaphore;

import org.interview.model.LicenseSession;

public class FloatingLicenseServerImpl implements LicenseServer {

	private static final int DEFAULT_EXPIRE_AFTER_SECONDS = 60;
	private final ConcurrentMap<String, LicenseSession> licenseMap;
	private final Clock clock;
	private final Duration expireAfterSeconds;
	private final Semaphore sessionsLimiter;

	public FloatingLicenseServerImpl(int licenseNumber) {
		this(licenseNumber, Clock.systemUTC(), DEFAULT_EXPIRE_AFTER_SECONDS);
	}

	FloatingLicenseServerImpl(int licenseNumber, Clock clock, int expireAfterSeconds) {
		if(licenseNumber <= 0){
			throw new IllegalArgumentException("licenseNumber must be greater than 0");
		}
		this.licenseMap = new ConcurrentHashMap<>(licenseNumber);
		this.clock = clock;
		this.expireAfterSeconds = Duration.ofSeconds(expireAfterSeconds);
		this.sessionsLimiter = new Semaphore(licenseNumber);
	}

	@Override
	public boolean obtainLicense(String userId) {
		if (licenseMap.containsKey(userId)) {
			return true;
		}

		Instant now = clock.instant();

		if(!sessionsLimiter.tryAcquire()){
			returnExpired(now);
			if(!sessionsLimiter.tryAcquire()){
				return false;
			}
		}

		return licenseMap.putIfAbsent(userId, new LicenseSession(now)) == null;
	}

	@Override
	public boolean releaseLicense(String userId) {
		if(licenseMap.remove(userId) != null){
			sessionsLimiter.release();
			return true;
		}
		return false;
	}

	@Override
	public boolean pingLicense(String userId) {
		if(licenseMap.containsKey(userId)) {
			licenseMap.get(userId).ping(clock.instant());
			return true;
		}
		return false;
	}

	private void returnExpired(Instant now) {
		licenseMap.entrySet()
				.removeIf(entry -> {
					if(entry.getValue().expired(now, expireAfterSeconds)){
						sessionsLimiter.release();
						return true;
					}
					return false;
				});
	}
}
