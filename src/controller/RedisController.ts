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
@Description("Redis commands")
export class RedisController {
    public constructor(
        protected readonly redisService: RedisService
    ) {}

    @Command("redis:create [service]")
    @Description("Creates a new Redis service instance with optional configuration for host and storage type.")
    public async create(
        @Param("service")
        service?: string,
        @Option("host", "h")
        @Description("Remote redis host")
        host?: string,
        @Option("storage", "s")
        @Description("Storage type")
        storage?: RedisStorageType,
        @Option("image", "i")
        @Description("The image name to start the service with")
        image?: string,
        @Option("image-version", "I")
        @Description("The image version to start the service with")
        imageVersion?: string
    ): Promise<void> {
        await this.redisService.create(service, host, storage, image, imageVersion);
    }

    @Command("redis:destroy <service>")
    @Description("Stops and removes the specified Redis service instance and restarts the Redis Commander interface.")
    public async destroy(
        @Param("service")
        service: string,
        @Option("force", "f")
        @Description("Force destruction without prompts")
        force?: boolean,
        @Option("yes", "y")
        @Description("Skip confirmation")
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
        @Option("restart", "r")
        @Description("Restart redis service")
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
        @Option("storage", "s")
        @Description("Specify storage type")
        storage?: RedisStorageType,
        @Option("volume", "v")
        @Description("Specify volume name")
        volume?: string,
        @Option("image", "i")
        @Description("The image name to start the service with")
        imageName?: string,
        @Option("image-version", "I")
        @Description("The image version to start the service with")
        imageVersion?: string,
        @Option("enable-admin")
        enableAdmin?: boolean,
        @Option("disable-admin")
        disableAdmin?: boolean
    ): Promise<void> {
        await this.redisService.upgrade(name, {
            storage,
            volume,
            imageName,
            imageVersion
        });

        if(enableAdmin) {
            this.redisService.config.admin.enabled = true;
            this.redisService.config.save();
        }

        if(disableAdmin) {
            this.redisService.config.admin.enabled = false;
            this.redisService.config.save();
        }
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
    @Description("Sets redis admin domain")
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
