import {
	ApiStakeSuiFrenBody,
	SuiNetwork,
	SuiFrenObject,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly suiFren: SuiFrenObject,
		public readonly network?: SuiNetwork | Url,
		public readonly isStaked: boolean = false
	) {
		super(network, "sui-frens");
		this.suiFren = suiFren;
		this.isStaked = isStaked;
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction() {
		if (this.isStaked)
			throw new Error("unable to stake already staked suiFren");

		return this.fetchApiTransaction<ApiStakeSuiFrenBody>(
			"transactions/stake",
			{
				suiFrenId: this.suiFren.objectId,
			}
		);
	}
}
