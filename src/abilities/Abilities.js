import { basisTree } from "./tree";


function mergeTrees(target, source) {
	for (const sourceItem of source) {
		const targetItem = target.find(({ _id }) => _id === sourceItem._id);
		if (targetItem) {
			for (const key in sourceItem)
				if (key !== "_id") {
					const sourceItemField = sourceItem[key];
					if (Array.isArray(sourceItemField))
						mergeTrees(targetItem[key] ??= [], sourceItemField);
					else
						targetItem[key] = sourceItemField;
				}
		} else
			target.push(sourceItem);
	}
	
	return target;
}


export class Abilities extends Map {
	constructor(options = {}) {
		super();
		
		const {
			tree: customTree,
			basis = true
		} = options;
		
		this.tree =
			customTree ?
				basis ?
					mergeTrees(basisTree, customTree) :
					customTree :
				basisTree;
		
		this.#parse(this.tree);
		
	}
	
	#parse(list) {
		for (const ability of list) {
			this.set(ability._id, ability);
			if (ability.subAbilities)
				this.#parse(ability.subAbilities);
		}
		
	}
	
	merge(target, source) {
		for (const [ abilityId, ability ] of Object.entries(source)) {
			const schema = this.get(abilityId);
			if (schema) {
				if (schema.isInheritable !== false && ability)
					if (!target[abilityId])
						target[abilityId] = Object.deepClone(ability);
					else if (schema.params)
						for (const param of schema.params)
							if (param.isInheritable !== false && ability[param._id] !== undefined)
								if (!target[abilityId][param._id])
									target[abilityId][param._id] = Object.deepClone(ability[param._id]);
								else
									if (param.type === "number") {
										if (target[abilityId][param._id] < ability[param._id])
											target[abilityId][param._id] = ability[param._id];
									} else if (param.type === "items") {
										const targetItems = target[abilityId][param._id];
										for (const itemId of ability[param._id])
											if (!targetItems.includes(itemId))
												targetItems.push(itemId);
									}
				
				
			} else
				delete source[abilityId];
		}
		
		return target;
	}
	
	getMinimumOf(_id) {
		const schema = this.get(_id);
		if (schema.params) {
			const ability = {};
			for (const param of schema.params)
				if (param.type === "number")
					ability[param._id] = param.min ?? 0;
				else if (param.type === "items")
					ability[param._id] = [];
			
			return ability;
		}
		
		return true;
	}
	
	getMaximum() {
		return [ ...this.values() ].reduce((abilities, schema) => {
			if (schema.params) {
				const ability = {};
				for (const param of schema.params)
					if (param.type === "number")
						ability[param._id] = param.max ?? 0;
					else if (param.type === "items")
						ability[param._id] = param.items.ids();
				
				abilities[schema._id] = ability;
			} else
				abilities[schema._id] = true;
			
			return abilities;
		}, {});
	}
	
	getSchemeFor(user) {
		return (function resolve(abilities) {
			for (let i = 0; i < abilities.length; i++) {
				const schema = abilities[i];
				const userAbility = user.abilities[schema._id];
				if (userAbility) {
					if (schema.params)
						for (const param of schema.params) {
							const userParam = userAbility[param._id];
							if (param.type === "number") {
								if (param.max !== undefined)
									param.max = userParam;
							} else if (param.type === "items")
								for (let j = 0; j < param.items.length; j++)
									if (!userParam.includes(param.items[j]._id))
										param.items.splice(j--, 1);
						}
					if (schema.subAbilities)
						resolve(schema.subAbilities);
				} else
					abilities.splice(i--, 1);
			}
			
			return abilities;
		})(Object.deepClone(this.tree));
	}
	
}
