import { StorageAdapter, StorageValue } from "../utils/types";

export class BrowserStore implements StorageAdapter {
    // TODO
    store: any = {}
    setValue(key: string, value: StorageValue) {
        this.store[key] = value
    }
    getValue(key: string) {
        return this.store[key]
    }
}