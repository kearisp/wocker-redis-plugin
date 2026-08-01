import {describe, it, expect, beforeAll} from "@jest/globals";
import Path from "path";
import {vol} from "memfs";
import {
    ApplicationContext,
    DockerService,
    PluginConfigService,
    FILE_SYSTEM_DRIVER_KEY,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {Fixtures} from "@wocker/docker-mock-module";
import {Test} from "@wocker/testing";
import {RedisService} from "./RedisService";
import {StorageType} from "../types";


describe("RedisService", (): void => {
    const ROOT_DIR = Path.join(__dirname, "..", "..");
    const fixtures = Fixtures.fromPath(Path.join(ROOT_DIR, "fixtures"));

    let context: ApplicationContext;
    let redisService: RedisService;

    beforeAll(async (): Promise<void> => {
        vol.reset();

        context = await Test
            .createTestingModule({
                imports: [
                    DockerModule
                ],
                providers: [
                    RedisService,
                    PluginConfigService,
                    {
                        provide: PLUGIN_DIR_KEY,
                        useValue: "/wocker-test/plugins/redis"
                    },
                    {
                        provide: "PROXY_SERVICE",
                        useValue: {
                            start: async () => undefined
                        }
                    }
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();

        redisService = context.get(RedisService);
    });

    it("should create, start, list, stop and destroy a service", async (): Promise<void> => {
        await redisService.create({
            name: "test",
            storage: StorageType.FS,
            containerPort: 16379
        });

        expect(redisService.config.hasService("test")).toBe(true);
        expect(redisService.config.default).toBe("test");

        await redisService.start("test");

        const dockerService = context.get(DockerService);

        const runningContainer = await dockerService.getContainer("redis-test.ws");

        expect(runningContainer).not.toBeNull();

        const runningInspect = await runningContainer!.inspect();

        expect(runningInspect.State.Running).toBe(true);

        const list = await redisService.getListTable();

        expect(list).toContain("test (default)");

        await redisService.stop("test");

        const stoppedContainer = await dockerService.getContainer("redis-test.ws");

        expect(stoppedContainer).toBeNull();

        await redisService.destroy("test", true, true);

        expect(redisService.config.hasService("test")).toBe(false);
    });

    it("should remove the running container itself when destroying, without a prior stop", async (): Promise<void> => {
        await redisService.create({
            name: "direct-destroy",
            storage: StorageType.FS,
            containerPort: 16381
        });

        await redisService.start("direct-destroy");

        const dockerService = context.get(DockerService);

        const containerBeforeDestroy = await dockerService.getContainer("redis-direct-destroy.ws");

        expect(containerBeforeDestroy).not.toBeNull();
        expect((await containerBeforeDestroy!.inspect()).State.Running).toBe(true);

        await redisService.destroy("direct-destroy", true, true);

        const containerAfterDestroy = await dockerService.getContainer("redis-direct-destroy.ws");

        expect(containerAfterDestroy).toBeNull();
    });

    it("should not create a local container for an external service", async (): Promise<void> => {
        await redisService.create({
            name: "external",
            host: "redis.example.com"
        });

        await redisService.start("external");

        const dockerService = context.get(DockerService);
        const container = await dockerService.getContainer("redis-external.ws");

        expect(container).toBeNull();

        await redisService.destroy("external", true, true);
    });

    it("should start a container with --requirepass when a password is set", async (): Promise<void> => {
        await redisService.create({
            name: "secured",
            storage: StorageType.FS,
            containerPort: 16380,
            password: "s3cret"
        });

        await redisService.start("secured");

        const dockerService = context.get(DockerService);
        const container = await dockerService.getContainer("redis-secured.ws");

        expect(container).not.toBeNull();

        const inspect = await container!.inspect();

        expect(inspect.State.Running).toBe(true);
        expect(redisService.config.getService("secured").password).toBe("s3cret");

        await redisService.stop("secured");
        await redisService.destroy("secured", true, true);
    });
});
