type Ctor<T = any> = new (...args: any[]) => T;

/**
 * A utility function to make a class extendable.
 * 
 * @template T - The type of the constructor.
 * @param {T} BaseClass - The base class to be extended.
 * @returns {T} - A new class that extends the base class.
 */
export const makeExtendable = <T extends Ctor<any>>(BaseClass: T) => {
  /**
   * A safe class that extends the base class.
   * 
   * @param {...ConstructorParameters<T>} args - The arguments to pass to the base class constructor.
   * @returns {InstanceType<T>} - An instance of the base class.
   */
  function SafeClass(...args: ConstructorParameters<T>): InstanceType<T> {
    const instance = Reflect.construct(BaseClass, args, new.target || SafeClass);
    return instance;
  }

  Object.setPrototypeOf(SafeClass, BaseClass);
  Object.setPrototypeOf(SafeClass.prototype, BaseClass.prototype);

  return SafeClass as unknown as T;
};

export default makeExtendable;
