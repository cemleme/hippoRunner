//log colors:
//black,red,green,yellow,blue,magenta,cyan,white,gray,grey,brightRed,brightGreen,brightYellow,brightBlue,brightMagenta,brightCyan,brightWhite

const config = {
    restart: true,
    restartTimer: 600000,
    predictions: [
        {title:'MATIC', keepPaused:false, color:'blue', network:'POLYGONTEST', interval: 300, address:'0xBD2e11702ABd48d9936A157c919B76e53a55F6A6'},
    ],
    networkSettings: {
        POLYGON: {
            gasLevel:'ProposeGasPrice',
            gasOffset:1,
            rpcOptions: ["https://polygon-rpc.com/", "https://speedy-nodes-nyc.moralis.io/38d762dc7ea8dc00bd74ca7a/polygon/mainnet", "https://matic-mainnet.chainstacklabs.com"],
            checkGas: true,
            gasApi: "https://gpoly.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle",
            gasPrice: '45000000000'
        },
        POLYGONTEST: {
            gasLevel:'ProposeGasPrice',
            gasOffset:10,
            rpcOptions: ["https://matic-mumbai.chainstacklabs.com"],
            checkGas: false,
            gasApi: "https://gpoly.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle",
            gasPrice: '10000000000'
        },
    }
}

module.exports = config