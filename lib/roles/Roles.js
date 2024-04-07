import { debounce } from "@nesvet/n";
import { Role } from "./Role";
import { basisSchema } from "./schema";


const indexes = [
	[ { involves: 1 } ]
];

function preventDirectDelete() {
	throw new Error("Direct usage of roles collection.deleteOne or .deleteMany is forbidden. Use roles.collectionDelete instead.");
}

function sortRoles(a, b) {
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


export class Roles extends Map {
	constructor(users, options = {}) {
		super();
		
		const {
			schema: customSchema,
			indexes: customIndexes,
			root: rootProps
		} = options;
		
		this.users = users;
		this.collections = users.collections;
		this.abilities = users.abilities;
		
		this.root = new Role(this, {
			...rootProps,
			_id: "root",
			involves: [],
			abilities: this.abilities.getMaximum(),
			title: "Root",
			description: "Root",
			createdAt: Date.now()
		});
		
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
			
			this.collection = await this.collections.ensure("roles", { jsonSchema });
			
			this.collection.ensureIndexes([ ...indexes, ...customIndexes ?? [] ]);
			
			this.collection.deleteOne =
				this.collection.deleteMany =
					preventDirectDelete;
			
			return this;
		})();
	}
	
	load(roleDoc) {
		new Role(this, roleDoc);
		
	}
	
	resolve(role, involvedBy) {
		involvedBy = [ role, ...involvedBy ];
		
		for (const involvedRoleId of role.ownInvolveIds) {
			const involvedRole = this.get(involvedRoleId);
			if (involvedRole) {
				for (const involvedByRole of involvedBy) {
					involvedByRole.involves.reAdd(involvedRole);
					this.abilities.merge(involvedByRole.inheritedAbilities, involvedRole.abilities);
				}
				if (involvedRole !== role)
					this.resolve(involvedRole, involvedBy);
			}
		}
		
	}
	
	sorted = [];
	
	async update() {
		
		const array = [ ...this.values() ];
		
		this.root.ownInvolveIds = [];
		for (const role of array) {
			if (role !== this.root && !array.some(anotherRole => anotherRole.ownInvolveIds.includes(role._id)))
				this.root.ownInvolveIds.push(role._id);
			role.involves.clear();
			role.abilities = Object.deepClone(role.ownAbilities);
			role.inheritedAbilities = {};
		}
		
		this.root.involves.add(this.root);
		this.resolve(this.root, []);
		
		for (const role of array)
			role.ownInvolves = this.getAll(role.ownInvolveIds).sort(sortRoles).reverse();
		
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
			this.abilities.merge(role.abilities, role.inheritedAbilities);
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
	
	init = async () => {
		
		for (const roleDoc of await this.collection.find().toArray())
			this.load(roleDoc);
		
		await this.update();
		
		this.collection.changeListeners.add(next => {
			switch (next.operationType) {
				case "insert":
					const role = new Role(this, next.fullDocument);
					this.users.emit("roles-role-update", role, next);
					break;
				
				case "update":
				case "replace":
					this.get(next.documentKey._id).update(next.updateDescription?.updatedFields || next.fullDocument, next);
					break;
				
				case "delete":
					this.get(next.documentKey._id).delete();
					this.users.emit("roles-role-update", null, next);
			}
			
		});
		
		delete this.init;
		
	};
	
	new({ _id, involves, title, description, ...restProps }) {
		return this.collection.insertOne({
			_id,
			involves: involves || [],
			abilities: {},
			title: title ?? "",
			description: description ?? "",
			...Object.delete(restProps, "abilities"),
			createdAt: Date.now()
		});
	}
	
	collectionDelete(role) {
		const _id = typeof role == "string" ? role : role._id;
		
		return this.collection.bulkWrite([
			{ updateMany: { filter: { involves: _id }, update: { $pullAll: { involves: [ _id ] } } } },
			{ deleteOne: { filter: { _id } } }
		]);
	}
	
	cleanUpIds(ids) {
		const roles = this.sorted.intersection(this.getAll(ids));
		
		const cleanedUpIds = [];
		
		for (const role of roles)
			if (roles.every(anotherRole => anotherRole === role || !anotherRole.involves.has(role)))
				cleanedUpIds.push(role._id);
		
		return cleanedUpIds;
	}
	
}
