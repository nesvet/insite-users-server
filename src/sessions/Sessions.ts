import crypto from "node:crypto";
import { deleteProps, random, removeAll } from "@nesvet/n";
import type { AbilitiesSchema } from "insite-common";
import { InSiteCollectionIndexes, InSiteWatchedCollection } from "insite-db";
import { User } from "../users/User";
import type { Users } from "../users";
import { basisSchema } from "./schema";
import { Session } from "./Session";
import { SessionDoc, SessionsOptions } from "./types";


const expireAfterSeconds = 3600 * 24 * 7;

const indexes: InSiteCollectionIndexes = [
	[ { user: 1 } ],
	[ { expiresAt: 1 }, { expireAfterSeconds } ]
];


export class Sessions<AS extends AbilitiesSchema = AbilitiesSchema> extends Map<string, Session<AS>> {
	constructor(users: Users<AS>, options: SessionsOptions = {}) {
		super();
		
		this.users = users;
		this.collections = users.collections;
		
		this.initOptions = options;
	}
	
	users;
	collections;
	
	initOptions?;
	
	collection!: {
		expireAfterSeconds: number;
	} & InSiteWatchedCollection<SessionDoc>;
	
	isInited = false;
	
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
	
	init? = async () => {
		
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
		
		await this.collection.updateMany({ isOnline: true }, { $set: { isOnline: false } });
		
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
		
		this.isInited = true;
		
		delete this.initOptions;
		delete this.init;
		
	};
	
	async new(user: User<AS>, props: Partial<SessionDoc>) {
		
		const ts = Date.now();
		
		const sessionDoc: SessionDoc = {
			userAgent: "",
			remoteAddress: "127.0.0.1",
			isOnline: true,
			...props,
			_id: this.uid(),
			user: user._id,
			createdAt: ts,
			prolongedAt: ts,
			expiresAt: new Date(ts + (expireAfterSeconds * 1000))
		};
		
		/* new Session(…) before await insertOne(…) for avoid changeStream insert event to come earlier and create the session duplicate */
		const session = new Session<AS>(this, sessionDoc);
		
		await this.collection.insertOne(sessionDoc);
		
		return session;
	}
	
}
