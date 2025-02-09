import type { AbilitiesSchema } from "insite-common";
import { Binary, type WatchedCollection } from "insite-db";
import type { Users } from "../Users";
import { schema as jsonSchema } from "./schema";
import type { AvatarDoc } from "./types";
// import { AvatarsOptions } from "./types";


export class Avatars<AS extends AbilitiesSchema> {
	constructor(users: Users<AS>/* , options: AvatarsOptions = {} */) {
		this.users = users;
		this.collections = users.collections;
		
	}
	
	readonly TYPES_ACCEPTED = [ "image/webp" ];
	readonly MAX_SIZE = 1024 * 512;
	
	users;
	collections;
	
	collection!: WatchedCollection<AvatarDoc>;
	
	#isInited = false;
	
	async init() {
		
		if (!this.#isInited) {
			this.#isInited = true;
			
			this.collection = await this.collections.ensure<AvatarDoc>("users.avatars", { jsonSchema });
		}
		
	}
	
	async save(_id: string, type: string, data: string) {
		const binaryData = Binary.createFromBase64(data.slice(data.indexOf(",")));
		
		const ts = Date.now().toString(36);
		
		await Promise.all([
			this.collection.replaceOne({ _id }, {
				type,
				size: binaryData.length(),
				ts,
				data: binaryData
			}, { upsert: true }),
			this.users.collection.updateOne({ _id }, { $set: { avatar: ts } })
		]);
		
	}
	
	async deleteAvatar(_id: string) {
		
		const [ { deletedCount } ] = await Promise.all([
			this.collection.deleteOne({ _id }),
			this.users.collection.updateOne({ _id }, { $set: { avatar: null } })
		]);
		
		return Boolean(deletedCount);
	}
	
}
