import not from "../utils/math/not";
import isObject from "../utils/isObject";
import deepClone from "../utils/deepClone";

export class ToolRegistry<T extends Record<string, unknown> = {}> {
  constructor(private registryName: string, private tools: T = {} as T) {}

  public register = <K extends string, U>(
    name: K,
    tool: U
  ): ToolRegistry<T & Record<K, U>> => {
    if (name in this.tools) {
      throw new Error(
        `functools-kit Tool is already registered name=${String(
          name
        )} registryName=${this.registryName} (register)`
      );
    }
    return new ToolRegistry(this.registryName, {
      ...this.tools,
      [name]: tool,
    }) as ToolRegistry<T & Record<K, U>>;
  };

  public override = <K extends string, U>(
    name: K,
    tool: U
  ): ToolRegistry<T & Record<K, U>> => {
    if (name in this.tools) {
      return new ToolRegistry(this.registryName, {
        ...this.tools,
        [name]: isObject(tool)
          ? Object.assign({}, this.tools[name], tool)
          : tool,
      }) as ToolRegistry<T & Record<K, U>>;
    }
    return new ToolRegistry(this.registryName, {
      ...this.tools,
      [name]: tool,
    }) as ToolRegistry<T & Record<K, U>>;
  };

  public get = <K extends keyof T>(name: K): T[K] => {
    if (name in this.tools) {
      return this.tools[name];
    }
    throw new Error(
      `functools-kit Tool not registered name=${String(name)} registryName=${
        this.registryName
      } (get)`
    );
  };

  public init = () => {
    for (const tool of Object.values(this.tools)) {
      // @ts-ignore
      tool.init && tool.init();
    }
  };
}

export default ToolRegistry;
