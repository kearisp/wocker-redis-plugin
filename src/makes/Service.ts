import {Config, ConfigProperties} from "@wocker/core";


export const REDIS_STORAGE_VOLUME = "volume";
export const REDIS_STORAGE_FILESYSTEM = "filesystem";
export type RedisStorageType = typeof REDIS_STORAGE_VOLUME | typeof REDIS_STORAGE_FILESYSTEM;

export type ServiceProps = ConfigProperties & {
    host?: string;
    storage?: RedisStorageType;
    volume?: string;
    // @deprecated
    image?: string;
    imageName?: string;
    imageVersion?: string;
};

export class Service extends Config<ServiceProps> {
    public host?: string;
    public storage?: RedisStorageType;
    protected _volume?: string;
    public imageName: string;
    public imageVersion: string;

    public constructor(data: ServiceProps) {
        super(data);

        const {
            host,
            storage,
            volume,
            image,
            imageName = image || "redis",
            imageVersion = "latest"
        } = data;

        this.host = host;
        this.storage = storage;
        this._volume = volume;
        this.imageName = imageName;
        this.imageVersion = imageVersion;

        if(!this.isExternal && !this.storage) {
            this.storage = REDIS_STORAGE_FILESYSTEM;
        }
    }

    public get isExternal(): boolean {
        return !!this.host;
    }

    public get imageTag(): string {
        return `${this.imageName}:${this.imageVersion}`;
    }

    public get containerName(): string {
        return `redis-${this.name}.ws`;
    }

    public set volume(volume: string) {
        this._volume = volume;
    }

    public get volume(): string {
        if(!this._volume) {
            this._volume = this.defaultVolumeName;
        }

        return this._volume;
    }

    public get defaultVolumeName(): string {
        return `wocker-redis-${this.name}`;
    }

    public toObject(): ServiceProps {
        return {
            name: this.name,
            host: this.host,
            storage: this.storage,
            volume: this._volume && this._volume !== this.defaultVolumeName
                ? this._volume
                : undefined
        };
    }
}
