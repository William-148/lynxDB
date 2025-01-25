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

  static fromOptions(existingConfig: Config, newOptions: ConfigOptions): Config {
    return new Config({
      ...existingConfig.options,
      ...newOptions,
    });
  }

  get<K extends keyof ConfigOptions>(key: K): Required<ConfigOptions>[K] {
    return this.options[key];
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