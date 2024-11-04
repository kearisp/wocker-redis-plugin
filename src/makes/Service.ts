
export const REDIS_STORAGE_FILESYSTEM = "filesystem";
export const REDIS_STORAGE_VOLUME = "volume";
export type RedisStorageType = typeof REDIS_STORAGE_FILESYSTEM | typeof REDIS_STORAGE_VOLUME;

export type ServiceProps = {
    name: string;
    host?: string;
    storage?: RedisStorageType;
};

export class Service {
    public name: string;
    public host?: string;
    public storage?: RedisStorageType;

    public constructor(data: ServiceProps) {
        const {
            name,
            host,
            storage
        } = data;

        this.name = name;
        this.host = host;
        this.storage = storage;

        if(!this.isExternal && !this.storage) {
            this.storage = "filesystem";
        }
    }

    public get isExternal(): boolean {
        return !!this.host;
    }

    public get containerName(): string {
        return `redis-${this.name}.ws`;
    }

    public get volumeName(): string {
        return `wocker-redis-${this.name}`;
    }

    public toJSON(): ServiceProps {
        return {
            name: this.name,
            host: this.host,
            storage: this.storage
        };
    }
}
