import Subject from "./Subject";
import Observer, { LISTEN_CONNECT } from "./Observer";

import type TBehaviorSubject from "../../model/TBehaviorSubject";
import TObserver, { TObservable } from "../../model/TObserver";

/**
 * Represents a BehaviorSubject that extends the Subject class and provides the functionality of an observable and an observer.
 *
 * @template Data - The type of the data that the BehaviorSubject holds.
 */
export class BehaviorSubject<Data = any> extends Subject<Data> implements TBehaviorSubject<Data>, TObservable<Data>  {

    private _hasValue: boolean;

    constructor(private _data: Data | null = null) {
        super();
        // a null/undefined constructor default means "never set"; an explicit
        // next(null) later must still be replayed
        this._hasValue = _data !== null && _data !== undefined;
    };

    /**
     * Retrieves the data stored in the instance.
     *
     * @return The data stored in the instance.
     */
    get data() {
        return this._data;
    };

    /**
     * Sets the given data and calls the next method of the super class asynchronously.
     *
     * @param data - The data to be set.
     * @return Resolves when super class's next method is called.
     */
    public next = async (data: Data) => {
        this._data = data;
        this._hasValue = true;
        await super.next(data);
    };

    /**
     * Creates a new observer.
     *
     * @returns The observer instance.
     */
    public toObserver = (): TObserver<Data> => {
        let unsubscribeRef: Function = () => undefined;
        const observer = new Observer<Data>(() => unsubscribeRef());
        observer[LISTEN_CONNECT](() => {
            unsubscribeRef = this.subscribe(observer.emit);
            if (this._hasValue) {
                // a replay rejection was already reported at the throwing
                // level (connect/map handlers emitError before rethrowing) —
                // re-reporting here doubled every error
                observer.emit(this._data as Data).catch(() => undefined);
            }
        });
        return observer;
    };

};

export { TBehaviorSubject };

export default BehaviorSubject;
