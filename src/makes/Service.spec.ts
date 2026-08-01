import {describe, it, expect} from "@jest/globals";
import {Service} from "./Service";
import {StorageType} from "../types";


describe("Service", (): void => {
    it("should build the container name from the service name", (): void => {
        const service = new Service({
            name: "test"
        });

        expect(service.containerName).toBe("redis-test.ws");
    });

    it("should default storage to filesystem for local services", (): void => {
        const service = new Service({
            name: "test"
        });

        expect(service.storage).toBe(StorageType.FS);
        expect(service.isExternal).toBe(false);
    });

    it("should not default storage for external (host-based) services", (): void => {
        const service = new Service({
            name: "test",
            host: "redis.example.com"
        });

        expect(service.isExternal).toBe(true);
        expect(service.storage).toBeUndefined();
    });

    it("should default to redis:8.6.2 when no image is set", (): void => {
        const service = new Service({
            name: "test"
        });

        expect(service.image).toBe("redis:8.6.2");
    });

    it("should keep an explicitly provided image", (): void => {
        const service = new Service({
            name: "test",
            image: "redis:7-alpine"
        });

        expect(service.image).toBe("redis:7-alpine");
    });

    it("should build image from deprecated imageName/imageVersion", (): void => {
        const service = new Service({
            name: "test",
            imageName: "redis",
            imageVersion: "7-alpine"
        } as any);

        expect(service.image).toBe("redis:7-alpine");
    });

    it("should reject an invalid image on assignment", (): void => {
        const service = new Service({
            name: "test"
        });

        expect(() => {
            service.image = "Not A Valid Image!!";
        }).toThrow("Invalid image Not A Valid Image!!");
    });

    it("should clear the image override when set to undefined", (): void => {
        const service = new Service({
            name: "test",
            image: "redis:7-alpine"
        });

        service.image = undefined;

        expect(service.image).toBe("redis:8.6.2");
    });

    it("should default the volume name from the service name", (): void => {
        const service = new Service({
            name: "test"
        });

        expect(service.volume).toBe("wocker-redis-test");
        expect(service.defaultVolumeName).toBe("wocker-redis-test");
    });

    it("should keep an explicitly provided volume name", (): void => {
        const service = new Service({
            name: "test",
            volume: "custom-volume"
        });

        expect(service.volume).toBe("custom-volume");
        expect(service.defaultVolumeName).toBe("wocker-redis-test");
    });

    it("should round-trip through toObject", (): void => {
        const service = new Service({
            name: "test",
            image: "redis:7-alpine",
            storage: StorageType.VOLUME,
            volume: "custom-volume",
            containerPort: 16379,
            password: "secret"
        });

        expect(service.toObject()).toEqual({
            name: "test",
            host: undefined,
            image: "redis:7-alpine",
            storage: StorageType.VOLUME,
            volume: "custom-volume",
            containerPort: 16379,
            password: "secret"
        });
    });
});
