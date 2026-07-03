export class LimitedMap<K, V> extends Map<K, V> {

    constructor(private _maxSize = 20) {
        super();
    }

    set(key: K, value: V) {
        if (!this.has(key) && this.size >= this._maxSize) {
            const oldestKey = this.keys().next().value;
            this.delete(oldestKey);
        }
        return super.set(key, value);
    }
}

export default LimitedMap;
