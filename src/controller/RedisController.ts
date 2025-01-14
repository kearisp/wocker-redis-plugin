import {
    Controller,
    Description,
    Completion,
    Command,
    Option,
    Param
} from "@wocker/core";

import {RedisStorageType} from "../makes/Service";
import {RedisService} from "../services/RedisService";


@Controller()
export class RedisController {
    public constructor(
        protected readonly redisService: RedisService
    ) {}

    @Command("redis:create [service]")
    @Description("Creates a new Redis service instance with optional configuration for host and storage type.")
    public async create(
        @Param("service")
        service?: string,
        @Option("host", {
            type: "string",
            alias: "h"
        })
        host?: string,
        @Option("storage", {
            type: "string",
            alias: "s"
        })
        storage?: RedisStorageType,
        @Option("image", {
            type: "string",
            alias: "i",
            description: "The image name to start the service with"
        })
        image?: string,
        @Option("image-version", {
            type: "string",
            alias: "I",
            description: "The image version to start the service with"
        })
        imageVersion?: string
    ): Promise<void> {
        await this.redisService.create(service, host, storage, image, imageVersion);
    }

    @Command("redis:destroy <service>")
    @Description("Stops and removes the specified Redis service instance and restarts the Redis Commander interface.")
    public async destroy(
        @Param("service")
        service: string,
        @Option("force", {
            type: "boolean",
            alias: "f",
            description: "Force destruction without prompts"
        })
        force?: boolean,
        @Option("yes", {
            type: "boolean",
            alias: "y",
            description: "Skip confirmation"
        })
        yes?: boolean
    ): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.destroy(service, force, yes);
        await this.redisService.startCommander();
    }

    @Command("redis:use <service>")
    @Description("Sets the specified Redis service as the current active service.")
    public async use(
        @Param("service")
        service: string
    ): Promise<void> {
        await this.redisService.use(service);
    }

    @Command("redis:start [service]")
    @Description("Starts a specified Redis service instance and launches the Redis Commander interface.")
    public async start(
        @Param("service")
        service?: string,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart redis service"
        })
        restart?: boolean
    ): Promise<void> {
        await this.redisService.start(service, restart);
        await this.redisService.startCommander();
    }

    @Command("redis:upgrade [service]")
    @Description("Upgrades a Redis service to a specified image and version.")
    public async upgrade(
        @Param("service")
        name?: string,
        @Option("storage", {
            type: "string",
            alias: "s",
            description: "Specify storage type"
        })
        storage?: RedisStorageType,
        @Option("volume", {
            type: "string",
            alias: "v",
            description: "Specify volume name"
        })
        volume?: string,
        @Option("image", {
            type: "string",
            alias: "i",
            description: "The image name to start the service with"
        })
        image?: string,
        @Option("image-version", {
            type: "string",
            alias: "I",
            description: "The image version to start the service with"
        })
        imageVersion?: string
    ): Promise<void> {
        await this.redisService.upgrade(name, storage, volume, image, imageVersion);
    }

    @Command("redis:stop [service]")
    @Description("Stops the specified Redis service instance and restarts the Redis Commander interface.")
    public async stop(
        @Param("service")
        service?: string
    ): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
    }

    @Command("redis:ls")
    @Description("Lists all available Redis service instances in a tabular format.")
    public async list(): Promise<string> {
        return this.redisService.getListTable();
    }

    @Command("redis:set-domain <domain>")
    public async changeDomain(
        @Param("domain")
        domain: string
    ): Promise<void> {
        await this.redisService.changeDomain(domain);
        await this.redisService.startCommander();
    }

    @Completion("service")
    public async getServices(): Promise<string[]> {
        return this.redisService.getServiceNames();
    }
}
