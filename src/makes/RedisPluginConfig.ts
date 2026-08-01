import {PluginConfig} from "@wocker/core";
import {Service, ServiceProps} from "./Service";


export type AdminConfig = {
    enabled: boolean;
    domain: string;
};

export type ConfigProps = {
    /** @deprecated */
    adminDomain?: string;
    /** @deprecated */
    defaultService?: string;
    default?: string;
    services?: ServiceProps[];
    admin?: Partial<AdminConfig>;
};

export class RedisPluginConfig extends PluginConfig {
    public default?: string;
    public services: Service[];
    public admin: AdminConfig;

    public constructor(data: ConfigProps) {
        super(data);

        const {
            adminDomain,
            default: defaultService,
            defaultService: oldDefaultService,
            services = [],
            admin: {
                enabled: adminEnabled = true,
                domain: adminDomain2 = adminDomain || "redis-commander.workspace"
            } = {}
        } = data;

        this.default = defaultService || oldDefaultService;
        this.services = services.map((value) => new Service(value));
        this.admin = {
            enabled: adminEnabled,
            domain: adminDomain2
        };
    }

    public hasService(name: string): boolean {
        const service = this.services.find((service) => {
            return service.name === name;
        });

        return !!service;
    }

    public setService(service: Service): void {
        let exists = false;

        for(let i = 0; i < this.services.length; i++) {
            if(this.services[i].name === service.name) {
                exists = true;

                this.services[i] = service;
            }
        }

        if(!exists) {
            this.services.push(service);
        }

        if(!this.default) {
            this.default = service.name;
        }
    }

    public removeService(name: string): void {
        this.services = this.services.filter((service) => {
            return service.name !== name;
        });

        if(this.default === name) {
            delete this.default;
        }
    }

    public getService(name: string): Service {
        const service = this.services.find((service) => {
            return service.name === name;
        });

        if(!service) {
            throw new Error(`Service "${name}" not found`);
        }

        return service;
    }

    public getDefaultService(): Service {
        if(!this.default) {
            throw new Error("No services are installed by default");
        }

        return this.getService(this.default);
    }

    public getServiceOrDefault(name?: string): Service {
        if(!name) {
            return this.getDefaultService();
        }

        return this.getService(name);
    }

    public hasDefaultService(): boolean {
        if(!this.default) {
            return false;
        }

        return this.hasService(this.default);
    }

    public toObject(): ConfigProps {
        return {
            default: this.default,
            admin: this.admin,
            services: this.services.length > 0
                ? this.services.map((service) => service.toObject())
                : undefined
        };
    }
}
