package org.interview;

public interface LicenseServer {

	boolean obtainLicense(String userId);

	boolean releaseLicense(String userId);

	boolean pingLicense(String userId);
}
