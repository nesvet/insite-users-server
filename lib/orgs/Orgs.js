import { debounce } from "@nesvet/n";
import { ObjectId } from "insite-db";
import { Org } from "./Org";
import { basisSchema } from "./schema";


const indexes = [
	[ { owners: 1 } ]
];

function sortOrgs(a, b) {
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

function preventDirectDelete() {
	throw new Error("Direct usage of orgs collection.deleteOne or .deleteMany is forbidden. Use orgs.collectionDelete instead.");
}


export class Orgs extends Map {
	constructor(users, options = {}) {
		super();
		
		const {
			schema: customSchema,
			indexes: customIndexes,
			null: nullProps
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
			
			this.collection = await this.collections.ensure("orgs", { jsonSchema });
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			this.collection.deleteOne =
				this.collection.deleteMany =
					preventDirectDelete;
			
			this.null = new Org(this, {
				...nullProps,
				_id: null,
				title: "",
				displayLabel: "",
				note: "",
				owners: [],
				createdAt: Date.now()
			});
			
			this.null.ownerIds = new Array.Empty();
			this.null.ownerOrgs = new Set.Empty();
			this.null.ownerUsers = new Set.Empty();
			this.null.slaveOrgs = new Set.Empty();
			
			return this;
		})();
	}
	
	load(orgDoc) {
		new Org(this, orgDoc);
		
	}
	
	static resolve(org, slaveOrgs) {
		slaveOrgs = [ org, ...slaveOrgs ];
		
		for (const ownerOrg of org.ownerOrgs) {
			Orgs.resolve(ownerOrg, slaveOrgs);
			ownerOrg.slaveOrgs.addAll(slaveOrgs);
		}
		
	}
	
	sorted = [];
	
	async update() {
		
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
				Orgs.resolve(org, []);
		
		sorted.sort(sortOrgs);
		for (const org of array)
			org.slaveOrgs.sort(sortOrgs);
		
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
		for (let o = 0, { length } = sorted; o < length;)
			sorted[o]._o = o++;
		
		this.sorted = sorted;
		
		this.users.emit("orgs-update");
		
		if (this.users.isInited) {
			this.users.updateDebounced.clear();
			this.users.update();
		}
		
	}
	
	updateDebounced = debounce(this.update, 250);
	
	initialLoad = async () => {
		
		for (const orgDoc of await this.collection.find().toArray())
			this.load(orgDoc);
		
		delete this.initialLoad;
		
	};
	
	init = async () => {
		
		await this.update();
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert": {
					const org = new Org(this, next.fullDocument);
					this.users.emit("orgs-org-update", org, next);
					break;
				}
				
				case "update":
				case "replace":
					this.get(next.documentKey._id).update(next.updateDescription?.updatedFields || next.fullDocument, next);
					break;
				
				case "delete":
					this.get(next.documentKey._id).delete();
					this.users.emit("orgs-org-update", null, next);
			}
			
		});
		
		delete this.init;
		
	};
	
	new({ title, note, ...restProps }, ownerId) {
		return this.collection.insertOne({
			_id: (new ObjectId()).toString(),
			title,
			note: note || "",
			owners: ownerId ? [ ownerId ] : [],
			...Object.delete(restProps, "_id", "owners"),
			createdAt: Date.now()
		});
	}
	
	collectionDelete(org) {
		const _id = typeof org == "string" ? org : org._id;
		
		return this.collection.bulkWrite([
			{ updateMany: { filter: { owners: _id }, update: { $pullAll: { owners: [ _id ] } } } },
			{ deleteOne: { filter: { _id } } }
		]);
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
