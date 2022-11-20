import { StorageAdapter, StorageValue } from '../utils/types'
import { LocalStorage } from 'node-localstorage'

export class NodeLocalStore implements StorageAdapter {
    localStorage: typeof LocalStorage
    constructor(storeFileName) {
        this.localStorage = new LocalStorage(`${storeFileName}`);
    }
    setValue(key: string, value: StorageValue) {
        this.localStorage.setItem(key, value as string)
    }
    getValue(key: string) {
        const value = this.localStorage.getItem(key) as string
        return value
    }
}
