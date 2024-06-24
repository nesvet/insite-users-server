import * as argon2 from "argon2";
import EventEmitter from "eventemitter3";
import { debounce } from "@nesvet/n";
import { ObjectId } from "insite-db";
import { Abilities } from "../abilities";
import { Orgs } from "../orgs";
import { Roles } from "../roles";
import { Sessions } from "../sessions";
import { Avatars } from "./avatars";
import { basisSchema } from "./schema";
import { User } from "./User";


const indexes = [
	[ { email: 1 }, { unique: true } ],
	[ { org: 1 } ]
];

function sortUsersAndOrgs(a, b) {
	return (
		(a.isUser && b.isUser) ?
			(a.name.last && b.name.last) ?
				a.name.last > b.name.last ?
					1 :
					a.name.last < b.name.last ? -1 : 0 :
				(!a.name.last && !b.name.last) ?
					a.displayLabel > b.displayLabel ?
						1 :
						a.displayLabel < b.displayLabel ? -1 : 0 :
					a.name.last ? -1 : 1 :
			(a.isOrg && b.isOrg) ?
				a.title > b.title ?
					1 :
					a.title < b.title ? -1 : 0 :
				a.isOrg ? -1 : 1
	);
}


export class Users extends Map {
	constructor({
		collections,
		indexes: customIndexes,
		schema: customSchema,
		initialRoot: initialRootProps,
		abilities: abilitiesOptions,
		roles: rolesOptions,
		orgs: orgsOptions,
		sessions: sessionsOptions,
		avatars: avatarsOptions
	}) {
		super();
		
		const eventEmitter = new EventEmitter();
		for (const key in eventEmitter)// eslint-disable-line guard-for-in
			this[key] = eventEmitter[key];
		
		this.collections = collections;
		
		this.abilities = new Abilities(abilitiesOptions);
		
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
			
			this.collection = await this.collections.ensure("users", { jsonSchema });
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			if (!await this.collection.countDocuments({ roles: "root" }))
				await this.new({
					email: process.env.INSITE_ROOT_EMAIL ?? "insite@root.email",
					password: process.env.INSITE_ROOT_PASSWORD ?? "inSiteRootPassword",
					roles: [ "root" ],
					name: { first: "Root" },
					org: null,
					job: "Root",
					...Object.delete(initialRootProps, "roles", "org")
				});
			
			this.roles = await new Roles(this, rolesOptions);
			this.orgs = await new Orgs(this, orgsOptions);
			this.sessions = await new Sessions(this, sessionsOptions);
			this.avatars = await new Avatars(this, avatarsOptions);
			
			await this.roles.init();
			
			await this.orgs.initialLoad();
			await this.initialLoad();
			
			await this.orgs.init();
			await this.init();
			
			await this.sessions.init();
			
			return this;
		})();
	}
	
	isInited = false;
	
	byEmail = new Map();
	bySessionId = new Map();
	sorted = [];
	
	isSortRequired = false;
	
	load(userDoc) {
		new User(this, userDoc);
		
	}
	
	sort() {
		
		this.isSortRequired = false;
		
		this.sorted = [ ...this.values() ].sort((a, b) => a.name.last > b.name.last ? 1 : a.name.last < b.name.last ? -1 : 0);
		
	}
	
	sortDebounced = debounce(this.sort, 250);
	
	update(shouldUpdateRoles) {
		if (shouldUpdateRoles)
			for (const user of this.values())
				user.updateRoles();
		
		for (const user of this.values())
			user.updatePermissions();
		
		if (this.isSortRequired)
			this.sort();
		
	}
	
	updateDebounced = debounce(this.update, 250);
	
	initialLoad = async () => {
		
		for (const userDoc of await this.collection.find().toArray())
			this.load(userDoc);
		
		delete this.initialLoad;
		
	};
	
	init = () => {
		
		this.isInited = true;
		
		this.update(true);
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert":
					new User(this, next.fullDocument);
					break;
				
				case "replace":
					this.get(next.documentKey._id).update(next.fullDocument);
					break;
				
				case "update":
					this.get(next.documentKey._id).update(next.updateDescription.updatedFields);
					break;
				
				case "delete":
					this.get(next.documentKey._id).delete();
			}
			
		});
		
		delete this.init;
		
	};
	
	async new({ email, password, roles, name, org, job, ...restProps }) {
		if (this.byEmail.has(email))
			throw new Error("User exists");
		
		await this.collection.insertOne({
			_id: (new ObjectId()).toString(),
			email,
			password: await argon2.hash(password),
			roles: this.isInited ? this.roles.cleanUpIds(roles) : roles,
			name: {
				first: name.first ?? "",
				middle: name.middle ?? "",
				last: name.last ?? ""
			},
			org: org ?? null,
			job: job ?? "",
			...Object.delete(restProps, "_id"),
			createdAt: Date.now()
		});
		
		return true;
	}
	
	async changePassword(_id, newPassword) {
		if (!this.has(_id))
			throw new Error("usernotfound");
		
		if (!newPassword)
			throw new Error("emptypasswordisnotallowed");
		
		await Promise.all([
			this.collection.updateOne({ _id }, { $set: { password: await argon2.hash(newPassword) } }),
			this.sessions.collection.deleteMany({ user: _id })
		]);
		
	}
	
	async login(email, password, sessionProps) {
		const user = this.byEmail.get(email);
		
		if (!user)
			throw new Error("usernotfound");
		
		if (!await argon2.verify(user.password, password))
			throw new Error("incorrectpassword");
		
		if (!user.abilities.login)
			throw new Error("userisnotabletologin");
		
		return this.sessions.new(user, sessionProps);
	}
	
	logout(session) {
		session.delete();
		
		return this.sessions.collection.deleteOne({ _id: session._id });
	}
	
	sortIds(ids) {
		return ids
			.map(_id => this.get(_id) || this.orgs.get(_id))
			.filter(Boolean)
			.sort(sortUsersAndOrgs)
			.ids();
	}
	
	replaceMap = new Map();
	
	replaceHandlers = new Set();
	
	async replace(fromId) {
		const toId = this.replaceMap.get(fromId) ?? null;
		if (toId)
			this.replaceMap.delete(fromId);
		
		for (const handler of this.replaceHandlers)
			await handler(fromId, toId);
		
	}
	
}
