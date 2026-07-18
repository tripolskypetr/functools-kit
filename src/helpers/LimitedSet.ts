export class LimitedSet<T> extends Set<T> {

    constructor(private _maxSize = 20) {
        super();
    }

    add(value: T) {
        // maxSize <= 0 means "hold nothing" — the previous single-evict left
        // one entry behind
        if (this._maxSize <= 0) {
            return this;
        }
        if (!this.has(value)) {
            while (this.size >= this._maxSize && this.size > 0) {
                const oldestElement = this.values().next().value;
                this.delete(oldestElement);
            }
        }
        return super.add(value);
    }
}

export default LimitedSet;
