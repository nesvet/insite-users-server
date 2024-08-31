import {
	debounce,
	deleteProps,
	getAll,
	intersection,
	reAdd,
	removeAll
} from "@nesvet/n";
import type { AbilitiesSchema } from "insite-common";
import type { InSiteCollectionIndexes, InSiteWatchedCollection } from "insite-db";
import type { GenericAbilities } from "../abilities/types";
import type { Users } from "../users";
import { Role } from "./Role";
import { basisSchema } from "./schema";
import type { RoleDoc, RolesOptions } from "./types";


const indexes: InSiteCollectionIndexes = [
	[ { involves: 1 } ]
];

function preventDirectDelete() {
	throw new Error("Direct usage of roles collection.deleteOne or .deleteMany is forbidden. Use roles.collectionDelete instead.");
}


export class Roles<AS extends AbilitiesSchema = AbilitiesSchema> extends Map<string, Role<AS>> {
	constructor(users: Users<AS>, options: RolesOptions = {}) {
		super();
		
		const {
			root: rootProps,
			...initOptions
		} = options;
		
		this.users = users;
		this.collections = users.collections;
		this.abilitiesMap = users.abilitiesMap;
		
		this.root = new Role<AS>(this, {
			...rootProps,
			_id: "root",
			involves: [],
			abilities: this.abilitiesMap.getMaximum(),
			title: "Root",
			description: "Root",
			createdAt: Date.now()
		});
		
		this.initOptions = initOptions;
		
	}
	
	users;
	collections;
	collection!: {
		/** @deprecated Direct usage of roles collection.deleteOne is forbidden. Use roles.collectionDelete instead. */
		deleteOne: typeof preventDirectDelete;
		
		/** @deprecated Direct usage of roles collection.deleteMany is forbidden. Use roles.collectionDelete instead. */
		deleteMany: typeof preventDirectDelete;
	} & InSiteWatchedCollection<RoleDoc>;
	
	abilitiesMap;
	root;
	initOptions?;
	
	load(roleDoc: RoleDoc) {
		new Role<AS>(this, roleDoc);
		
	}
	
	resolve(role: Role<AS>, involvedBy: Role<AS>[]) {
		involvedBy = [ role, ...involvedBy ];
		
		for (const involvedRoleId of role.ownInvolveIds) {
			const involvedRole = this.get(involvedRoleId);
			if (involvedRole) {
				for (const involvedByRole of involvedBy) {
					reAdd(involvedByRole.involves, involvedRole);
					this.abilitiesMap.merge(involvedByRole.inheritedAbilities as GenericAbilities, involvedRole.abilities as GenericAbilities);
				}
				if (involvedRole !== role)
					this.resolve(involvedRole, involvedBy);
			}
		}
		
	}
	
	sorted: Role<AS>[] = [];
	
	private sortRoles(a: Role<AS>, b: Role<AS>) {
		return (
			(b.involves.size - a.involves.size) || (
				(a.title && b.title) ?
					a.title > b.title ? 1 : a.title < b.title ? -1 : 0 :
					a.title ?
						-1 :
						b.title ?
							1 :
							a._id > b._id ?
								1 :
								a._id < b._id ?
									-1 :
									0
				
			)
		);
	}
	
	update() {
		
		const array = [ ...this.values() ];
		
		this.root.ownInvolveIds = [];
		for (const role of array) {
			if (role !== this.root && !array.some(anotherRole => anotherRole.ownInvolveIds.includes(role._id)))
				this.root.ownInvolveIds.push(role._id);
			role.involves.clear();
			role.abilities = structuredClone(role.ownAbilities);
			role.inheritedAbilities = {};
		}
		
		this.root.involves.add(this.root);
		this.resolve(this.root, []);
		
		for (const role of array)
			role.ownInvolves = getAll(this, role.ownInvolveIds, true).sort(this.sortRoles).reverse();
		
		const sorted = [ this.root ];
		
		for (let i = 0; i < sorted.length; i++) {
			const role = sorted[i];
			for (const involvedRole of role.ownInvolves) {
				const involvedRoleIndex = sorted.indexOf(involvedRole);
				if (~involvedRoleIndex) {
					sorted.splice(involvedRoleIndex, 1);
					i--;
				}
				sorted.splice(i + 1, 0, involvedRole);
			}
		}
		
		let _o = 0;
		for (const role of sorted) {
			this.abilitiesMap.merge(role.abilities as GenericAbilities, role.inheritedAbilities as GenericAbilities);
			role._o = _o++;
		}
		
		this.sorted = sorted;
		
		this.users.emit("roles-update");
		
		if (this.users.isInited) {
			this.users.updateDebounced.clear();
			this.users.update(true);
		}
		
	}
	
	updateDebounced = debounce(this.update, 250);
	
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
			await this.collections.ensure<RoleDoc>("roles", { jsonSchema }),
			{
				deleteOne: preventDirectDelete,
				deleteMany: preventDirectDelete
			}
		);
		
		this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
		
		for (const roleDoc of await this.collection.find().toArray()) {
			if (this.abilitiesMap.adjust(roleDoc.abilities))
				await this.collection.updateOne({ _id: roleDoc._id }, { $set: { abilities: roleDoc.abilities } });
			
			this.load(roleDoc);
		}
		
		this.update();
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert": {
					const role = new Role<AS>(this, next.fullDocument);
					this.users.emit("roles-role-update", role, next);
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
					this.users.emit("roles-role-update", null, next);
			}
			
		});
		
		delete this.initOptions;
		delete this.init;
		
	};
	
	new({ _id, involves, title, description, ...restProps }: Omit<RoleDoc, "abilities" | "createdAt">) {
		return this.collection.insertOne({
			_id,
			involves: involves || [],
			abilities: {},
			title: title ?? "",
			description: description ?? "",
			...deleteProps(restProps, [ "abilities" ]),
			createdAt: Date.now()
		});
	}
	
	collectionDelete(role: Role<AS> | string) {
		const _id = typeof role == "string" ? role : role._id;
		
		return this.collection.bulkWrite([
			{ updateMany: { filter: { involves: _id }, update: { $pullAll: { involves: [ _id ] } } } },
			{ deleteOne: { filter: { _id } } }
		]);
	}
	
	cleanUpIds(ids: string[]) {
		const roles = intersection(this.sorted, getAll(this, ids, true));
		
		const cleanedUpIds = [];
		
		for (const role of roles)
			if (roles.every(anotherRole => anotherRole === role || !anotherRole.involves.has(role)))
				cleanedUpIds.push(role._id);
		
		return cleanedUpIds;
	}
	
}
