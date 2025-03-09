import {
    AppConfigService,
    DockerService,
    FileSystem,
    Inject,
    Injectable,
    PLUGIN_DIR_KEY,
    ProxyService
} from "@wocker/core";
import {promptConfirm, promptSelect, promptText} from "@wocker/utils";
import CliTable from "cli-table3";

import {Config} from "../makes/Config";
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

                    fs.writeJSON("config.json", this.toObject());
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

    public async create(name?: string, host?: string, storage?: RedisStorageType, imageName?: string, imageVersion?: string): Promise<void> {
        if(!name || this.config.hasService(name)) {
            name = await promptText({
                message: "Service name:",
                type: "string",
                validate: (name?: string) => {
                    if(!name) {
                        return "Name is required";
                    }

                    if(this.config.hasService(name)) {
                        return `Service name "${name}" is already taken`;
                    }

                    return true;
                }
            }) as string;
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
            storage,
            imageName,
            imageVersion
        });

        this.config.setService(service);
        this.config.save();

        console.info(`Service "${service.name}" created`);
    }

    public async destroy(name: string, force?: boolean, yes?: boolean): Promise<void> {
        const service = this.config.getService(name);

        if(!force && this.config.default === name) {
            throw new Error("Can't delete default service");
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
            case REDIS_STORAGE_VOLUME: {
                if(await this.dockerService.hasVolume(service.volume)) {
                    await this.dockerService.rmVolume(service.volume);
                }
                break;
            }

            case REDIS_STORAGE_FILESYSTEM: {
                if(this.fs.exists(service.name)) {
                    this.fs.rm(service.name, {
                        recursive: true
                    });
                }
                break;
            }
        }

        this.config.removeService(name);
        this.config.save();
    }

    public async use(name: string): Promise<void> {
        const service = this.config.getService(name);

        this.config.default = service.name;

        this.config.save();
    }

    public async start(name?: string, restart?: boolean): Promise<void> {
        if(!name && !this.config.hasDefaultService()) {
            await this.create();
        }

        const service = this.config.getServiceOrDefault(name);

        let container = await this.dockerService.getContainer(service.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(service.containerName);

            container = null
        }

        if(!container) {
            await this.dockerService.pullImage(service.imageTag);

            const volumes: string[] = [];

            switch(service.storage) {
                case REDIS_STORAGE_VOLUME: {
                    volumes.push(`${service.volume}:/data`);
                    break;
                }

                case REDIS_STORAGE_FILESYSTEM:
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
                image: service.imageTag,
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

    public async upgrade(name?: string, storage?: RedisStorageType, volume?: string, image?: string, imageVersion?: string) {
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
            service.imageName = image;
        }

        if(imageVersion) {
            service.imageVersion = imageVersion;
        }

        this.config.setService(service);
        this.config.save();
    }

    public async stop(name?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        await this.dockerService.removeContainer(service.containerName);
    }

    public async startCommander(): Promise<void> {
        await this.dockerService.removeContainer(this.commander);

        let container = await this.dockerService.getContainer(this.commander);

        if(!container) {
            await this.dockerService.pullImage("rediscommander/redis-commander:latest");

            const redisHosts: string[] = [];

            for(const service of this.config.services) {
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
                    VIRTUAL_HOST: this.config.adminDomain,
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

            console.info(`Redis commander started at http://${this.config.adminDomain}`);
        }
    }

    public async getServiceNames(): Promise<string[]> {
        return this.config.services.map((service) => {
            return service.name;
        });
    }

    public async getListTable(): Promise<string> {
        const table = new CliTable({
            head: ["Name", "Host", "Storage", "Image"]
        });

        for(const service of this.config.services || []) {
            table.push([
                service.name + (this.config.default === service.name ? " (default)" : ""),
                service.isExternal ? service.host : service.containerName,
                service.storage === REDIS_STORAGE_VOLUME ? service.volume : "",
                service.imageTag
            ]);
        }

        return table.toString();
    }

    public async update(name?: string, storage?: string, volume?: string, imageName?: string, imageVersion?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);
        let changed = false;

        if(storage) {
            if(![REDIS_STORAGE_FILESYSTEM, REDIS_STORAGE_VOLUME].includes(storage)) {
                throw new Error("Invalid storage type");
            }

            service.storage = storage as RedisStorageType;
            changed = true;
        }

        if(volume) {
            service.volume = volume;
            changed = true;
        }

        if(imageName) {
            service.imageName = imageName;
            changed = true;
        }

        if(imageVersion) {
            service.imageVersion = imageVersion;
            changed = true;
        }

        if(changed) {
            this.config.setService(service);
            this.config.save();
        }
    }

    public async changeDomain(domain: string): Promise<void> {
        this.config.adminDomain = domain;

        this.config.save();
    }
}
