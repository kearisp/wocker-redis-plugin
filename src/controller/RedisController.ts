import {
    Controller,
    Completion,
    Command,
    Option
} from "@wocker/core";

import {RedisService} from "../services/RedisService";


@Controller()
export class RedisController {
    public constructor(
        protected readonly redisService: RedisService
    ) {}

    @Command("redis:create <service>")
    public async create(
        @Option("host", {
            type: "string",
            alias: "h"
        })
        host: string,
        service: string
    ): Promise<void> {
        await this.redisService.create(service, host);
    }

    @Command("redis:destroy <service>")
    public async destroy(service: string): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
        await this.redisService.destroy(service);
    }

    @Command("redis:use <service>")
    public async use(service: string): Promise<void> {
        await this.redisService.use(service);
    }

    @Command("redis:start [service]")
    public async start(service?: string): Promise<void> {
        await this.redisService.start(service);
        await this.redisService.startCommander();
    }

    @Command("redis:stop [service]")
    public async stop(service?: string): Promise<void> {
        await this.redisService.stop(service);
        await this.redisService.startCommander();
    }

    @Completion("service")
    public async getServices(): Promise<string[]> {
        return this.redisService.getServiceNames();
    }
}
