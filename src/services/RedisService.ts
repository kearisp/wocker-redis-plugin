import {AppConfigService, DockerService, Injectable, PluginConfigService, ProxyService} from "@wocker/core";
import {promptSelect, promptText} from "@wocker/utils";
import CliTable from "cli-table3";

import {Config, ConfigProps} from "../makes/Config";
import {REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME, RedisStorageType, Service} from "../makes/Service";


@Injectable()
export class RedisService {
    protected readonly container: string = "redis.ws";
    protected readonly commander: string = "redis-commander.workspace";
    protected config?: Config;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly proxyService: ProxyService
    ) {}

    public async create(name?: string, host?: string, storage?: RedisStorageType): Promise<void> {
        const config = await this.getConfig();

        if(!name) {
            name = await promptText({
                message: "Service name:"
            }) as string;
        }

        if(config.getService(name)) {
            throw new Error(`Service ${name} already exists`);
        }

        if(!host) {
            if(!storage || ![REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME].includes(storage)) {
                storage = await promptSelect<RedisStorageType>({
                    message: "Storage type:",
                    options: [
                        {
                            label: "Volume",
                            value: REDIS_STORAGE_VOLUME
                        },
                        {
                            label: "File System",
                            value: REDIS_STORAGE_FILESYSTEM
                        }
                    ]
                });
            }
        }
        else {
            storage = undefined;
        }

        const service = new Service({
            name,
            host,
            storage
        });

        config.setService(service);

        if(!config.default) {
            config.default = name;
        }

        await config.save();

        console.info(`Service ${service.name} created`);
    }

    public async destroy(name: string): Promise<void> {
        const config = await this.getConfig();

        if(config.default === name) {
            throw new Error("Can't delete default service");
        }

        const service = config.getService(name);

        if(!service) {
            throw new Error(`Service ${name} not found`);
        }

        switch(service.storage) {
            case "volume": {
                if(await this.dockerService.hasVolume(service.volumeName)) {
                    await this.dockerService.rmVolume(service.volumeName);
                }
                break;
            }

            case "filesystem": {
                if(this.pluginConfigService.exists(service.name)) {
                    await this.pluginConfigService.rm(service.name, {
                        recursive: true
                    });
                }
                break;
            }
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

        config.default = name;

        await config.save();
    }

    public async start(name?: string, restart?: boolean): Promise<void> {
        const config = await this.getConfig();
        const service = config.getServiceOrDefault(name);

        let container = await this.dockerService.getContainer(service.containerName);

        if(!container) {
            await this.dockerService.pullImage("redis:latest");

            const volumes: string[] = [];

            switch(service.storage) {
                case "volume": {
                    volumes.push(`${service.volumeName}:/data`);
                    break;
                }

                case "filesystem":
                default: {
                    await this.pluginConfigService.mkdir(service.name, {
                        recursive: true
                    });

                    volumes.push(`${this.pluginConfigService.dataPath(service.name)}:/data`)
                    break;
                }
            }

            container = await this.dockerService.createContainer({
                name: service.containerName,
                image: "redis:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: service.containerName,
                },
                volumes
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
                let host: string;

                if(service.host) {
                    host = service.host;
                }
                else if(await this.dockerService.getContainer(service.containerName)) {
                    host = service.containerName;
                }
                else {
                    continue;
                }

                redisHosts.push(`${service.name}:${host}`);
            }

            if(redisHosts.length === 0) {
                return;
            }

            container = await this.dockerService.createContainer({
                name: this.commander,
                image: "rediscommander/redis-commander:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: config.adminDomain,
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
            await this.proxyService.start();

            console.info(`Redis commander started at http://${config.adminDomain}`);
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
                            name: "default",
                            storage: "volume"
                        }
                    ]
                };

            const _this = this;

            this.config = new class extends Config {
                public async save(): Promise<void> {
                    await _this.pluginConfigService.writeJSON("config.json", this.toJSON());
                }
            }(data);
        }

        return this.config;
    }

    public async getListTable(): Promise<string> {
        const config = await this.getConfig();

        const table = new CliTable({
            head: ["Name", "Host", "Storage"]
        });

        for(const service of config.services || []) {
            table.push([
                service.name + (config.default === service.name ? " (default)" : ""),
                service.isExternal ? service.host : service.containerName,
                service.storage === REDIS_STORAGE_VOLUME ? service.volume : "",
            ]);
        }

        return table.toString();
    }

    public async update(name?: string, storage?: string, volume?: string): Promise<void> {
        const config = await this.getConfig();
        const service = config.getServiceOrDefault(name);

        if(storage && ![REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME].includes(storage)) {
            throw new Error("Invalid storage type");
        }

        if(volume) {
            service.volume = volume;
        }

        config.setService(service);

        await config.save();
    }

    public async changeDomain(domain: string): Promise<void> {
        const config = await this.getConfig();

        config.adminDomain = domain;

        await config.save();
    }
}
