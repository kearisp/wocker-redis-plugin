export type ServiceProps = {
    name: string;
};

export class Service {
    public name: string;

    public constructor(data: ServiceProps) {
        const {
            name
        } = data;

        this.name = name;
    }

    public get containerName(): string {
        return `redis-${this.name}.ws`;
    }

    public toJSON(): ServiceProps {
        return {
            name: this.name
        };
    }
}
