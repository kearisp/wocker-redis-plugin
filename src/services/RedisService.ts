import {
    DockerService,
    FileSystem,
    Injectable,
    PluginConfigService,
    ProxyService
} from "@wocker/core";
import {promptInput, promptConfirm, promptSelect} from "@wocker/utils";
import CliTable from "cli-table3";
import {RedisPluginConfig} from "../makes/RedisPluginConfig";
import {Service, ServiceProps} from "../makes/Service";
import {StorageType} from "../types";


@Injectable()
export class RedisService {
    protected readonly commander: string = "redis-commander.workspace";
    protected _config?: RedisPluginConfig;

    public constructor(
        protected readonly dockerService: DockerService,
        protected readonly proxyService: ProxyService,
        protected readonly pluginConfigService: PluginConfigService
    ) {}

    public get config(): RedisPluginConfig {
        if(!this._config) {
            this._config = this.pluginConfigService.getConfig(RedisPluginConfig);
        }

        return this._config;
    }

    public get fs(): FileSystem {
        return this.pluginConfigService.fs;
    }

    public async create(serviceProps: Partial<ServiceProps> = {}): Promise<void> {
        if(!serviceProps.name || this.config.hasService(serviceProps.name)) {
            serviceProps.name = await promptInput({
                message: "Service name",
                type: "text",
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

        if(!serviceProps.host) {
            if(!serviceProps.storage || !StorageType.values().includes(serviceProps.storage)) {
                serviceProps.storage = await promptSelect<StorageType>({
                    message: "Storage type",
                    options: StorageType.options()
                });
            }

            if(!serviceProps.containerPort) {
                const needPort = await promptConfirm({
                    message: "Do you need to expose container port?",
                    default: false
                });

                if(needPort) {
                    serviceProps.containerPort = await promptInput({
                        required: true,
                        message: "Container port",
                        type: "number",
                        min: 1,
                        default: 6379
                    });
                }
            }
        }
        else {
            serviceProps.storage = undefined;
        }

        const service = new Service(serviceProps as ServiceProps);

        this.config.setService(service);
        this.config.save();

        console.info(`Service "${service.name}" created`);
    }

    public async destroy(name: string, yes?: boolean, force?: boolean): Promise<void> {
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

        await this.dockerService.removeContainer(service.containerName);

        switch(service.storage) {
            case StorageType.VOLUME: {
                if(await this.dockerService.hasVolume(service.volume)) {
                    await this.dockerService.rmVolume(service.volume);
                }
                break;
            }

            case StorageType.FS: {
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

        if(service.isExternal) {
            return;
        }

        let container = await this.dockerService.getContainer(service.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(service.containerName);

            container = null
        }

        if(!container) {
            await this.dockerService.pullImage(service.image);

            const volumes: string[] = [];

            switch(service.storage) {
                case StorageType.VOLUME: {
                    volumes.push(`${service.volume}:/data`);
                    break;
                }

                case StorageType.FS:
                default: {
                    this.fs.mkdir(service.name, {
                        recursive: true
                    });

                    volumes.push(`${this.fs.path(service.name)}:/data`);
                    break;
                }
            }

            container = await this.dockerService.createContainer({
                name: service.containerName,
                image: service.image,
                restart: "always",
                env: {
                    VIRTUAL_HOST: service.containerName
                },
                cmd: service.password
                    ? ["redis-server", "--requirepass", service.password]
                    : undefined,
                volumes,
                ports: service.containerPort
                    ? [`${service.containerPort}:6379`]
                    : undefined
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

    public async upgrade(name?: string, serviceProps: Partial<ServiceProps> = {}): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        if(serviceProps.storage) {
            if(![StorageType.FS, StorageType.VOLUME].includes(serviceProps.storage)) {
                throw new Error("Invalid storage type");
            }

            service.storage = serviceProps.storage;
        }

        if(serviceProps.volume) {
            service.volume = serviceProps.volume;
        }

        if(serviceProps.image) {
            service.image = serviceProps.image;
        }

        if(serviceProps.containerPort) {
            service.containerPort = serviceProps.containerPort;
        }

        if(serviceProps.password) {
            service.password = serviceProps.password;
        }

        this.config.setService(service);
        this.config.save();
    }

    public async stop(name?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        await this.dockerService.removeContainer(service.containerName);
    }

    public async redis(name?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        const container = await this.dockerService.getContainer(service.containerName);

        if(!container) {
            throw new Error(`Service "${service.name}" isn't started`);
        }

        await this.dockerService.exec(service.containerName, {
            tty: true,
            cmd: service.password
                ? ["redis-cli", "-a", service.password, "--no-auth-warning"]
                : ["redis-cli"]
        });
    }

    public async startCommander(): Promise<void> {
        await this.dockerService.removeContainer(this.commander);

        if(!this.config.admin.enabled) {
            return;
        }

        let container = await this.dockerService.getContainer(this.commander);

        if(!container) {
            await this.dockerService.pullImage("rediscommander/redis-commander:latest");

            const redisHosts: string[] = [];

            for(const service of this.config.services) {
                let host: string;

                if(service.host) {
                    host = service.host;
                }
                else {
                    const serviceContainer = await this.dockerService.getContainer(service.containerName);

                    if(!serviceContainer) {
                        continue;
                    }

                    const {
                        State: {
                            Running
                        }
                    } = await serviceContainer.inspect();

                    if(!Running) {
                        continue;
                    }

                    host = service.containerName;
                }

                redisHosts.push(
                    service.password
                        ? `${service.name}:${host}:6379:0:${service.password}`
                        : `${service.name}:${host}`
                );
            }

            if(redisHosts.length === 0) {
                return;
            }

            container = await this.dockerService.createContainer({
                name: this.commander,
                image: "rediscommander/redis-commander:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: this.config.admin.domain,
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

            console.info(`Redis commander started at http://${this.config.admin.domain}`);
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
                service.storage === StorageType.VOLUME ? service.volume : service.storage,
                service.image
            ]);
        }

        return table.toString();
    }

    public async changeDomain(domain: string): Promise<void> {
        this.config.admin.domain = domain;
        this.config.save();
    }
}
