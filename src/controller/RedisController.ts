import {
    Controller,
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
    public async destroy(
        @Param("service")
        service: string
    ): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
        await this.redisService.destroy(service);
    }

    @Command("redis:use <service>")
    public async use(
        @Param("service")
        service: string
    ): Promise<void> {
        await this.redisService.use(service);
    }

    @Command("redis:start [service]")
    public async start(
        @Param("service")
        service?: string
    ): Promise<void> {
        await this.redisService.start(service);
        await this.redisService.startCommander();
    }

    @Command("redis:stop [service]")
    public async stop(
        @Param("service")
        service?: string
    ): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
    }

    @Command("redis:ls")
    public async list(): Promise<string> {
        return this.redisService.getListTable();
    }

    @Completion("service")
    public async getServices(): Promise<string[]> {
        return this.redisService.getServiceNames();
    }
}
