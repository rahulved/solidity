const fs = require('fs');
const solc = require('solc');
const Web3 = require('web3');
const net = require('net');
//Change as required below
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));  
const assert=require('assert');

//Change source file as required below
const simpleSource = fs.readFileSync('/home/rahul/dev/ethereum/code/simplecoin/SimpleCoin.sol', 'UTF-8');


var simpleInput = {
    language: 'Solidity',
    sources: {
        'SimpleCoin' : {
            content: simpleSource
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ '*' ]
            }
        }
    }
};     


let simpleCompiledContract=JSON.parse(solc.compile(JSON.stringify(simpleInput)));
const simpleAbi=simpleCompiledContract.contracts['SimpleCoin']['SimpleCoin'].abi;
const simpleBytecode='0x'+simpleCompiledContract.contracts['SimpleCoin']['SimpleCoin'].evm.bytecode.object;

let initialSupply=10000;
let accounts;
let simpleCoinContract;
let owner;


beforeEach(async() => {
    gasEstimate = 3000000;
    console.log("Gas Estimate = "+gasEstimate);
    accounts = await web3.eth.getAccounts();
        
    simpleCoinContract=await new web3.eth.Contract(simpleAbi).deploy({data:simpleBytecode, arguments:[initialSupply]}).send({from: accounts[0], gas: gasEstimate});
    owner = await simpleCoinContract.methods.owner().call();
});

describe('SimpleCoin Construction', () => {
    it('Check Owner is Sender', async () => {
        //owner = await simpleCoinContract.methods.owner().call();
        assert.equal(owner, accounts[0]);
    });
    it('Check owner balance is initial supply', async() => {
        owner = await simpleCoinContract.methods.owner().call();
        ownerBalance = await simpleCoinContract.methods.coinBalance(owner).call();
        assert.equal(ownerBalance, initialSupply);
    });
});   

describe('SimpleCoin.mint OnlyOwner', () => {
    it('Check not owner cannot mint', () => {
        assert.rejects(simpleCoinContract.methods.mint(accounts[2], 1000).send({from:accounts[1], gas:3000000}));
    }); 
    it('Check owner can mint', async ()=> {
        let numCoinsToMint = 1000;
        receipient=accounts[1];
        let initialCoinBalance=await simpleCoinContract.methods.coinBalance(receipient).call();
        await simpleCoinContract.methods.mint(receipient, numCoinsToMint).send({from:owner, gas:3000000});
        let newCoinBalance = await simpleCoinContract.methods.coinBalance(receipient).call();
        assert.equal(newCoinBalance-initialCoinBalance, numCoinsToMint);
    });
}); 

let authorizer;
let authorized;

describe("SimpleCoin.transfer Constraints", ()=> {
    it('Cannot transfer a number of tokens higher than that of tokens owned', async () => {

        let sender = accounts[1];
        let recipient = accounts[2];
        let tokensToTransfer = 12000;
        assert.rejects(simpleCoinContract.methods.transfer(receipient, tokensToTransfer).send({from:sender, gas:3000000}));
    });     
    it('Can transfer tokens from owner to receipient', async() => {
        let recipient = accounts[2];
        let tokensToTransfer = 2000;
        let ownerInitialBalance = parseInt(await simpleCoinContract.methods.coinBalance(owner).call());
        let recipientInitialBalance = parseInt(await simpleCoinContract.methods.coinBalance(receipient).call());
        await simpleCoinContract.methods.transfer(receipient, tokensToTransfer).send({from:owner, gas:3000000});        
        let ownerNewBalance = parseInt(await simpleCoinContract.methods.coinBalance(owner).call());
        let recipientNewBalance = parseInt(await simpleCoinContract.methods.coinBalance(receipient).call());
        assert.equal(ownerNewBalance, ownerInitialBalance-tokensToTransfer);
        assert.equal(recipientNewBalance, recipientInitialBalance+tokensToTransfer);
    });       
});

    
describe('SimpleCoin.authorize', () => {
    let authorizer;
    let authorized;
    let allowance = 300;

    it('Successful authorization: the allowance of the authorized account is set correctly', async () => {         
        authorizer = accounts[2];
        authorized = accounts[3];        
         await simpleCoinContract.methods.authorize(authorized, allowance).send({from: authorizer, gas:3000000});
         
         let authorizedAllowance = parseInt(await simpleCoinContract.methods.allowance(authorizer, authorized).call());
         assert.equal(allowance, authorizedAllowance);    
    });
    it('Cannot transfer greater than authorized amount', async() => {
        let recipient=accounts[4];
        await simpleCoinContract.methods.mint(authorizer, allowance*2).send({from:owner, gas:3000000});
        await simpleCoinContract.methods.authorize(authorized, allowance).send({from: authorizer, gas:3000000});
        assert.rejects(simpleCoinContract.methods.transferFrom(authorizer, recipient, allowance+1).send({from:authorized, gas:3000000}));            
    });
    it('Can transfer authorized amount successfully', async() => {
        await simpleCoinContract.methods.mint(authorizer, allowance*2).send({from:owner, gas:3000000});
        await simpleCoinContract.methods.authorize(authorized, allowance).send({from: authorizer, gas:3000000});
        let recipient=accounts[4];
        let initialBalanceRecipient = parseInt(await simpleCoinContract.methods.coinBalance(recipient).call());
        let initialBalanceAuthorizer = parseInt(await simpleCoinContract.methods.coinBalance(authorizer).call());
        let initialBalanceAuthorized = parseInt(await simpleCoinContract.methods.coinBalance(authorized).call());        
        await simpleCoinContract.methods.transferFrom(authorizer, recipient, allowance).send({from:authorized, gas:3000000});
        let newBalanceRecipient = parseInt(await simpleCoinContract.methods.coinBalance(recipient).call());
        let newBalanceAuthorizer = parseInt(await simpleCoinContract.methods.coinBalance(authorizer).call());
        let newBalanceAuthorized = parseInt(await simpleCoinContract.methods.coinBalance(authorized).call());  
        assert.equal(newBalanceRecipient, initialBalanceRecipient+allowance);            
        assert.equal(newBalanceAuthorizer, initialBalanceAuthorizer-allowance);
        assert.equal(newBalanceAuthorized, initialBalanceAuthorized);
    });
    it('Authorized amount is exhausted successfully', async() => {
        await simpleCoinContract.methods.mint(authorizer, allowance*2).send({from:owner, gas:3000000});
        await simpleCoinContract.methods.authorize(authorized, allowance).send({from: authorizer, gas:3000000});
        let recipient=accounts[4];
        let tokensToTransfer=Math.floor(allowance/2);
        let initialAuthorization = parseInt(await simpleCoinContract.methods.allowance(authorizer, authorized).call());
        await simpleCoinContract.methods.transferFrom(authorizer, recipient, tokensToTransfer).send({from:authorized, gas:3000000});
        let newAuthorization = parseInt(await simpleCoinContract.methods.allowance(authorizer, authorized).call());
        assert.equal(newAuthorization, initialAuthorization-tokensToTransfer);              
    });
    it('Cannot transfer from an account that has not been authorized', async() => {
        await simpleCoinContract.methods.mint(authorizer, allowance*2).send({from:owner, gas:3000000});
        let recipient=accounts[4];
        let tokensToTransfer=Math.floor(allowance/2);
        assert.rejects(simpleCoinContract.methods.transferFrom(authorizer, recipient, tokensToTransfer).send({from:authorized, gas:3000000}));                                            
    });
});    
