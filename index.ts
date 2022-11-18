import { ChainInfo, StorageAdapter } from "./utils/types"
import { decrypt, encrypt } from "./utils/encryptionHelpers"
import { getAddress, EthTx, signTx } from 'eth_mnemonic_signer'
import { erc20Abi } from './utils/erc20Abi'
import { ethers } from 'ethers'
import { validateMnemonic } from 'bip39'
const Web3 = require('web3')

const MNEMONIC_STORAGE_KEY = 'encryptedMnemonic'
const SUPPORTED_CHAINS_KEY = 'supportedChains'
const CURRENT_CHAINID_KEY = 'lastChainId'
const BIP44_PATH_KEY = 'bip44Path'

export class TokenWallet {
    mnemonic: string
    storageAdapter: StorageAdapter

    constructor(storageAdapter: StorageAdapter) {
        this.storageAdapter = storageAdapter
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

    initialize = (supportedChains: ChainInfo[], password: string, mnemonic?: string) => {
        const newMnemonic = !!mnemonic ? mnemonic : ethers.Wallet.createRandom().mnemonic.phrase
        const encryptedMnemonic = encrypt(newMnemonic, password)
        this.storageAdapter.setValue(MNEMONIC_STORAGE_KEY, encryptedMnemonic)
        this.storageAdapter.setValue(SUPPORTED_CHAINS_KEY, JSON.stringify(supportedChains))
        this.switchChain(supportedChains[0].id)
        this.setBip44Path(`m/44'/60'/0'/0/0`)
        this.start(password)
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

    signAndBroadcast = async (tx: EthTx): Promise<{txid: string, confirmPromise: Promise<any>}> => {
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
        const gasLimit = 50000
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
        const erc20TxData = erc20Contract.methods.transfer(to, value).encodeABI()
        const nonce = await web3.eth.getTransactionCount(await this.getAddress())
        const gasPrice = await web3.eth.getGasPrice()
        const gasLimit = 80000
        return {
            to: erc20Contract.options.address,
            nonce: nonce,
            data: erc20TxData,
            value: '0x0',
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

    getSupportedChains = () => JSON.parse(this.storageAdapter.getValue(SUPPORTED_CHAINS_KEY))
}