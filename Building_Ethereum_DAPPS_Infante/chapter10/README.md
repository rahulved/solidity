#Running mocha tests

1. Install mocha suite
npm install -g mocha
npm install -g ganache
npm install web3
npm install solc@0.8.13

2. Run ganache
ganache -p 9545

2. Change SimpleCoin.sol as required to point to correct correct directory for SimpleCoin.sol and local node port (if not running on port 9545)

4. mocha test/testSimpleCoin.js
 
