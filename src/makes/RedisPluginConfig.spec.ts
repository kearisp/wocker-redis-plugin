import {describe, it, expect} from "@jest/globals";
import {RedisPluginConfig} from "./RedisPluginConfig";
import {Service} from "./Service";


describe("RedisPluginConfig", (): void => {
    it("should default admin to enabled with a fallback domain", (): void => {
        const config = new RedisPluginConfig({});

        expect(config.admin).toEqual({
            enabled: true,
            domain: "redis-commander.workspace"
        });
        expect(config.services).toEqual([]);
        expect(config.default).toBeUndefined();
    });

    it("should migrate the deprecated top-level adminDomain field", (): void => {
        const config = new RedisPluginConfig({
            adminDomain: "legacy-commander.ws"
        });

        expect(config.admin.domain).toBe("legacy-commander.ws");
    });

    it("should migrate the deprecated top-level defaultService field", (): void => {
        const config = new RedisPluginConfig({
            defaultService: "legacy-default",
            services: [
                {name: "legacy-default"}
            ]
        });

        expect(config.default).toBe("legacy-default");
    });

    it("should prefer the modern default field over the deprecated one", (): void => {
        const config = new RedisPluginConfig({
            default: "modern",
            defaultService: "legacy",
            services: [
                {name: "modern"},
                {name: "legacy"}
            ]
        });

        expect(config.default).toBe("modern");
    });

    it("hasService/getService should reflect the services list", (): void => {
        const config = new RedisPluginConfig({
            services: [
                {name: "test"}
            ]
        });

        expect(config.hasService("test")).toBe(true);
        expect(config.hasService("missing")).toBe(false);
        expect(config.getService("test")).toBeInstanceOf(Service);
    });

    it("getService should throw for an unknown service", (): void => {
        const config = new RedisPluginConfig({});

        expect(() => config.getService("missing")).toThrow('Service "missing" not found');
    });

    it("getDefaultService/hasDefaultService should reflect the default pointer", (): void => {
        const config = new RedisPluginConfig({});

        expect(config.hasDefaultService()).toBe(false);
        expect(() => config.getDefaultService()).toThrow("No services are installed by default");
    });

    it("getServiceOrDefault should throw when nothing can be resolved", (): void => {
        const config = new RedisPluginConfig({});

        expect(() => config.getServiceOrDefault()).toThrow("No services are installed by default");
    });

    it("setService should make the first service the default", (): void => {
        const config = new RedisPluginConfig({});

        config.setService(new Service({name: "first"}));

        expect(config.default).toBe("first");
        expect(config.hasDefaultService()).toBe(true);
    });

    it("setService should replace an existing service in place without changing default", (): void => {
        const config = new RedisPluginConfig({
            default: "test",
            services: [
                {name: "test", image: "redis:7-alpine"}
            ]
        });

        config.setService(new Service({name: "test", image: "redis:8.6.2"}));

        expect(config.services).toHaveLength(1);
        expect(config.default).toBe("test");
        expect(config.getService("test").image).toBe("redis:8.6.2");
    });

    it("removeService should remove the service and clear default when it matches", (): void => {
        const config = new RedisPluginConfig({
            default: "test",
            services: [
                {name: "test"}
            ]
        });

        config.removeService("test");

        expect(config.hasService("test")).toBe(false);
        expect(config.default).toBeUndefined();
    });

    it("toObject should omit an empty services array", (): void => {
        const config = new RedisPluginConfig({});

        expect(config.toObject().services).toBeUndefined();
    });
});
