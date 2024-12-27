import {
    AppConfigService,
    DockerService,
    Injectable,
    Inject,
    ProxyService,
    FileSystem,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import {promptSelect, promptText, promptConfirm} from "@wocker/utils";
import CliTable from "cli-table3";

import {Config, ConfigProps} from "../makes/Config";
import {REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME, RedisStorageType, Service} from "../makes/Service";


@Injectable()
export class RedisService {
    protected readonly commander: string = "redis-commander.workspace";
    protected _config?: Config;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly proxyService: ProxyService,
        @Inject(PLUGIN_DIR_KEY)
        protected readonly pluginDir: string
    ) {}

    public get config(): Config {
        if(!this._config) {
            const fs = this.fs;

            const data = fs.exists("config.json")
                ? fs.readJSON("config.json")
                : {};

            this._config = new class extends Config {
                public save(): void {
                    if(!fs.exists("")) {
                        fs.mkdir("", {
                            recursive: true
                        });
                    }

                    fs.writeJSON("config.json", this.toJSON());
                }
            }(data);
        }

        return this._config;
    }

    public get fs(): FileSystem {
        if(!this.pluginDir) {
            throw new Error("Plugin dir missed");
        }

        return new FileSystem(this.pluginDir);
    }

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

    public async destroy(name: string, force?: boolean, yes?: boolean): Promise<void> {
        const config = await this.getConfig();

        if(!force && config.default === name) {
            throw new Error("Can't delete default service");
        }

        const service = config.getService(name);

        if(!service) {
            throw new Error(`Service ${name} not found`);
        }

        if(!yes) {
            const confirm = await promptConfirm({
                message: `Are you sure you want to delete the "${service.name}" service? This action cannot be undone and all data will be lost.`,
                default: false
            });

            if(!confirm) {
                throw new Error("Aborted");
            }
        }

        switch(service.storage) {
            case "volume": {
                if(await this.dockerService.hasVolume(service.volumeName)) {
                    await this.dockerService.rmVolume(service.volumeName);
                }
                break;
            }

            case "filesystem": {
                if(this.fs.exists(service.name)) {
                    this.fs.rm(service.name, {
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

        if(!name && !config.hasDefaultService()) {
            await this.create();
        }

        const service = config.getServiceOrDefault(name);

        let container = await this.dockerService.getContainer(service.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(service.containerName);

            container = null
        }

        if(!container) {
            await this.dockerService.pullImage(`${service.image}:${service.imageVersion}`);

            const volumes: string[] = [];

            switch(service.storage) {
                case "volume": {
                    volumes.push(`${service.volumeName}:/data`);
                    break;
                }

                case "filesystem":
                default: {
                    this.fs.mkdir(service.name, {
                        recursive: true
                    });

                    volumes.push(`${this.fs.path(service.name)}:/data`)
                    break;
                }
            }

            container = await this.dockerService.createContainer({
                name: service.containerName,
                image: `${service.image}:${service.imageVersion}`,
                restart: "always",
                env: {
                    VIRTUAL_HOST: service.containerName
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

            console.info(`Redis "${service.name}" service started`);
        }
    }

    public async upgrade(name?: string, storage?: string, volume?: string, image?: string, imageVersion?: string) {
        const service = this.config.getServiceOrDefault(name);

        if(storage) {
            if(![REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME].includes(storage)) {
                throw new Error("Invalid storage type");
            }

            service.storage = storage;
        }

        if(volume) {
            service.volume = volume;
        }

        if(image) {
            service.image = image;
        }

        if(imageVersion) {
            service.imageVersion = imageVersion;
        }

        this.config.setService(service);
        this.config.save();
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
        if(!this._config) {
            const data: ConfigProps = this.fs.exists("config.json")
                ? this.fs.readJSON("config.json")
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

            this._config = new class extends Config {
                public async save(): Promise<void> {
                    await _this.fs.writeJSON("config.json", this.toJSON());
                }
            }(data);
        }

        return this._config;
    }

    public async getListTable(): Promise<string> {
        const config = await this.getConfig();

        const table = new CliTable({
            head: ["Name", "Host", "Storage", "Image"]
        });

        for(const service of config.services || []) {
            table.push([
                service.name + (config.default === service.name ? " (default)" : ""),
                service.isExternal ? service.host : service.containerName,
                service.storage === REDIS_STORAGE_VOLUME ? service.volume : "",
                `${service.image}:${service.imageVersion}`
            ]);
        }

        return table.toString();
    }

    public async update(name?: string, storage?: string, volume?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        if(storage && ![REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME].includes(storage)) {
            throw new Error("Invalid storage type");
        }

        if(volume) {
            service.volume = volume;
        }

        this.config.setService(service);
        this.config.save();
    }

    public async changeDomain(domain: string): Promise<void> {
        const config = await this.getConfig();

        config.adminDomain = domain;

        await config.save();
    }
}
