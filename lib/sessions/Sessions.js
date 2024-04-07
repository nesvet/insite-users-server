import crypto from "node:crypto";
import { random } from "@nesvet/n";
import { basisSchema } from "./schema";
import { Session } from "./Session";


const expireAfterSeconds = 3600 * 24 * 7;

const indexes = [
	[ { user: 1 } ],
	[ { expiresAt: 1 }, { expireAfterSeconds } ]
];


export class Sessions extends Map {
	constructor(users, options = {}) {
		super();
		
		const {
			schema: customSchema,
			indexes: customIndexes
		} = options;
		
		this.users = users;
		this.collections = users.collections;
		
		if (customSchema) {
			customSchema.required?.removeAll(basisSchema.required);
			if (customSchema.properties)
				Object.delete(customSchema, ...Object.keys(basisSchema.properties));
		}
		
		const jsonSchema = {
			...basisSchema,
			...customSchema,
			required: [ ...basisSchema.required, ...customSchema?.required ?? [] ],
			properties: { ...basisSchema.properties, ...customSchema?.properties }
		};
		
		return (async () => {
			
			this.collection = await this.collections.ensure("sessions", { jsonSchema });
			
			this.collection.expireAfterSeconds = expireAfterSeconds;
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			await this.collection.updateMany({ isOnline: true }, { $set: { isOnline: false } });
			
			return this;
		})();
	}
	
	isInited = false;
	
	makeId() {
		return `${crypto.randomBytes(random(8, 16)).toString("hex")}$${crypto.randomBytes(random(8, 16)).toString("hex")}`;
	}
	
	load(sessionDoc) {
		new Session(this, sessionDoc);
		
	}
	
	init = async () => {
		
		for (const sessionDoc of await this.collection.find().toArray())
			this.load(sessionDoc);
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert":
					if (!this.has(next.documentKey._id))
						new Session(this, next.fullDocument);
					
					this.users.get(next.fullDocument.user)?.trimSessions();
					
					break;
				
				case "update":
				case "replace":
					this.get(next.documentKey._id)?.update(next.updateDescription?.updatedFields || next.fullDocument);
					break;
				
				case "delete":
					this.get(next.documentKey._id)?.delete();
			}
			
		});
		
		this.isInited = true;
		
		delete this.init;
		
	};
	
	async new(user, props) {
		
		const ts = Date.now();
		
		const sessionDoc = {
			...props,
			_id: this.uid(),
			user: user._id,
			createdAt: ts,
			prolongedAt: ts,
			expiresAt: new Date(ts + (expireAfterSeconds * 1000))
		};
		
		/* new Session(…) before await insertOne(…) for avoid changeStream insert event to come earlier and create the session duplicate */
		const session = new Session(this, sessionDoc);
		
		await this.collection.insertOne(sessionDoc);
		
		return session;
	}
	
}
