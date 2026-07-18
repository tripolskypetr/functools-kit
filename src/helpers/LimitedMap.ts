export class LimitedMap<K, V> extends Map<K, V> {

    constructor(private _maxSize = 20) {
        super();
    }

    set(key: K, value: V) {
        // maxSize <= 0 means "hold nothing" — the previous single-evict left
        // one entry behind
        if (this._maxSize <= 0) {
            return this;
        }
        if (!this.has(key)) {
            while (this.size >= this._maxSize && this.size > 0) {
                const oldestKey = this.keys().next().value;
                this.delete(oldestKey);
            }
        }
        return super.set(key, value);
    }
}

export default LimitedMap;
