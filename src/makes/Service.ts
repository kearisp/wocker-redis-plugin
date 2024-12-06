import {Config, ConfigProperties} from "@wocker/core";


export const REDIS_STORAGE_FILESYSTEM = "filesystem";
export const REDIS_STORAGE_VOLUME = "volume";
export type RedisStorageType = typeof REDIS_STORAGE_FILESYSTEM | typeof REDIS_STORAGE_VOLUME;

export type ServiceProps = ConfigProperties & {
    host?: string;
    storage?: RedisStorageType;
    volume?: string;
};

export class Service extends Config<ServiceProps> {
    public host?: string;
    public storage?: RedisStorageType;
    public volume?: string;

    public constructor(data: ServiceProps) {
        super(data);

        const {
            host,
            storage,
            volume
        } = data;

        this.host = host;
        this.storage = storage;

        if(!this.isExternal && !this.storage) {
            this.storage = "filesystem";
        }

        this.volume = volume;

        if(this.storage === "volume" && !this.volume) {
            this.volume = this.defaultVolumeName;
        }
    }

    public get isExternal(): boolean {
        return !!this.host;
    }

    public get containerName(): string {
        return `redis-${this.name}.ws`;
    }

    public get volumeName(): string {
        if(!this.volume) {
            return this.defaultVolumeName;
        }

        return this.volume;
    }

    public get defaultVolumeName(): string {
        return `wocker-redis-${this.name}`;
    }

    public toJSON(): ServiceProps {
        return {
            name: this.name,
            host: this.host,
            storage: this.storage,
            volume: this.volume && this.volume !== this.defaultVolumeName
                ? this.volume
                : undefined
        };
    }
}
