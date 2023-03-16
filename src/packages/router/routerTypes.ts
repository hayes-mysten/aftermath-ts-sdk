import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";
import { Pool } from "../pools";
import { PoolTradeFee } from "../pools/poolsTypes";

/////////////////////////////////////////////////////////////////////
//// Paths
/////////////////////////////////////////////////////////////////////

export interface RouterCompleteRoute {
	coinIn: CoinType;
	coinOut: CoinType;
	coinInAmount: Balance;
	coinOutAmount: Balance;
	spotPrice: number;
	tradeFee: PoolTradeFee;
	paths: RouterPaths;
}

export type RouterPaths = Record<ObjectId, RouterPath>;

export interface RouterPath {
	coinInAmount: Balance;
	coinOutAmount: Balance;
	spotPrice: number;
	tradeFee: PoolTradeFee;
}

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiRouterPathInfoBody {
	fromCoin: CoinType;
	toCoin: CoinType;
}

export interface ApiRouterFirstTradeTransactionsBody {
	walletAddress: SuiAddress;
	fromCoinAmount: Balance;
	path: RouterPath;
}

export interface ApiRouterIntermediateTradeTransactionsBody {
	path: RouterPath;
	fromCoinId: ObjectId;
}
