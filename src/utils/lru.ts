// src/utils/lru.ts
export class LruCache<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly limit: number) {
    if (limit <= 0) throw new Error("LRU limit must be > 0");
  }

  get size() {
    return this.map.size;
  }

  has(key: K) {
    return this.map.has(key);
  }

  /** Get and mark as most-recently-used */
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // move to end (MRU)
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  /** Set and mark as most-recently-used, evict LRU entries if needed */
  set(key: K, value: V): { evicted: Array<[K, V]> } {
    const evicted: Array<[K, V]> = [];

    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);

    while (this.map.size > this.limit) {
      const lruKey = this.map.keys().next().value as K;
      const lruVal = this.map.get(lruKey)!;
      this.map.delete(lruKey);
      evicted.push([lruKey, lruVal]);
    }
    return { evicted };
  }

  clear() {
    this.map.clear();
  }
}
