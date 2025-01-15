export class ToolRegistry<T extends Record<string, unknown> = {}> {
  constructor(private registryName: string, private tools: T = {} as T) {}

  public register = <K extends string, U>(
    name: K,
    tool: U
  ): ToolRegistry<T & Record<K, U>> => {
    if (name in this.tools) {
      throw new Error(
        `functools-kit Tool is already registered name=${name} registryName=${this.registryName}`
      );
    }
    return new ToolRegistry(this.registryName, {
      ...this.tools,
      [name]: tool,
    }) as ToolRegistry<T & Record<K, U>>;
  }

  public get = <K extends keyof T>(name: K): T[K] => {
    return this.tools[name];
  }

  public init = () => {
    for (const tool of Object.values(this.tools)) {
        // @ts-ignore
        tool.init && tool.init();
    }
  }
}

export default ToolRegistry;
