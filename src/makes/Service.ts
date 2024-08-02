export type ServiceProps = {
    name: string;
    host?: string;
};

export class Service {
    public name: string;
    public host?: string;

    public constructor(data: ServiceProps) {
        const {
            name,
            host
        } = data;

        this.name = name;
        this.host = host;
    }

    public get containerName(): string {
        return `redis-${this.name}.ws`;
    }

    public toJSON(): ServiceProps {
        return {
            name: this.name,
            host: this.host
        };
    }
}
