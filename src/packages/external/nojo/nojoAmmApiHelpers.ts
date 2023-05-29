import { ObjectId } from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NojoAddresses } from "../../../types";
import { Pool, PoolFields, PoolRegistry } from "../../../external/nojo";
import { EventOnChain } from "../../../general/types/castingTypes";
import { NojoPoolObject } from "./nojoAmmTypes";

export class NojoAmmApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: NojoAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.router?.nojo;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPoolObjectIds = async (): Promise<ObjectId[]> => {
		const objectIds = await this.Provider.Events().fetchAllEvents(
			(cursor, limit) =>
				this.Provider.Events().fetchCastEventsWithCursor<
					EventOnChain<{
						pool_id: ObjectId;
					}>,
					ObjectId
				>(
					{
						MoveEventType: EventsApiHelpers.createEventType(
							this.addresses.packages.pool,
							"pool",
							"PoolCreationEvent"
						),
					},
					(eventOnChain) => eventOnChain.parsedJson.pool_id,
					cursor,
					limit
				)
		);

		return objectIds;
	};

	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	public static nojoPoolObjectFromClass = (pool: Pool): NojoPoolObject => {
		const {
			id,
			balanceA,
			balanceB,
			lpSupply,
			lpFeeBps,
			adminFeePct,
			adminFeeBalance,
		} = pool;

		const fields: PoolFields = {
			id,
			balanceA,
			balanceB,
			lpSupply,
			lpFeeBps,
			adminFeePct,
			adminFeeBalance,
		};

		return {
			fields,
			typeArgs: pool.$typeArgs,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	private fetchPoolRegistry = () => {
		return PoolRegistry.fetch(
			this.Provider.provider,
			this.addresses.packages.pool
		);
	};
}
