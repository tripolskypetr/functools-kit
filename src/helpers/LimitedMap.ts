export class LimitedMap extends Map {

    constructor(private _maxSize = 20) {
        super();
    }

    set(key, value) {
        if (this.size >= this._maxSize) {
            const lastKey = Array.from(this.keys()).pop();
            this.delete(lastKey);
        }
        return super.set(key, value);
    }
}

export default LimitedMap;
