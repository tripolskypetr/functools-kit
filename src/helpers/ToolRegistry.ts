import isObject from "../utils/isObject";

const hasTool = (tools: Record<string, unknown>, name: string) =>
  Object.prototype.hasOwnProperty.call(tools, name);

export class ToolRegistry<T extends Record<string, unknown> = {}> {
  constructor(private registryName: string, private tools: T = {} as T) {}

  public register = <K extends string, U>(
    name: K,
    tool: U
  ): ToolRegistry<T & Record<K, U>> => {
    // hasOwnProperty, not `in`: `in` walks the prototype chain, so names like
    // toString / constructor would falsely read as already-registered
    if (hasTool(this.tools, name)) {
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
    if (hasTool(this.tools, name)) {
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
    if (hasTool(this.tools, name as string)) {
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
      tool && tool.init && tool.init();
    }
  };
}

export default ToolRegistry;
