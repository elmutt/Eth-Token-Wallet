export type StorageValue = string

export interface StorageAdapter {
    setValue: (key: string, value: StorageValue) => void
    getValue: (key: string) => StorageValue
}

export type ChainInfo = {
    id: number,
    symbol: string,
    label: string,
    rpcUrl: string
}
