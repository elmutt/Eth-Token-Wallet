import { ChainInfo, StorageAdapter } from "./utils/types"
import { decrypt, encrypt } from "./utils/encryptionHelpers"
import { getAddress, EthTx, signTx } from 'eth_mnemonic_signer'
import { erc20Abi } from './utils/erc20Abi'
import { ethers } from 'ethers'
import { validateMnemonic } from 'bip39'
const Web3 = require('web3')

const MNEMONIC_STORAGE_KEY = 'encryptedMnemonic'

export class TokenWallet {
    mnemonic: string
    private currentChainId: number
    storageAdapter: StorageAdapter
    supportedChains: ChainInfo[]

    constructor(storageAdapter: StorageAdapter, supportedChains: ChainInfo[]) {
        this.currentChainId = supportedChains[0].id
        this.storageAdapter = storageAdapter
        this.supportedChains = supportedChains
    }

    start = (password: string) => {
        if(this.isStarted()) throw new Error('already started')
        if(!this.isInitialized()) throw new Error('not initialized')
        const encryptedMnemonic = this.storageAdapter.getValue(MNEMONIC_STORAGE_KEY)
        if(!encryptedMnemonic) throw new Error('mnemonic not found')
        this.mnemonic = decrypt(encryptedMnemonic, password)
        if(!validateMnemonic(this.mnemonic)) throw new Error('incorrect password')
    }

    isStarted = () => !!this.mnemonic

    initialize = (password: string, mnemonic?: string) => {
        const newMnemonic = !!mnemonic ? mnemonic : ethers.Wallet.createRandom().mnemonic.phrase
        const encryptedMnemonic = encrypt(newMnemonic, password)
        this.storageAdapter.setValue(MNEMONIC_STORAGE_KEY, encryptedMnemonic)
        this.start(password)
    }

    isInitialized = () => {
        const encryptedMnemonic = this.storageAdapter.getValue(MNEMONIC_STORAGE_KEY)
        if(!encryptedMnemonic) return false
        return true
    }

    addChain = (newChain: ChainInfo) => {
        const index = this.supportedChains.findIndex( (chainInfo: ChainInfo) => newChain.id === chainInfo.id )
        if(index !== -1) this.supportedChains[index] = newChain
        else this.supportedChains.push(newChain)
    }

    switchChain = (chainId: number) => {
        if(!this.supportedChains.find( (chainInfo) => chainInfo.id === chainId )) throw new Error('unsupported chainId')
        this.currentChainId = chainId
    }

    getCurrentChain = () => this.supportedChains.find((chainInfo) => chainInfo.id === this.currentChainId)

    getAddress = () => {
        if(!this.isStarted() || !this.mnemonic) throw new Error('not started')
        return getAddress(this.mnemonic)
    }

    wipe = () => {
        this.storageAdapter.setValue(MNEMONIC_STORAGE_KEY, '')
        this.mnemonic = ''
    }

    signAndBroadcast = async (tx: EthTx): Promise<{txid: string, confirmPromise: Promise<any>}> => {
        if(!this.isStarted() || !this.mnemonic) throw new Error('not started')
        const signedTx = await signTx(tx, this.mnemonic)
        const txid = this.getWeb3().utils.sha3(signedTx)
        const confirmPromise = this.getWeb3().eth.sendSignedTransaction(signedTx)
        if(!txid) throw new Error('no txid')
        return { txid, confirmPromise }
    }

    ethTx = async ({to, value}: {to: string, value: string}) => {
        const web3 = this.getWeb3()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasLimit = 50000
        const gasPrice = await web3.eth.getGasPrice()
        return {
            to,
            nonce,
            value: Web3.utils.toHex(value),
            chainId: this.currentChainId,
            gasLimit,
            gasPrice: Web3.utils.toHex(gasPrice),
          }
    }

    erc20Tx = async ({to, value, tokenAddress}: {to: string, value: string, tokenAddress: string}) => {
        const web3 = this.getWeb3()
        const erc20Contract = new (web3.eth.Contract)(erc20Abi as any, tokenAddress)
        const erc20TxData = erc20Contract.methods.transfer(to, value).encodeABI()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasPrice = await web3.eth.getGasPrice()
        const gasLimit = 80000
        return {
            to: erc20Contract.options.address,
            nonce: nonce,
            data: erc20TxData,
            value: '0x0',
            chainId: this.currentChainId,
            gasLimit,
            gasPrice: Web3.utils.toHex(gasPrice),
          }
        
    }

    erc20Balance = async ({tokenAddress}: {tokenAddress: string}) => {
        const web3 = this.getWeb3()
        const erc20Contract = new (web3.eth.Contract)(erc20Abi as any, tokenAddress)
        return erc20Contract?.methods.balanceOf(await this.getAddress()).call()
    }

    ethBalance = async () => {
        const web3 = this.getWeb3()
        return web3.eth.getBalance(await this.getAddress())
    }

    getWeb3 = () => {
        const chainInfo = this.supportedChains.find( (chainInfo) => chainInfo.id === this.currentChainId )
        if(!chainInfo) throw new Error('no chainInfo')
        const provider = new (Web3.providers.HttpProvider)(chainInfo.rpcUrl)
        const web3 = new Web3(provider)
        return web3
    }
}