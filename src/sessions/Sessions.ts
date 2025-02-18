import crypto from "node:crypto";
import { deleteProps, random, removeAll } from "@nesvet/n";
import type { AbilitiesSchema } from "insite-common";
import { CollectionIndexes, WatchedCollection } from "insite-db";
import { User } from "../users/User";
import type { Users } from "../users";
import { basisSchema } from "./schema";
import { Session } from "./Session";
import { SessionDoc, SessionsOptions } from "./types";


const expireAfterSeconds = 3600 * 24 * 7;

const indexes: CollectionIndexes = [
	[ { user: 1 } ],
	[ { expiresAt: 1 }, { expireAfterSeconds } ]
];


export class Sessions<AS extends AbilitiesSchema> extends Map<string, Session<AS>> {
	constructor(users: Users<AS>, options: SessionsOptions = {}) {
		super();
		
		this.users = users;
		this.collections = users.collections;
		
		this.initOptions = options;
	}
	
	users;
	collections;
	
	private initOptions?;
	
	collection!: WatchedCollection<SessionDoc> & {
		expireAfterSeconds: number;
	};
	
	isInited = false;
	
	async init() {
		
		if (!this.isInited) {
			this.isInited = true;
			
			const {
				schema: customSchema,
				indexes: customIndexes
			} = this.initOptions!;
			
			if (customSchema) {
				if (customSchema.required)
					removeAll(customSchema.required as string[], basisSchema.required as string[]);
				if (customSchema.properties)
					deleteProps(customSchema, Object.keys(basisSchema.properties!));
			}
			
			const jsonSchema = {
				...basisSchema,
				...customSchema,
				required: [ ...basisSchema.required as string[], ...customSchema?.required as string[] ?? [] ],
				properties: { ...basisSchema.properties, ...customSchema?.properties }
			};
			
			this.collection = Object.assign(
				await this.collections.ensure<SessionDoc>("sessions", { jsonSchema }),
				{
					expireAfterSeconds
				}
			);
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			await this.#maintain();
			
			for (const sessionDoc of await this.collection.find().toArray())
				this.load(sessionDoc);
			
			this.collection.changeListeners.add(next => {
				switch (next.operationType) {
					case "insert":
						if (!this.has(next.documentKey._id))
							new Session<AS>(this, next.fullDocument);
						
						this.users.get(next.fullDocument.user)?.trimSessions();
						
						break;
					
					case "replace":
						this.get(next.documentKey._id)?.update(next.fullDocument);
						break;
					
					case "update":
						this.get(next.documentKey._id)?.update(next.updateDescription.updatedFields!);
						break;
					
					case "delete":
						this.get(next.documentKey._id)?.delete();
				}
				
			});
			
			delete this.initOptions;
		}
		
	}
	
	async #maintain() {
		
		await this.collection.bulkWrite([
			{ updateMany: { filter: { meta: { $exists: false } }, update: { $set: { meta: {} } } } },
			{ updateMany: { filter: { isOnline: true }, update: { $set: { isOnline: false } } } }
		]);
		
	}
	
	uid() {
		
		let _id;
		do
			_id = `${crypto.randomBytes(random(8, 16)).toString("hex")}$${crypto.randomBytes(random(8, 16)).toString("hex")}`;
		while (this.has(_id));
		
		return _id;
	}
	
	load(sessionDoc: SessionDoc) {
		new Session<AS>(this, sessionDoc);
		
	}
	
	async create(user: User<AS>, props: Partial<SessionDoc>) {
		
		const ts = Date.now();
		
		const sessionDoc: SessionDoc = {
			userAgent: "",
			remoteAddress: "127.0.0.1",
			isOnline: true,
			...props,
			_id: this.uid(),
			user: user._id,
			meta: {},
			createdAt: ts,
			prolongedAt: ts,
			expiresAt: new Date(ts + (expireAfterSeconds * 1000))
		};
		
		/* new Session(…) before await insertOne(…) for avoid changeStream insert event to come earlier and create the session duplicate */
		const session = new Session<AS>(this, sessionDoc);
		
		await this.collection.insertOne(sessionDoc);
		
		return session;
	}
	
	async destroySession(_id: string) {
		const { deletedCount } = await this.collection.deleteOne({ _id });
		
		return Boolean(deletedCount);
	}
	
}
