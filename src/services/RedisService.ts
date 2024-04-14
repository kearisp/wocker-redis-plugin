import {
    Injectable,
    AppConfigService,
    PluginConfigService,
    DockerService
} from "@wocker/core";

import {Config, ConfigProps} from "../makes/Config";


@Injectable()
export class RedisService {
    protected readonly container = "redis.ws";
    protected readonly commander = "redis-commander.workspace";
    protected config?: Config;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly pluginConfigService: PluginConfigService
    ) {}

    public async create(name: string): Promise<void> {
        const config = await this.getConfig();

        config.addService(name);

        if(!config.defaultService) {
            config.defaultService = name;
        }

        await config.save();
    }

    public async destroy(name: string): Promise<void> {
        const config = await this.getConfig();

        if(config.defaultService === name) {
            throw new Error("Can't delete default service");
        }

        config.removeService(name);

        await config.save();
    }

    public async use(name: string): Promise<void> {
        const config = await this.getConfig();
        const service = config.getService(name);

        if(!service) {
            throw new Error(`Service "${name}" does not exist`);
        }

        config.defaultService = name;

        await config.save();
    }

    public async start(name?: string): Promise<void> {
        const config = await this.getConfig();
        const service = config.getServiceOrDefault(name);

        let container = await this.dockerService.getContainer(service.containerName);

        if(!container) {
            await this.dockerService.pullImage("redis:latest");

            await this.pluginConfigService.mkdir(`${service.name}`, {
                recursive: true
            });

            container = await this.dockerService.createContainer({
                name: service.containerName,
                image: "redis:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: service.containerName,
                },
                volumes: [
                    `${this.pluginConfigService.dataPath(service.name)}:/data`
                ]
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    public async stop(name?: string): Promise<void> {
        const config = await this.getConfig();
        const service = config.getServiceOrDefault(name);

        await this.dockerService.removeContainer(service.containerName);
    }

    public async startCommander(): Promise<void> {
        const config = await this.getConfig();

        await this.dockerService.removeContainer(this.commander);

        let container = await this.dockerService.getContainer(this.commander);

        if(!container) {
            await this.dockerService.pullImage("rediscommander/redis-commander:latest");

            const redisHosts: string[] = [];

            for(const service of config.services) {
                if(!await this.dockerService.getContainer(service.containerName)) {
                    continue;
                }

                redisHosts.push(`${service.name}:${service.containerName}`);
            }

            if(redisHosts.length === 0) {
                return;
            }

            container = await this.dockerService.createContainer({
                name: this.commander,
                image: "rediscommander/redis-commander:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: this.commander,
                    VIRTUAL_PORT: "8081",
                    REDIS_HOSTS: redisHosts.join(",")
                }
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    public async getServiceNames(): Promise<string[]> {
        const config = await this.getConfig();

        return config.services.map((service) => {
            return service.name;
        });
    }

    public async getConfig(): Promise<Config> {
        if(!this.config) {
            const data: ConfigProps = this.pluginConfigService.exists("config.json")
                ? await this.pluginConfigService.readJSON("config.json")
                : {
                    defaultService: "default",
                    services: [
                        {
                            name: "default"
                        }
                    ]
                };

            const _this = this;

            this.config = new class extends Config {
                public constructor(data: ConfigProps) {
                    super(data);
                }

                public async save() {
                    await _this.pluginConfigService.writeJSON("config.json", this.toJSON());
                }
            }(data);
        }

        return this.config;
    }
}
