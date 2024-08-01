import { InSiteWatchedCollection } from "insite-db";
import type { AbilitiesSchema } from "../../abilities/types";
import type { Users } from "../Users";
import { schema as jsonSchema } from "./schema";
import type { AvatarDoc } from "./types";
// import { AvatarsOptions } from "./types";


export class Avatars<AS extends AbilitiesSchema = AbilitiesSchema> {
	constructor(users: Users<AS>/* , options: AvatarsOptions = {} */) {
		this.users = users;
		this.collections = users.collections;
		
	}
	
	users;
	collections;
	
	collection!: InSiteWatchedCollection<AvatarDoc>;
	
	init? = async () => {
		
		this.collection = await this.collections.ensure<AvatarDoc>("users.avatars", { jsonSchema });
		
		delete this.init;
		
	};
	
}
