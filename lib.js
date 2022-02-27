const Web3 = require("web3");
const Provider = require("@truffle/hdwallet-provider");
const config = require("./config.js");
const abi = require("./abi.json");
var colors = require("colors/safe");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const predictions = config.predictions;

const privateKey = process.env.PRIVATE_KEY;
let tempweb3 = new Web3("https://polygon-rpc.com/");
const operator = tempweb3.eth.accounts.privateKeyToAccount(
  process.env.PRIVATE_KEY
);

const operatorAddress = operator.address;
const contracts = {};
const web3s = {};
const rpcCache = {};

const coloredLog = (pid, ...txt) => {
  const title = predictions[pid].title ? predictions[pid].title : pid;
  console.log(colors[predictions[pid].color](title + " : " + txt.join(" ")));
};

const getWeb3 = (pid) => {
  const predictionData = predictions[pid];
  let web3;
  if (web3s[predictionData.network]) web3 = web3s[predictionData.network];
  else {
    web3 = new Web3(rpcCache[predictionData.network].currentRpc);
    web3s[predictionData.network] = web3;
  }
  return web3;
};

const getGasPrice = async (pid) => {
  const predictionData = predictions[pid];
  const networkConfig = config.networkSettings[predictionData.network];
  const fallbackGas = networkConfig.gasPrice;
  if (networkConfig.checkGas) {
    try {
      const data = await fetch(networkConfig.gasApi);
      const dataJson = await data.json();
      const gasLevel = networkConfig.gasLevel
        ? networkConfig.gasLevel
        : "FastGasPrice";
      const gas = dataJson.result[gasLevel];
      const gasOffset = networkConfig.gasOffset ? networkConfig.gasOffset : 0;
      const gasPriceWei = getWeb3(pid).utils.toWei(
        (parseFloat(gas) + gasOffset).toString(),
        "gwei"
      );
      return gasPriceWei.toString();
    } catch (err) {
      return fallbackGas;
    }
  } else return fallbackGas;
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const startExecuteRound = async (pid, data) => {
  const date = new Date(Date.now()).toLocaleString();

  coloredLog(pid, "calling executeRound @  " + date);
  const gasPrice = await getGasPrice(pid);
  coloredLog(pid, "using gasPrice: " + gasPrice);

  const predictionContract = getPredictionContract(pid);

  try {
    const nonce = await getWeb3(pid).eth.getTransactionCount(operatorAddress);
    const receipt = await predictionContract.methods
      .executeRound()
      .send({ from: operatorAddress, gasPrice, nonce });

    if (receipt) {
      coloredLog(pid, `Transaction hash: ${receipt.transactionHash}`);
      return successExecuteRound(pid);
    }
  } catch (error) {
    coloredLog(pid, "ERROR REVERT:");
    coloredLog(pid, "" + error.message);
    return checkPredictionContract(pid);
  }
};

const successExecuteRound = async (pid) => {
  await sleep(predictions[pid].interval * 1000);
  startExecuteRound(pid);
};

const tryRpc = async (rpcToUse) => {
  return new Promise(async (resolve, reject) => {
    let web3;

    console.log("trying RPC", rpcToUse);
    web3 = new Web3(rpcToUse);

    web3.eth.net
      .isListening()
      .then(() => {
        resolve(true);
      })
      .catch(() => {
        reject(false);
      });

    setTimeout(resolve, 2000, false);
  });
};

const chooseRpc = async (network) => {
  if (!rpcCache[network]) {
    rpcCache[network] = { currentRpc: null, updatingRpc: false };
  }
  const networkSettings = config.networkSettings[network];

  rpcCache[network].updatingRpc = true;
  let rpcNum = 0;
  await tryRpc(networkSettings.rpcOptions[0]).then(async (result) => {
    if (result) rpcNum = 0;
    else {
      await tryRpc(networkSettings.rpcOptions[1]).then(async (result) => {
        if (result) rpcNum = 1;
        else {
          await tryRpc(networkSettings.rpcOptions[2]).then(async (result) => {
            if (result) rpcNum = 2;
          });
        }
      });
    }
  });

  const rpcToUse = networkSettings.rpcOptions[rpcNum];
  console.log("selected rpc", networkSettings.rpcOptions[rpcNum]);
  rpcCache[network].currentRpc = rpcToUse;
  rpcCache[network].updatingRpc = false;
};

const getPredictionContract = (pid) => {
  if (contracts[pid]) return contracts[pid];
  const predictionData = predictions[pid];
  const provider = new Provider(
    privateKey,
    rpcCache[predictionData.network].currentRpc
  );
  const web3 = new Web3(provider);
  const predictionContract = new web3.eth.Contract(abi, predictionData.address);
  contracts[pid] = predictionContract;
  return predictionContract;
};

const checkPredictionContract = async (pid) => {
  const network = predictions[pid].network;
  if (!rpcCache[network] || !rpcCache[network].updatingRpc)
    await chooseRpc(network);

  const predictionContract = getPredictionContract(pid);

  coloredLog(pid, "Prediction check started...");

  const currentRoundNo = await predictionContract.methods.currentEpoch().call();
  const roundTimestamps = await predictionContract.methods
    .timestamps(currentRoundNo)
    .call();

  const blockNumber = await getWeb3(pid).eth.getBlockNumber();
  const block = await getWeb3(pid).eth.getBlock(blockNumber);
  let timestamp;

  if (block) timestamp = block.timestamp * 1000;
  else timestamp = Date.now();

  const msecondsLeft = 1000 * roundTimestamps.lockTimestamp - timestamp;
  coloredLog(
    pid,
    "contract is already active so running after ms: " + msecondsLeft
  );

  if (msecondsLeft > 0) await sleep(msecondsLeft + 100);

  return startExecuteRound(pid);
};

module.exports = {
  chooseRpc,
  getGasPrice,
  sleep,
  startExecuteRound,
  successExecuteRound,
  checkPredictionContract,
  getPredictionContract,
};
