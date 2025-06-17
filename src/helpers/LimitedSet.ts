export class LimitedSet<T> extends Set<T> {

    constructor(private _maxSize = 20) {
        super();
    }

    add(value: T) {
        if (this.size >= this._maxSize) {
            const lastElement = Array.from(this).shift();
            this.delete(lastElement);
        }
        return super.add(value);
    }
}

export default LimitedSet;
