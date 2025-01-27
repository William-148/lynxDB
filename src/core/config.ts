import { ConfigOptions } from "../types/config.type";
import { IsolationLevel } from "../types/transaction.type";

export class Config {

  private options: Required<ConfigOptions>;

  constructor(initialOptions: ConfigOptions = {}) {
    removeUndefinedProperties(initialOptions);
    this.options = {
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 5000,
      ...initialOptions
    }
  }

  /**
   * Creates a new instance of Config merging the existing configuration with the new options.
   * 
   * @param existingConfig Existing configuration to be updated
   * @param newOptions New options to be added to the existing configuration
   * @returns New object with the updated configuration
   */
  static fromOptions(existingConfig: Config, newOptions: ConfigOptions): Config {
    return new Config({
      ...existingConfig.options,
      ...newOptions,
    });
  }

  /**
   * Retrieves a new object with the current configuration options.
   * 
   * @returns The current configuration options
   */
  public getOptions(): Required<ConfigOptions> {
    return { ...this.options };
  }

  get<K extends keyof ConfigOptions>(key: K): Required<ConfigOptions>[K] {
    return this.options[key];
  }

  set<K extends keyof ConfigOptions>(key: K, value: ConfigOptions[K]): void {
    this.options[key] = value as Required<ConfigOptions>[K];
  }
}

function removeUndefinedProperties<ConfigOptions>(options: ConfigOptions): void {
  if (options === null || typeof options !== "object") throw new Error("The config options must be an object");
  Object.keys(options).forEach((key) => {
    if (options[key as keyof ConfigOptions] === undefined) {
      delete options[key as keyof ConfigOptions];
    }
  });
}