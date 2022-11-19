Wallet functionality (eth / erc20) on any evm chain

Example:

```
const supportedChains: ChainInfo[] = [
  {
    id: 100,
    rpcUrl: 'https://rpc.ankr.com/gnosis' // a public gnosis node
  },
  {
    id: 1,
    rpcUrl: '' // Your eth mainnet node goes here - infura, etc.
  },
  ... (add additional evm chains here)
]

// Encrypted wallet persists in localStorage
const store = new BrowserStore()
const wallet = new TokenWallet(store)

// unlock and decrypt wallet if already setup
if (wallet.isInitialized()) wallet.Start('password123')
// otherwise initialize and encrypt a new wallet
else wallet.initialize(supportedChains, 'password123', 'all all all all all all all all all all all all')
```

Functions:

```
// create unsigned tx with recommended gas limit and price
await wallet.ethTx({ to, value })
await wallet.erc20Tx({ to, value, tokenAddress })
await wallet.customDataTx({ to, value, data })

await wallet.signAndBroadcast(tx)

await wallet.getAddress()

await wallet.getCurrentChain()

await wallet.getBip44Path()

await wallet.erc20Balance({ tokenAddress })

wallet.wipe() // wipe encrypted wallet from storage

wallet.initialize(supportedChains, password, mnemonic)

wallet.start()

wallet.isStarted()

wallet.isInitialized()

wallet.addChain({ id, rpcUrl })

wallet.switchChain(newChainId)

wallet.setBip44Path(newPath)
```