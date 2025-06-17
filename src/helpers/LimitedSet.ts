export class LimitedSet extends Set {

    constructor(private _maxSize = 20) {
        super();
    }

    add(value) {
        if (this.size >= this._maxSize) {
            const lastElement = Array.from(this).pop();
            this.delete(lastElement);
        }
        return super.add(value);
    }
}

export default LimitedSet;
