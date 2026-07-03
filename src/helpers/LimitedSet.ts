export class LimitedSet<T> extends Set<T> {

    constructor(private _maxSize = 20) {
        super();
    }

    add(value: T) {
        if (!this.has(value) && this.size >= this._maxSize) {
            const oldestElement = this.values().next().value;
            this.delete(oldestElement);
        }
        return super.add(value);
    }
}

export default LimitedSet;
