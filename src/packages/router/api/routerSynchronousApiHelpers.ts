import {
	TransactionObjectArgument,
	Transaction,
} from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterCompleteTradeRoute,
	RouterSynchronousProtocolName,
	RouterSynchronousSerializablePool,
	RouterTradeEvent,
	RouterTradePath,
	SynchronousProtocolsToPoolObjectIds,
} from "../routerTypes";
import {
	AnyObjectType,
	Balance,
	CoinType,
	EventsInputs,
	PoolsAddresses,
	ReferralVaultAddresses,
	RequiredRouterAddresses,
	Slippage,
	ObjectId,
	SuiAddress,
	ExternalFee,
} from "../../../types";
import { createRouterPool } from "../utils/synchronous/interfaces/routerPoolInterface";
import { Router } from "../router";
import { RouterSynchronousApiInterface } from "../utils/synchronous/interfaces/routerSynchronousApiInterface";
import { PoolsApi } from "../../pools/api/poolsApi";
import { Casting, Helpers } from "../../../general/utils";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { RouterApiCasting } from "./routerApiCasting";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes";
import { InterestApi } from "../../external/interest/interestApi";
import { KriyaApi } from "../../external/kriya/kriyaApi";
import { BaySwapApi } from "../../external/baySwap/baySwapApi";
import { SuiswapApi } from "../../external/suiswap/suiswapApi";
import { BlueMoveApi } from "../../external/blueMove/blueMoveApi";
import { StakingApi } from "../../staking/api/stakingApi";
import { bcs } from "@mysten/sui/bcs";

export class RouterSynchronousApiHelpers {
	// =========================================================================
	//  Constants
	// =========================================================================

	private readonly protocolNamesToApi: Record<
		RouterSynchronousProtocolName,
		() => RouterSynchronousApiInterface<any>
	> = {
		Aftermath: () => new PoolsApi(this.Provider),
		Interest: () => new InterestApi(this.Provider),
		Kriya: () => new KriyaApi(this.Provider),
		BaySwap: () => new BaySwapApi(this.Provider),
		Suiswap: () => new SuiswapApi(this.Provider),
		BlueMove: () => new BlueMoveApi(this.Provider),
		afSUI: () => new StakingApi(this.Provider),
	};

	public static readonly constants = {
		moduleNames: {
			swapCap: "swap_cap",
		},
		eventNames: {
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		router: RequiredRouterAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};
	public readonly eventTypes: {
		routerTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const router = this.Provider.addresses.router;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!router || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			router,
			pools,
			referralVault,
		};
		this.eventTypes = {
			routerTrade: this.routerTradeEventType(),
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (inputs: {
		protocols: RouterSynchronousProtocolName[];
	}): Promise<RouterSynchronousSerializablePool[]> => {
		const apis = this.protocolApisFromNames(inputs);
		const expandedPools = await Promise.all(
			apis.map((api) => api.fetchAllPools(true))
		);
		return expandedPools.reduce((acc, pools) => [...acc, ...pools], []);
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public obtainRouterCapTx = (inputs: {
		tx: Transaction;
		coinInId: ObjectId | TransactionObjectArgument;
		minAmountOut: Balance;
		coinInType: CoinType;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: ExternalFee;
	}) /* (RouterSwapCap) */ => {
		const {
			tx,
			coinInId,
			minAmountOut,
			coinInType,
			coinOutType,
			referrer,
			externalFee,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"obtain_router_cap"
			),
			typeArguments: [coinInType, coinOutType],
			arguments: [
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_in
				tx.pure.u64(minAmountOut), // min_amount_out
				tx.pure(bcs.option(bcs.Address).serialize(referrer)), // referrer
				tx.pure(
					bcs.option(bcs.Address).serialize(externalFee?.recipient)
				), // router_fee_recipient
				tx.pure(
					bcs
						.option(bcs.U64)
						.serialize(
							externalFee
								? Casting.numberToFixedBigInt(
										externalFee.feePercentage
								  )
								: undefined
						)
				), // router_fee
			],
		});
	};

	public initiatePathTx = (inputs: {
		tx: Transaction;
		routerSwapCap: TransactionObjectArgument;
		coinInAmount: Balance;
		coinInType: CoinType;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"initiate_path"
			),
			typeArguments: [inputs.coinInType],
			arguments: [
				inputs.routerSwapCap, // RouterSwapCap
				tx.pure.u64(inputs.coinInAmount),
			],
		});
	};

	public returnRouterCapTx = (inputs: {
		tx: Transaction;
		routerSwapCap: TransactionObjectArgument;
		coinOutId: ObjectId | TransactionObjectArgument;
		routerSwapCapCoinType: CoinType;
		coinOutType: CoinType;
	}) => {
		const {
			tx,
			routerSwapCap,
			coinOutId,
			routerSwapCapCoinType,
			coinOutType,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"return_router_cap"
			),
			typeArguments: [routerSwapCapCoinType, coinOutType],
			arguments: [
				routerSwapCap, // RouterSwapCap
				typeof coinOutId === "string"
					? tx.object(coinOutId)
					: coinOutId, // coin_out

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
			],
		});
	};

	public returnRouterCapAlreadyPayedFeeTx = (inputs: {
		tx: Transaction;
		routerSwapCap: TransactionObjectArgument;
		routerSwapCapCoinType: CoinType;
	}) => {
		const { tx, routerSwapCap, routerSwapCapCoinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"return_router_cap_already_payed_fee"
			),
			typeArguments: [routerSwapCapCoinType],
			arguments: [
				routerSwapCap, // RouterSwapCap
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public async fetchBuildTransactionForCompleteTradeRoute(inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
		coinInId?: TransactionObjectArgument;
		isSponsoredTx?: boolean;
		withTransfer?: boolean;
	}): Promise<TransactionObjectArgument | undefined> {
		const {
			walletAddress,
			completeRoute,
			slippage,
			isSponsoredTx,
			tx,
			withTransfer,
		} = inputs;

		const referrer = completeRoute.referrer;
		const externalFee = completeRoute.externalFee;
		if (
			externalFee &&
			externalFee.feePercentage >=
				Router.constants.maxExternalFeePercentage
		)
			throw new Error(
				`external fee percentage exceeds max of ${Router.constants.maxExternalFeePercentage}`
			);

		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		let startCoinInId: TransactionObjectArgument;
		if (inputs.coinInId) {
			startCoinInId = inputs.coinInId;
		} else {
			startCoinInId = await this.Provider.Coin().fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: completeRoute.coinIn.type,
				coinAmount: completeRoute.coinIn.amount,
				isSponsoredTx,
			});
		}

		const minAmountOut =
			RouterSynchronousApiHelpers.calcCompleteRouteMinAmountOut({
				completeRoute,
				slippage,
			});

		const routerSwapCapCoinType = completeRoute.coinIn.type;
		const routerSwapCap = this.obtainRouterCapTx({
			tx,
			coinInId: startCoinInId,
			coinInType: completeRoute.coinIn.type,
			coinOutType: completeRoute.coinOut.type,
			referrer,
			externalFee,
			minAmountOut,
		});

		let coinsOut: TransactionObjectArgument[] = [];

		let coinInAmountRemaining = completeRoute.coinIn.amount;
		for (const [routeIndex, route] of completeRoute.routes.entries()) {
			let coinInId: TransactionObjectArgument | undefined =
				this.initiatePathTx({
					tx,
					routerSwapCap,
					// this is for possible route amount rounding protection
					coinInAmount:
						routeIndex === completeRoute.routes.length - 1
							? coinInAmountRemaining
							: route.coinIn.amount,
					coinInType: route.coinIn.type,
				});

			coinInAmountRemaining -= route.coinIn.amount;

			for (const [, path] of route.paths.entries()) {
				const poolForPath = createRouterPool({
					pool: path.pool,
					network: "",
				});

				if (!coinInId)
					throw new Error(
						"no coin in argument given for router trade command"
					);

				const pathMinAmountOut = Helpers.applySlippageBigInt(
					path.coinOut.amount,
					slippage
				);
				const newCoinInId = poolForPath.tradeTx({
					provider: this.Provider,
					tx,
					coinInId,
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
					expectedCoinOutAmount: path.coinOut.amount,
					minAmountOut: pathMinAmountOut,
					routerSwapCapCoinType,
					routerSwapCap,
				});

				coinInId =
					poolForPath.noHopsAllowed &&
					poolForPath.protocolName === "Turbos"
						? undefined
						: newCoinInId;
			}

			if (coinInId) coinsOut.push(coinInId);
		}

		let coinOutId: undefined | TransactionObjectArgument = undefined;

		if (coinsOut.length > 0) {
			coinOutId = coinsOut[0];

			// merge all coinsOut into a single coin
			if (coinsOut.length > 1)
				tx.mergeCoins(coinOutId, coinsOut.slice(1));
		}

		if (coinOutId) {
			this.returnRouterCapTx({
				tx,
				routerSwapCap,
				routerSwapCapCoinType,
				coinOutType: completeRoute.coinOut.type,
				coinOutId,
			});

			if (withTransfer) {
				tx.transferObjects([coinOutId], tx.pure.address(walletAddress));
			}

			return coinOutId;
		} else {
			this.returnRouterCapAlreadyPayedFeeTx({
				tx,
				routerSwapCap,
				routerSwapCapCoinType,
			});

			return undefined;
		}
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchTradeEvents = async (
		inputs: {
			walletAddress: SuiAddress;
		} & EventsInputs
	) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			RouterTradeEventOnChain,
			RouterTradeEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.routerTrade,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: RouterApiCasting.routerTradeEventFromOnChain,
		});
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private protocolApisFromNames = (inputs: {
		protocols: RouterSynchronousProtocolName[];
	}): RouterSynchronousApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.router.packages.utils,
			RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
			RouterSynchronousApiHelpers.constants.eventNames.routerTrade
		);

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static calcCompleteRouteMinAmountOut = (inputs: {
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}) => {
		const { completeRoute, slippage } = inputs;

		const turbosCoinOutAmount = Helpers.sumBigInt(
			completeRoute.routes
				.reduce(
					(acc, route) => [...acc, ...route.paths],
					[] as RouterTradePath[]
				)
				.filter((path) => path.protocolName === "Turbos")
				.map((path) => path.coinOut.amount)
		);
		const coinOutAmountMinusTurbos =
			completeRoute.coinOut.amount - turbosCoinOutAmount;

		return (
			coinOutAmountMinusTurbos -
			BigInt(
				Math.floor(
					Casting.normalizeSlippageTolerance(slippage) *
						Number(coinOutAmountMinusTurbos)
				)
			)
		);
	};
}
