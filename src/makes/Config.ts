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
    }

    public removeService(name: string): void {
        this.services = this.services.filter((service) => {
            return service.name !== name;
        });
    }

    public getService(name: string): Service | undefined {
        return this.services.find((service) => {
            return service.name === name;
        });
    }

    public getDefaultService(): Service | undefined {
        if(!this.default) {
            return;
        }

        return this.getService(this.default);
    }

    public getServiceOrDefault(name?: string) {
        const service = name
            ? this.getService(name)
            : this.getDefaultService();

        if(!service) {
            throw new Error(
                name
                    ? `Service "${name}" not found`
                    : `Default service not found`
            );
        }

        return service;
    }

    public abstract save(): Promise<void>;

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
