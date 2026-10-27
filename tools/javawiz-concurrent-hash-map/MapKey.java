public final class MapKey {
    public final String label;
    public final int hash;

    public MapKey(String label, int hash) {
        this.label = label;
        this.hash = hash;
    }

    @Override public int hashCode() { return hash; }
    @Override public boolean equals(Object other) {
        return other instanceof MapKey key && label.equals(key.label);
    }
    @Override public String toString() { return label; }
}
