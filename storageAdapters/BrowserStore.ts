import { StorageAdapter, StorageValue } from "../utils/types";

export class BrowserStore implements StorageAdapter {
    // TODO
    store: any = {}
    setValue(key: string, value: StorageValue) {
        window.localStorage.setItem(key, value as string)
    }
    getValue(key: string) {
        const value = window.localStorage.getItem(key) as string
        return value
    }
}
