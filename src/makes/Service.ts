export const REDIS_STORAGE_VOLUME = "volume";
export const REDIS_STORAGE_FILESYSTEM = "filesystem";
export type RedisStorageType = typeof REDIS_STORAGE_VOLUME | typeof REDIS_STORAGE_FILESYSTEM;

export type ServiceProps = {
    name: string;
    host?: string;
    image?: string;
    imageName?: string;
    imageVersion?: string;
    storage?: RedisStorageType;
    volume?: string;
};

export class Service {
    public name: string;
    public host?: string;
    protected _image?: string;
    protected _imageName?: string;
    protected _imageVersion?: string;
    public storage?: RedisStorageType;
    protected _volume?: string;

    public constructor(data: ServiceProps) {
        const {
            name,
            host,
            storage,
            image,
            imageName,
            imageVersion,
            volume
        } = data;

        this.name = name;
        this.host = host;
        this.storage = storage;
        this._image = image;
        this._imageName = imageName;
        this._imageVersion = imageVersion;
        this._volume = volume;

        if(!this.isExternal && !this.storage) {
            this.storage = REDIS_STORAGE_FILESYSTEM;
        }
    }

    public get isExternal(): boolean {
        return !!this.host;
    }

    public get image(): string {
        if(!this._image) {
            return `${this.imageName}:${this.imageVersion}`;
        }

        return this._image;
    }

    public get imageName(): string {
        if(this._image) {
            const [imageName = "redis"] = this._image.split(":");

            return imageName;
        }

        if(this._imageName) {
            return this._imageName;
        }

        return "redis";
    }

    public set imageName(imageName: string) {
        this._image = `${imageName}:${this.imageVersion}`;
    }

    public get imageVersion(): string {
        if(this._image) {
            const [, imageVersion = "latest"] = this._image.split(":");

            return imageVersion;
        }

        if(this._imageVersion) {
            return this._imageVersion;
        }

        return "latest";
    }

    public set imageVersion(imageVersion: string) {
        this._image = `${this.imageName}:${imageVersion}`;
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
            image: this.image,
            storage: this.storage,
            volume: this._volume && this._volume !== this.defaultVolumeName
                ? this._volume
                : undefined
        };
    }
}
