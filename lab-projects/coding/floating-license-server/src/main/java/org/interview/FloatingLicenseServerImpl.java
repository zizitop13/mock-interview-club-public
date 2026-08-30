package org.interview;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.interview.model.LicenseSession;

public class FloatingLicenseServerImpl implements LicenseServer {

	private static final int DEFAULT_EXPIRE_AFTER_SECONDS = 60;

	private final int licenseNumber;
	private final Map<String, LicenseSession> licenseMap;
	private final Clock clock;
	private final Duration expireAfter;
	private final Lock readLock;
	private final Lock writeLock;

	public FloatingLicenseServerImpl(int licenseNumber) {
		this(licenseNumber, Clock.systemUTC(), DEFAULT_EXPIRE_AFTER_SECONDS);
	}

	FloatingLicenseServerImpl(int licenseNumber, Clock clock, int expireAfterSeconds) {
		if (licenseNumber <= 0) {
			throw new IllegalArgumentException("licenseNumber must be greater than 0");
		}

		ReentrantReadWriteLock stateLock = new ReentrantReadWriteLock();

		this.licenseNumber = licenseNumber;
		this.licenseMap = new HashMap<>(licenseNumber);
		this.clock = clock;
		this.expireAfter = Duration.ofSeconds(expireAfterSeconds);
		this.readLock = stateLock.readLock();
		this.writeLock = stateLock.writeLock();
	}

	@Override
	public boolean obtainLicense(String userId) {
		Instant now = clock.instant();

		readLock.lock();
		try {
			LicenseSession existing = licenseMap.get(userId);
			if (existing != null && !existing.expired(now, expireAfter)) {
				return true;
			}
		} finally {
			readLock.unlock();
		}

		writeLock.lock();
		try {
			// State may have changed after releasing the read lock.
			now = clock.instant();
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
			writeLock.unlock();
		}
	}

	@Override
	public boolean releaseLicense(String userId) {
		writeLock.lock();
		try {
			return licenseMap.remove(userId) != null;
		} finally {
			writeLock.unlock();
		}
	}

	@Override
	public boolean pingLicense(String userId) {
		writeLock.lock();
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
			writeLock.unlock();
		}
	}

	private void returnExpired(Instant now) {
		licenseMap.entrySet()
				.removeIf(entry -> entry.getValue().expired(now, expireAfter));
	}
}
