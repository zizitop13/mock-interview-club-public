package org.interview.model;

import java.time.Instant;
import java.time.temporal.TemporalAmount;

public class LicenseSession {

	private Instant pinged;

	public LicenseSession(Instant pinged){
		this.pinged = pinged;
	}

	public boolean expired(Instant now, TemporalAmount timeout) {
		return !now.isBefore(pinged.plus(timeout));
	}

	public void ping(Instant time) {
		this.pinged = time;
	}
}
