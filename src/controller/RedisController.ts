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
        storage?: RedisStorageType
    ): Promise<void> {
        await this.redisService.create(service, host, storage);
    }

    @Command("redis:destroy <service>")
    @Description("Stops and removes the specified Redis service instance and restarts the Redis Commander interface.")
    public async destroy(
        @Param("service")
        service: string
    ): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
        await this.redisService.destroy(service);
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
            alias: "r",
            description: "Restart redis service"
        })
        restart?: boolean
    ): Promise<void> {
        await this.redisService.start(service);
        await this.redisService.startCommander();
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

    @Command("redis:update [name]")
    @Description("Updates a Redis service with configurable storage and volume options.")
    public async update(
        @Param("name")
        name?: string,
        @Option("storage", {
            type: "string",
            alias: "s",
            description: "Specify storage type"
        })
        storage?: string,
        @Option("volume", {
            type: "string",
            alias: "v",
            description: "Specify volume name"
        })
        volume?: string
    ): Promise<void> {
        await this.redisService.update(name, storage, volume);
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
