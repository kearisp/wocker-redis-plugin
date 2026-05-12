import {Image} from "@wocker/utils";
import {StorageType} from "../types";


export type ServiceProps = {
    name: string;
    host?: string;
    image?: string;
    /** @deprecated */
    imageName?: string;
    /** @deprecated */
    imageVersion?: string;
    storage?: StorageType;
    volume?: string;
    containerPort?: number;
};

export class Service {
    public name: string;
    public host?: string;
    protected _image?: string;
    public storage?: StorageType;
    protected _volume?: string;
    public containerPort?: number;

    public constructor(data: ServiceProps) {
        const {
            name,
            host,
            storage,
            imageName,
            imageVersion,
            image = imageName && imageVersion ? `${imageName}:${imageVersion}` : imageName,
            volume,
            containerPort
        } = data;

        this.name = name;
        this.host = host;
        this.storage = storage;
        this._volume = volume;
        this._image = image;
        this.containerPort = containerPort;

        if(!this.isExternal && !this.storage) {
            this.storage = StorageType.FS;
        }
    }

    public get isExternal(): boolean {
        return !!this.host;
    }

    public get image(): string {
        if(!this._image) {
            return "redis:8.6.2";
        }

        return this._image;
    }

    public set image(image: string | undefined) {
        if(!image) {
            delete this._image;
            return;
        }

        if(!Image.isValid(image)) {
            throw new Error(`Invalid image ${image}`);
        }

        this._image = image;
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
            volume: this._volume
        };
    }
}
