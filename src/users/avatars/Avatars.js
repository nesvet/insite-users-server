import { schema as jsonSchema } from "./schema";


export class Avatars {
	constructor(users/* , options = {} */) {
		this.users = users;
		this.collections = users.collections;
		
		return (async () => {
			
			this.collection = await this.collections.ensure("users.avatars", { jsonSchema });
			
			return this;
		})();
	}
}
