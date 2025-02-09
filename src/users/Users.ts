import * as argon2 from "argon2";
import EventEmitter from "eventemitter3";
import {
	_ids,
	debounce,
	deleteProps,
	removeAll,
	StatefulPromise,
	without
} from "@nesvet/n";
import type { AbilitiesSchema } from "insite-common";
import {
	CollectionIndexes,
	Collections,
	CollectionSchema,
	WatchedCollection,
	newObjectIdString
} from "insite-db";
import { AbilitiesMap } from "../abilities";
import { Orgs } from "../orgs";
import { Org } from "../orgs/Org";
import { Roles } from "../roles";
import { Sessions } from "../sessions";
import { Session } from "../sessions/Session";
import type { OrgsOptions } from "../orgs/types";
import type { RolesOptions } from "../roles/types";
import type { SessionDoc, SessionsOptions } from "../sessions/types";
import { Avatars/* , AvatarsOptions */ } from "./avatars";
import { basisSchema } from "./schema";
import { User } from "./User";
import type { UserDoc } from "./types";


const indexes: CollectionIndexes = [
	[ { email: 1 }, { unique: true } ],
	[ { org: 1 } ]
];


export type Options<AS> = {
	abilities: AS;
	indexes?: CollectionIndexes;
	schema?: CollectionSchema;
	initialRoot?: Partial<UserDoc>;
	roles?: RolesOptions;
	orgs?: OrgsOptions;
	sessions?: SessionsOptions;
	// avatars?: AvatarsOptions;
};


export class Users<AS extends AbilitiesSchema> extends Map<string, User<AS>> {
	constructor(collections: Collections, options: Options<AS>) {
		super();
		
		const eventEmitter = new EventEmitter() as EventEmitter & {
			_events: Record<string, object>;
			_eventsCount: number;
		};
		this._events = eventEmitter._events;
		this._eventsCount = eventEmitter._eventsCount;
		this.emit = eventEmitter.emit;
		this.on = eventEmitter.on;
		this.once = eventEmitter.once;
		this.addListener = eventEmitter.addListener;
		this.off = eventEmitter.off;
		this.removeListener = eventEmitter.removeListener;
		
		this.collections = collections;
		
		this.abilities = new AbilitiesMap<AS>(options.abilities);
		
		this.initOptions = options;
		
		this.init();
		
	}
	
	_events;
	_eventsCount;
	emit;
	on;
	once;
	addListener;
	off;
	removeListener;
	
	private initOptions?;
	
	collections;
	abilities;
	
	collection!: WatchedCollection<UserDoc>;
	roles!: Roles<AS>;
	sessions!: Sessions<AS>;
	orgs!: Orgs<AS>;
	avatars!: Avatars<AS>;
	
	byEmail = new Map();
	bySessionId = new Map();
	sorted: User<AS>[] = [];
	
	isSortRequired = false;
	
	#isPreinited = false;
	
	async preinit() {
		
		if (!this.#isPreinited) {
			this.#isPreinited = true;
			
			const {
				indexes: customIndexes,
				schema: customSchema,
				initialRoot: initialRootProps
				// avatars: avatarsOptions
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
				required: [ ...basisSchema.required as string [], ...customSchema?.required as string[] ?? [] ],
				properties: { ...basisSchema.properties, ...customSchema?.properties }
			};
			
			this.collection = await this.collections.ensure<UserDoc>("users", { jsonSchema });
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			if (!await this.collection.countDocuments({ roles: "root" }))
				await this.create({
					email: process.env.INSITE_ROOT_EMAIL ?? "insite@root.email",
					password: process.env.INSITE_ROOT_PASSWORD ?? "inSiteRootPassword",
					name: { first: "Root" },
					job: "Root",
					...initialRootProps,
					roles: [ "root" ],
					org: null
				});
			
			
			for (const userDoc of await this.collection.find().toArray())
				this.load(userDoc);
		}
		
	}
	
	isInited = false;
	
	protected async init() {
		
		if (!this.isInited) {
			this.isInited = true;
			
			const {
				roles: rolesOptions,
				orgs: orgsOptions,
				sessions: sessionsOptions
				// avatars: avatarsOptions
			} = this.initOptions!;
			
			this.roles = new Roles<AS>(this, rolesOptions);
			this.orgs = new Orgs<AS>(this, orgsOptions);
			this.sessions = new Sessions<AS>(this, sessionsOptions);
			this.avatars = new Avatars<AS>(this/* , avatarsOptions */);
			
			await this.roles.init();
			await this.orgs.preinit();
			await this.preinit();
			await this.orgs.init();
			await this.avatars.init();
			
			this.update(true);
			
			this.collection.changeListeners.add(next => {
				switch (next.operationType) {
					case "insert":
						new User<AS>(this, next.fullDocument);
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
			
			await this.sessions.init();
			
			delete this.initOptions;
			
			this.#initPromise.resolve(this);
		}
		
	}
	
	
	load(userDoc: UserDoc) {
		new User<AS>(this, userDoc);
		
	}
	
	sort() {
		
		this.isSortRequired = false;
		
		this.sorted = [ ...this.values() ].sort((a, b) => a.name.last > b.name.last ? 1 : a.name.last < b.name.last ? -1 : 0);
		
	}
	
	sortDebounced = debounce(() => this.sort(), 250);
	
	update(shouldUpdateRoles?: boolean) {
		if (shouldUpdateRoles)
			for (const user of this.values())
				user.updateRoles();
		
		for (const user of this.values())
			user.updatePermissions();
		
		if (this.isSortRequired)
			this.sort();
		
	}
	
	updateDebounced = debounce(() => this.update(), 250);
	
	#initPromise = new StatefulPromise<this>();
	
	whenReady() {
		return this.#initPromise;
	}
	
	async create({ email, password, roles, name, org, job, ...restProps }: Omit<UserDoc, "_id" | "createdAt">) {
		if (this.byEmail.has(email))
			throw new Error("User exists");
		
		await this.collection.insertOne({
			_id: newObjectIdString(),
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
			...deleteProps(restProps, [ "_id" ]),
			createdAt: Date.now()
		});
		
		return true;
	}
	
	async updateUser(_id: string, updates: Omit<UserDoc, "_id" | "createdAt">, byUser?: User<AS>) {
		const user = this.get(_id)!;
		
		if (!user)
			return false;
		
		if (updates.roles)
			updates.roles =
				user.isRoot ?
					[ "root" ] :
					this.roles.cleanUpIds(
						byUser ?
							without(user.ownRoleIds, byUser.slaveRoleIds).concat(updates.roles) :
							updates.roles
					);
		
		await this.collection.updateOne({ _id }, { $set: updates });
		
		return true;
	}
	
	async changePassword(_id: string, newPassword: string) {
		if (!this.has(_id))
			throw new Error("usernotfound");
		
		if (!newPassword)
			throw new Error("emptypasswordisnotallowed");
		
		await Promise.all([
			this.collection.updateOne({ _id }, { $set: { password: await argon2.hash(newPassword) } }),
			this.sessions.collection.deleteMany({ user: _id })
		]);
		
	}
	
	async login(email: string, password: string, sessionProps: Partial<SessionDoc>) {
		const user = this.byEmail.get(email);
		
		if (!user)
			throw new Error("usernotfound");
		
		if (!await argon2.verify(user.password, password))
			throw new Error("incorrectpassword");
		
		if (!user.abilities.login)
			throw new Error("userisnotabletologin");
		
		return this.sessions.create(user, sessionProps);
	}
	
	logout(session: Session<AS>) {
		session.delete();
		
		return this.sessions.collection.deleteOne({ _id: session._id });
	}
	
	#sortUsersAndOrgs(a: Org<AS> | User<AS>, b: Org<AS> | User<AS>) {
		return (
			(a instanceof User && b instanceof User) ?
				(a.name.last && b.name.last) ?
					a.name.last > b.name.last ?
						1 :
						a.name.last < b.name.last ? -1 : 0 :
					(!a.name.last && !b.name.last) ?
						a.displayLabel > b.displayLabel ?
							1 :
							a.displayLabel < b.displayLabel ? -1 : 0 :
						a.name.last ? -1 : 1 :
				(a instanceof Org && b instanceof Org) ?
					a.title > b.title ?
						1 :
						a.title < b.title ? -1 : 0 :
					a instanceof Org ? -1 : 1
		);
	}
	
	sortIds(ids: string[]) {
		return _ids((
			ids
				.map(_id => this.get(_id) || this.orgs.get(_id))
				.filter(Boolean) as (Org<AS> | User<AS>)[]
		).sort(this.#sortUsersAndOrgs));
	}
	
	replaceMap = new Map<string, string>();
	
	replaceHandlers = new Set<(fromId: string, toId: string | null) => Promise<void> | void>();
	
	async replace(fromId: string) {
		const toId = this.replaceMap.get(fromId) ?? null;
		if (toId)
			this.replaceMap.delete(fromId);
		
		for (const handler of this.replaceHandlers)
			await handler(fromId, toId);
		
	}
	
	async deleteUser(_id: string) {
		const { deletedCount } = await this.collection.deleteOne({ _id });
		
		return Boolean(deletedCount);
	}
	
	
	static init<IAS extends AbilitiesSchema>(collections: Collections, options: Options<IAS>) {
		const users = new Users(collections, options);
		
		return users.whenReady();
	}
	
}
