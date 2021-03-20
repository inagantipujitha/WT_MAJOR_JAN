// @ts-nocheck
var KiteConnect = require("kiteconnect").KiteConnect;
var KiteTicker = require("kiteconnect").KiteTicker;

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const port = 4001;

const app = express();
module.exports.login = async (req, res) => {
	var requestToken = req.params.requestToken;
	console.log("Request Token:", requestToken);
	const apiKey = "6zfi2amoxjco04yo",
		apiSecret = "p2zkzvivv3y8fveacsb9ciqnu5y71iul";

	var options = {
		api_key: apiKey,
		// debug: false,
	};

	var kc = new KiteConnect(options);
	kc.generateSession(requestToken, apiSecret)
		.then(function (response) {
			console.log(response);
			accessToken = response?.access_token;
			return res.send({ accessToken: accessToken });
		})
		.catch(function (err) {
			console.log("error : ", err);
			return err.message;
		});
};

module.exports.getData = (req, res) => {
	console.log("getData");
	var data;
	var items = [
		738561,
		2953217,
		408065,
		895745,
		341249,
		779521,
		5582849,
		3851265,
		3529217,
		215553,
		2813441,
		590337,
		7401729,
		3917569,
		2022913,
	];
	const companyData = {
		738561: { name: "Reliance" },
		2953217: { name: "TCS" },
		408065: { name: "Infosys" },
		895745: { name: "TataSteel" },
		341249: { name: "HDFC Bank" },
		779521: { name: "SBIN" },
		5582849: { name: "SBI LIFE" },
		3851265: { name: "Delta Corpo" },
		3529217: { name: "Tornt Power" },
		215553: { name: "DHFL" },
		2813441: { name: "Radico" },
		590337: { name: "Bestagro" },
		7401729: { name: "RosselInd" },
		3917569: { name: "Bang" },
		2022913: { name: "LIFC" },
	};

	var access_token = req.params.accessToken;

	let interval;

	const server = http.createServer(app);
	const io = socketIo(server, {
		cors: {
			origin: "http://localhost:3000",
			methods: ["GET", "POST"],
		},
	});
	const server1Sockets = new Set();

	var ticker = new KiteTicker({
		api_key: process.env.API_KEY,
		access_token: access_token,
	});

	io.on("connection", (socket) => {
		ticker.connect();
		console.log("New client connected");
		// res.send({ message: "connected to the server" });
		if (interval) {
			clearInterval(interval);
		}
		server1Sockets.add(socket);
		interval = setInterval(() => getApiAndEmit(socket, data), 2000);
		socket.on("disconnect", () => {
			server1Sockets.delete(socket);
			ticker.disconnect();
			clearInterval(interval);
			console.log("Client disconnected");
		});
	});

	const getApiAndEmit = (socket, data) => {
		console.log("emiting data");
		socket.emit("FromAPI", data);
	};

	//getting realtime data
	function onTicks(ticks) {
		for (let i = 0; i < ticks.length; i++) {
			var instrumentToken = ticks[i].instrument_token;

			var high = ticks[i].ohlc.high;
			var low = ticks[i].ohlc.low;
			var ltp = ticks[i].last_price;

			companyData[instrumentToken].high = high;
			companyData[instrumentToken].low = low;
			companyData[instrumentToken].lastTradePrice = ltp;

			if (ltp > high) {
				// console.log("buy");

				companyData[instrumentToken].status = "buy";
				companyData[instrumentToken].stoploss = low;
			} else if (ltp < low) {
				// console.log("sell");
				companyData[instrumentToken].status = "sell";
				companyData[instrumentToken].stoploss = high;
			} else {
				// console.log("stable");
				companyData[instrumentToken].status = "Hold";
				companyData[instrumentToken].stoploss = 0;
			}
			// console.log("companyData  :", companyData);
		}

		data = [];

		for (var i = 0; i < items.length; i++) {
			data.push(companyData[items[i]]);
		}
	}
	function subscribe() {
		ticker.subscribe(items);
		ticker.setMode(ticker.modeFull, items);
	}

	function disconnect() {
		ticker.disconnect();
		console.log("disconnected");
	}

	//starting connection between server and client
	function destroySockets(sockets) {
		for (const socket of sockets.values()) {
			socket.destroy();
		}
	}

	server.listen(port, () => {
		console.log("closing port");
		destroySockets(server1Sockets);
		console.log(`Listening on port ${port}`);
	});

	//ticker functions
	ticker.autoReconnect(true, 10, 5);
	ticker.on("ticks", onTicks);
	ticker.on("connect", subscribe);
	ticker.on("disconnect", disconnect);
	ticker.on("reconnecting", function (reconnect_interval, reconnections) {
		console.log(
			"Reconnecting: attempet - ",
			reconnections,
			" innterval - ",
			reconnect_interval
		);
	});
};
