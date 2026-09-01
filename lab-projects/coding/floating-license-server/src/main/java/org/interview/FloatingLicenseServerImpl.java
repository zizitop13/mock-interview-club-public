package org.interview;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

import org.interview.model.LicenseSession;

public class FloatingLicenseServerImpl implements LicenseServer {

	private static final int DEFAULT_EXPIRE_AFTER_SECONDS = 60;

	private final int licenseNumber;
	private final Map<String, LicenseSession> licenseMap;
	private final Clock clock;
	private final Duration expireAfter;
	private final ReentrantLock stateLock;

	public FloatingLicenseServerImpl(int licenseNumber) {
		this(licenseNumber, Clock.systemUTC(), DEFAULT_EXPIRE_AFTER_SECONDS);
	}

	FloatingLicenseServerImpl(int licenseNumber, Clock clock, int expireAfterSeconds) {
		if (licenseNumber <= 0) {
			throw new IllegalArgumentException("licenseNumber must be greater than 0");
		}

		this.licenseNumber = licenseNumber;
		this.licenseMap = new HashMap<>(licenseNumber);
		this.clock = clock;
		this.expireAfter = Duration.ofSeconds(expireAfterSeconds);
		this.stateLock = new ReentrantLock();
	}

	@Override
	public boolean obtainLicense(String userId) {
		stateLock.lock();
		try {
			Instant now = clock.instant();
			returnExpired(now);

			if (licenseMap.containsKey(userId)) {
				return true;
			}

			if (licenseMap.size() >= licenseNumber) {
				return false;
			}

			licenseMap.put(userId, new LicenseSession(now));
			return true;
		} finally {
			stateLock.unlock();
		}
	}

	@Override
	public boolean releaseLicense(String userId) {
		stateLock.lock();
		try {
			return licenseMap.remove(userId) != null;
		} finally {
			stateLock.unlock();
		}
	}

	@Override
	public boolean pingLicense(String userId) {
		stateLock.lock();
		try {
			Instant now = clock.instant();
			LicenseSession session = licenseMap.get(userId);

			if (session == null) {
				return false;
			}

			if (session.expired(now, expireAfter)) {
				licenseMap.remove(userId);
				return false;
			}

			session.ping(now);
			return true;
		} finally {
			stateLock.unlock();
		}
	}

	private void returnExpired(Instant now) {
		licenseMap.entrySet()
				.removeIf(entry -> entry.getValue().expired(now, expireAfter));
	}
}
