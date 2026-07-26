export enum StorageTypeEnum {
    VOLUME = "volume",
    FS = "filesystem"
}

export type StorageType = StorageTypeEnum;

export const StorageType = Object.assign({}, StorageTypeEnum, {
    values: () => Object.values(StorageTypeEnum),
    options: () => StorageType.values().map((type) => {
        return {
            label: StorageType.label(type),
            value: type
        };
    }),
    label: (type: StorageTypeEnum) => {
        switch(type) {
            case StorageTypeEnum.FS:
                return "File System";

            case StorageTypeEnum.VOLUME:
                return "Volume";
        }
    }
});
