package club.mockinterview.concurrency;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public final class ConnectionGate {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition stateChanged = lock.newCondition();
    private boolean connected;

    public void brokenSignalOnly() {
        lock.lock();
        try {
            stateChanged.signalAll();
        } finally {
            lock.unlock();
        }
    }

    public void brokenAwaitConnected() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            stateChanged.await();
        } finally {
            lock.unlock();
        }
    }

    public void fixedMarkConnected() {
        lock.lock();
        try {
            connected = true;
            stateChanged.signalAll();
        } finally {
            lock.unlock();
        }
    }

    public void fixedAwaitConnected() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while (!connected) {
                stateChanged.await();
            }
        } finally {
            lock.unlock();
        }
    }

    public boolean hasConditionWaiters() {
        lock.lock();
        try {
            return lock.hasWaiters(stateChanged);
        } finally {
            lock.unlock();
        }
    }
}
