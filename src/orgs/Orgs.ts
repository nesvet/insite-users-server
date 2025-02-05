import {
	debounce,
	deleteProps,
	EmptyArray,
	EmptySet,
	removeAll,
	sort
} from "@nesvet/n";
import type { AbilitiesSchema } from "insite-common";
import { InSiteCollectionIndexes, InSiteWatchedCollection, newObjectIdString } from "insite-db";
import { Users } from "../users";
import { Org } from "./Org";
import { basisSchema } from "./schema";
import { OrgDoc, OrgsOptions } from "./types";


const indexes: InSiteCollectionIndexes = [
	[ { owners: 1 } ]
];

function preventDirectDelete() {
	throw new Error("Direct usage of orgs collection.deleteOne or .deleteMany is forbidden. Use orgs.collectionDelete instead.");
}


export class Orgs<AS extends AbilitiesSchema> extends Map<string, Org<AS>> {
	constructor(users: Users<AS>, options: OrgsOptions = {}) {
		super();
		
		this.users = users;
		this.collections = users.collections;
		
		this.preinitOptions = options;
		
	}
	
	users;
	collections;
	private preinitOptions?;
	
	collection!: {
		/** @deprecated Direct usage of roles collection.deleteOne is forbidden. Use orgs.collectionDelete instead. */
		deleteOne: typeof preventDirectDelete;
		
		/** @deprecated Direct usage of roles collection.deleteMany is forbidden. Use orgs.collectionDelete instead. */
		deleteMany: typeof preventDirectDelete;
	} & InSiteWatchedCollection<OrgDoc>;
	
	null!: { _id: null } & Org<AS>;
	
	load(orgDoc: OrgDoc) {
		new Org<AS>(this, orgDoc);
		
	}
	
	#resolve(org: Org<AS>, slaveOrgs: Org<AS>[]) {
		slaveOrgs = [ org, ...slaveOrgs ];
		
		for (const ownerOrg of org.ownerOrgs) {
			this.#resolve(ownerOrg, slaveOrgs);
			for (const slaveOrg of slaveOrgs)
				ownerOrg.slaveOrgs.add(slaveOrg);
		}
		
	}
	
	sorted: Org<AS>[] = [];
	
	update() {
		
		const array = [ ...this.values() ];
		const sorted = [];
		
		for (const org of array) {
			org.ownerOrgs.clear();
			org.ownerUsers.clear();
			org.slaveOrgs.clear();
			
			for (const ownerId of org.ownerIds) {
				const ownerOrg = this.get(ownerId);
				if (ownerOrg)
					org.ownerOrgs.add(ownerOrg);
				else {
					const ownerUser = this.users.get(ownerId);
					if (ownerUser)
						org.ownerUsers.add(ownerUser);
				}
			}
			
			if (!org.ownerOrgs.size && org._id)
				sorted.push(org);
		}
		
		for (const org of array)
			if (!array.some(anotherOrg => anotherOrg.ownerOrgs.has(org)))
				this.#resolve(org, []);
		
		sorted.sort(this.#sortOrgs);
		for (const org of array)
			sort(org.slaveOrgs, this.#sortOrgs);
		
		for (let i = 0; i < sorted.length; i++) {
			const org = sorted[i];
			for (const slaveOrg of [ ...org.slaveOrgs ].reverse())
				if (slaveOrg.ownerOrgs.has(org)) {
					const slaveOrgIndex = sorted.indexOf(slaveOrg);
					if (~slaveOrgIndex) {
						sorted.splice(slaveOrgIndex, 1);
						i--;
					}
					sorted.splice(i + 1, 0, slaveOrg);
				}
		}
		for (let { length } = sorted, o = 0; o < length;)
			sorted[o]._o = o++;
		
		this.sorted = sorted;
		
		this.users.emit("orgs-update");
		
		if (this.users.isInited) {
			this.users.updateDebounced.clear();
			this.users.update();
		}
		
	}
	
	#sortOrgs(a: Org<AS>, b: Org<AS>) {
		return (
			(b.slaveOrgs.size - a.slaveOrgs.size) || (
				a.title > b.title ?
					1 :
					a.title < b.title ?
						-1 :
						0
			)
		);
	}
	
	updateDebounced = debounce(this.update, 250);
	
	preinit? = async () => {
		
		const {
			schema: customSchema,
			indexes: customIndexes,
			null: nullProps
		} = this.preinitOptions!;
		
		if (customSchema) {
			if (customSchema.required)
				removeAll(customSchema.required as string [], basisSchema.required as string[]);
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
			await this.collections.ensure<OrgDoc>("orgs", { jsonSchema }),
			{
				deleteOne: preventDirectDelete,
				deleteMany: preventDirectDelete
			}
		);
		
		this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
		
		this.null = Object.assign(
			new Org<AS>(this, {
				...nullProps,
				_id: "",
				title: "",
				note: "",
				owners: [],
				createdAt: Date.now()
			}),
			{
				_id: null,
				ownerIds: new EmptyArray(),
				ownerOrgs: new EmptySet(),
				ownerUsers: new EmptySet(),
				slaveOrgs: new EmptySet()
			}
		);
		
		for (const orgDoc of await this.collection.find().toArray())
			this.load(orgDoc);
		
		delete this.preinitOptions;
		delete this.preinit;
		
	};
	
	init? = async () => {
		
		await this.update();
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert": {
					const org = new Org<AS>(this, next.fullDocument);
					this.users.emit("orgs-org-update", org, next);
					break;
				}
				
				case "replace":
					this.get(next.documentKey._id)?.update(next.fullDocument, next);
					break;
				
				case "update":
					this.get(next.documentKey._id)?.update(next.updateDescription.updatedFields!, next);
					break;
				
				case "delete":
					this.get(next.documentKey._id)?.delete();
					this.users.emit("orgs-org-update", null, next);
			}
			
		});
		
		delete this.init;
		
	};
	
	new({ title, note, ...restProps }: Omit<OrgDoc, "_id" | "createdAt" | "owners">, ownerId: string) {
		return this.collection.insertOne({
			_id: newObjectIdString(),
			title: title ?? "",
			note: note ?? "",
			owners: ownerId ? [ ownerId ] : [],
			...deleteProps(restProps, [ "_id", "owners" ]),
			createdAt: Date.now()
		});
	}
	
	collectionDelete(org: Org<AS> | string) {
		const _id = typeof org == "string" ? org : org._id;
		
		return this.collection.bulkWrite([
			{ updateMany: { filter: { owners: _id }, update: { $pullAll: { owners: [ _id ] } } } },
			{ deleteOne: { filter: { _id } } }
		]);
	}
	
	replaceMap = new Map<string, string>();
	
	replaceHandlers = new Set<(fromId: string, toId: null | string) => Promise<void> | void>();
	
	async replace(fromId: string) {
		const toId = this.replaceMap.get(fromId) ?? null;
		if (toId)
			this.replaceMap.delete(fromId);
		
		for (const handler of this.replaceHandlers)
			await handler(fromId, toId);
		
	}
	
}
