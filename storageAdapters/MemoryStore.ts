import { StorageAdapter, StorageValue } from "../utils/types";

export class MemoryStore implements StorageAdapter {
    store: any = {}
    setValue(key: string, value: StorageValue) {
        this.store[key] = value
    }
    getValue(key: string) {
        return this.store[key]
    }
}