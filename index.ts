import { ChainInfo, StorageAdapter } from "./utils/types"
import { decrypt, encrypt } from "./utils/encryptionHelpers"
import { getAddress, signTx, validateMnemonic } from 'eth_mnemonic_signer'
import { erc20Abi } from './utils/erc20Abi'
import { ethers } from 'ethers'
const Web3 = require('web3')

const MNEMONIC_STORAGE_KEY = 'encryptedMnemonic'
const SUPPORTED_CHAINS_KEY = 'supportedChains'
const CURRENT_CHAINID_KEY = 'lastChainId'
const BIP44_PATH_KEY = 'bip44Path'

export * from './storageAdapters/index'

export class TokenWallet {
    mnemonic: string
    storageAdapter: StorageAdapter

    constructor(storageAdapter: StorageAdapter) {
        this.storageAdapter = storageAdapter
    }

    start = async (password: string) => {
        if(this.isStarted()) throw new Error('already started')
        if(!this.isInitialized()) throw new Error('not initialized')
        const encryptedMnemonic = this.storageAdapter.getValue(MNEMONIC_STORAGE_KEY)
        if(!encryptedMnemonic) throw new Error('mnemonic not found')
        this.mnemonic = await decrypt(encryptedMnemonic, password)
        if(!validateMnemonic(this.mnemonic)) throw new Error('incorrect password')
    }

    isStarted = () => !!this.mnemonic

    initialize = async (supportedChains: ChainInfo[], password: string, mnemonic?: string) => {
        const newMnemonic = !!mnemonic ? mnemonic : ethers.Wallet.createRandom().mnemonic.phrase
        const encryptedMnemonic = await encrypt(newMnemonic, password)
        this.storageAdapter.setValue(MNEMONIC_STORAGE_KEY, encryptedMnemonic)
        this.storageAdapter.setValue(SUPPORTED_CHAINS_KEY, JSON.stringify(supportedChains))
        this.switchChain(supportedChains[0].id)
        this.setBip44Path(`m/44'/60'/0'/0/0`)
        await this.start(password)
    }

    setBip44Path = (newPath: string) => {
        this.storageAdapter.setValue(BIP44_PATH_KEY, newPath)
    }

    getBip44Path = () => {
        return this.storageAdapter.getValue(BIP44_PATH_KEY)
    }

    isInitialized = () => {
        const encryptedMnemonic = this.storageAdapter.getValue(MNEMONIC_STORAGE_KEY)
        if(!encryptedMnemonic) return false
        return true
    }

    addChain = (newChain: ChainInfo) => {
        const supportedChains = this.getSupportedChains()
        const index = supportedChains.findIndex( (chainInfo: ChainInfo) => newChain.id === chainInfo.id )
        if(index !== -1) supportedChains[index] = newChain
        else supportedChains.push(newChain)
        this.storageAdapter.setValue(SUPPORTED_CHAINS_KEY, JSON.stringify(supportedChains))
    }

    switchChain = (chainId: number) => {
        if(!this.getSupportedChains().find( (chainInfo) => chainInfo.id === chainId )) throw new Error('unsupported chainId')
        this.storageAdapter.setValue(CURRENT_CHAINID_KEY, chainId.toString())
    }

    getCurrentChain = () => this.getSupportedChains().find((chainInfo) => chainInfo.id === parseInt(this.storageAdapter.getValue(CURRENT_CHAINID_KEY)))

    getAddress = () => {
        if(!this.isStarted() || !this.mnemonic) throw new Error('not started')
        return getAddress(this.mnemonic, this.getBip44Path())
    }

    wipe = () => {
        this.storageAdapter.setValue(MNEMONIC_STORAGE_KEY, '')
        this.storageAdapter.setValue(SUPPORTED_CHAINS_KEY, '')
        this.storageAdapter.setValue(CURRENT_CHAINID_KEY, '')
        this.storageAdapter.setValue(BIP44_PATH_KEY, '')
        this.mnemonic = ''
    }

    signAndBroadcast = async (tx: any): Promise<{txid: string, confirmPromise: Promise<any>}> => {
        if(!this.isStarted() || !this.mnemonic) throw new Error('not started')
        const signedTx = await signTx(tx, this.mnemonic, this.getBip44Path())
        const txid = this.getWeb3().utils.sha3(signedTx)
        const confirmPromise = this.getWeb3().eth.sendSignedTransaction(signedTx)
        if(!txid) throw new Error('no txid')
        return { txid, confirmPromise }
    }

    ethTx = async ({to, value}: {to: string, value: string}) => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasLimit = await this.getWeb3().eth.estimateGas({ from: await this.getAddress(), nonce, to, value: Web3.utils.toHex(value) })

        const gasPrice = await web3.eth.getGasPrice()
        return {
            to,
            nonce,
            value: Web3.utils.toHex(value),
            chainId: parseInt(this.storageAdapter.getValue(CURRENT_CHAINID_KEY)),
            gasLimit,
            gasPrice: Web3.utils.toHex(gasPrice),
          }
    }

    erc20Tx = async ({to, value, tokenAddress}: {to: string, value: string, tokenAddress: string}) => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        const erc20Contract = new (web3.eth.Contract)(erc20Abi as any, tokenAddress)
        const data = erc20Contract.methods.transfer(to, value).encodeABI()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasPrice = await web3.eth.getGasPrice()

        const gasLimit = await this.getWeb3().eth.estimateGas({ from: await this.getAddress(), nonce, to: erc20Contract.options.address, data, value: '0x0' })

        return {
            to: erc20Contract.options.address,
            nonce,
            data,
            value: '0x0',
            chainId: parseInt(this.storageAdapter.getValue(CURRENT_CHAINID_KEY)),
            gasLimit,
            gasPrice: Web3.utils.toHex(gasPrice),
          }
        
    }

    customDataTx = async ({to, value, data}: {to?: string, value?: string, data?: string}) => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasPrice = await web3.eth.getGasPrice()
        const gasLimit = await this.getWeb3().eth.estimateGas({ from: await this.getAddress(), nonce, to, data, value: Web3.utils.toHex(value) })

        return {
            to,
            nonce,
            data,
            value: Web3.utils.toHex(value),
            chainId: parseInt(this.storageAdapter.getValue(CURRENT_CHAINID_KEY)),
            gasLimit,
            gasPrice: Web3.utils.toHex(gasPrice),
          }
    }

    erc20Balance = async ({tokenAddress}: {tokenAddress: string}) => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        const erc20Contract = new (web3.eth.Contract)(erc20Abi as any, tokenAddress)
        return erc20Contract?.methods.balanceOf(await this.getAddress()).call()
    }

    erc20Balances = async ({tokenAddresses}: {tokenAddresses: string[]}) => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        const address = await this.getAddress()
        const balancePromises: any[] = []
        for(let i=0;i<tokenAddresses.length;i++) {
            const tokenAddress =  tokenAddresses[i]
            const erc20Contract = new (web3.eth.Contract)(erc20Abi as any, tokenAddress)
            balancePromises.push(erc20Contract?.methods.balanceOf(address).call())
        }
        const balanceResults = await Promise.all(balancePromises)
        const resultObject = {}
        tokenAddresses.forEach( (tokenAddress, index) => resultObject[tokenAddress] = balanceResults[index])
        return resultObject
    }

    ethBalance = async () => {
        if(!this.isStarted()) throw new Error('not started')
        const web3 = this.getWeb3()
        return web3.eth.getBalance(await this.getAddress())
    }

    getWeb3 = () => {
        if(!this.isStarted()) throw new Error('not started')
        const chainInfo = this.getSupportedChains().find( (chainInfo) => chainInfo.id === parseInt(this.storageAdapter.getValue(CURRENT_CHAINID_KEY)) )
        if(!chainInfo) throw new Error('no chainInfo')
        const provider = new (Web3.providers.HttpProvider)(chainInfo.rpcUrl)
        const web3 = new Web3(provider)
        return web3
    }

    txCount = async () => {
        return this.getWeb3().eth.getTransactionCount(await this.getAddress())
    }

    getSupportedChains = () => JSON.parse(this.storageAdapter.getValue(SUPPORTED_CHAINS_KEY))
}