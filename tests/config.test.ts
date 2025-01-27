import { IsolationLevel } from "../src/types/transaction.type";
import { Config } from "../src/core/config";
import { ConfigOptions } from "../src/types/config.type";

describe('Config', () => {
  it("create an instance of Config correctly", async () => {
    const config = new Config();
    expect(config).toBeInstanceOf(Config);
  });

  it("create an instance of Config with custom config correctly", async () => {
    const customConfigA: ConfigOptions = {
      isolationLevel: IsolationLevel.StrictLocking,
      lockTimeout: 8767
    }

    const customConfigB: ConfigOptions = {
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 9887
    }

    const customConfigC: ConfigOptions = {
      lockTimeout: 43
    }

    const validateConfig = (config: Config, custom: ConfigOptions) => {
      for (const key in custom) {
        expect(config.get(key as keyof ConfigOptions))
          .toEqual(custom[key as keyof ConfigOptions]);
      }
    }

    const configA = new Config(customConfigA);
    const configB = new Config(customConfigB);
    const configC = new Config(customConfigC);

    validateConfig(configA, customConfigA);
    validateConfig(configB, customConfigB);
    validateConfig(configC, customConfigC);
  });

  it("merge existing config with new options correctly", async () => {
    const customA: ConfigOptions = {
      lockTimeout: 2000
    }

    const customB: ConfigOptions = {
      isolationLevel: IsolationLevel.StrictLocking
    }

    const config = new Config({
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 6000
    });

    const mergeConfigA = Config.fromOptions(config, customA);
    const mergeConfigB = Config.fromOptions(config, customB);

    expect(mergeConfigA.getOptions()).toEqual({ ...config.getOptions(), ...customA });
    expect(mergeConfigB.getOptions()).toEqual({ ...config.getOptions(), ...customB });
  });

  it("create an instance of Config with undefined properties correctly", async () => {
    const customConfig: ConfigOptions = {
      isolationLevel: undefined,
      lockTimeout: undefined
    }

    const config = new Config(customConfig);

    for (const key in customConfig) {
      expect(config.get(key as keyof ConfigOptions)).not.toBeUndefined();
    }
  });

  it("throw an error when create a Config with wrong parameter", async () => {
    const errorMsg = "The config options must be an object";
    expect(() => new Config(undefined)).not.toThrow();
    expect(() => new Config(null as any)).toThrow(errorMsg);
    expect(() => new Config(1234 as any)).toThrow(errorMsg);
    expect(() => new Config("string" as any)).toThrow(errorMsg);
  });

  it("update a config property correctly", async () => {
    const config = new Config();
    const newIsolationLevel = IsolationLevel.StrictLocking;
    const newLockTimeout = 888;

    config.set("isolationLevel", newIsolationLevel);
    config.set("lockTimeout", newLockTimeout);

    expect(config.get("isolationLevel")).toBe(newIsolationLevel);
    expect(config.get("lockTimeout")).toBe(newLockTimeout);
  });

});