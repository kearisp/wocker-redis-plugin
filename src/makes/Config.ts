import {Service, ServiceProps} from "./Service";


export type ConfigProps = {
    adminDomain?: string;
    default?: string;
    defaultService?: string;
    services?: ServiceProps[];
};

export abstract class Config {
    public adminDomain: string;
    public default?: string;
    public services: Service[] = [];

    public constructor(data: ConfigProps) {
        const {
            adminDomain = "redis-commander.workspace",
            default: defaultService,
            defaultService: oldDefault,
            services = []
        } = data;

        this.adminDomain = adminDomain;
        this.default = defaultService || oldDefault;
        this.services = (services || []).map((value) => {
            return new Service(value);
        });
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

    public abstract save(): void;

    public toJSON(): ConfigProps {
        return {
            adminDomain: this.adminDomain,
            default: this.default,
            services: this.services.length > 0
                ? this.services.map((service) => {
                    return service.toObject();
                })
                : undefined
        };
    }
}
