export class LimitedMap<K, V> extends Map<K, V> {

    constructor(private _maxSize = 20) {
        super();
    }

    set(key: K, value: V) {
        if (this.size >= this._maxSize) {
            const lastKey = Array.from(this.keys()).shift();
            this.delete(lastKey);
        }
        return super.set(key, value);
    }
}

export default LimitedMap;
