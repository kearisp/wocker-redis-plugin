import {PickProperties} from "@wocker/core";

import {
    Service,
    ServiceProps
} from "./Service";


export type ConfigProps = Omit<PickProperties<Config>, "services"> & {
    services?: ServiceProps[];
};

export abstract class Config {
    public defaultService?: string;
    public services: Service[] = [];

    public constructor(data: ConfigProps) {
        const {
            defaultService,
            services = []
        } = data;

        this.defaultService = defaultService;
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
        if(!this.defaultService) {
            return;
        }

        return this.getService(this.defaultService);
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
            defaultService: this.defaultService,
            services: this.services.length > 0
                ? this.services.map((service) => {
                    return service.toJSON();
                })
                : undefined
        };
    }
}
