import { empty, intersection } from "@nesvet/n";
import type { AbilitiesSchema, AbilityParamItemSchema, AbilitySchema } from "insite-common";
import type { User } from "../users/User";
import type {
	Ability,
	AbilityParam,
	AbilityParamItems,
	AbilityParamNumber,
	AbilityWithParams,
	GenericAbilities
} from "./types";


function isAbilityWithParams(value: Ability): value is AbilityWithParams {
	return typeof value == "object";
}

function isAbilityParamNumber(value: AbilityParam): value is AbilityParamNumber {
	return typeof value === "number";
}

function isAbilityParamItems(value: AbilityParam): value is AbilityParamItems {
	return Array.isArray(value);
}


export class AbilitiesMap<AS extends AbilitiesSchema = AbilitiesSchema> extends Map<string, AbilitySchema> {
	constructor(schema: AbilitiesSchema) {
		super();
		
		this.schema = schema;
		
		this.#parse(this.schema);
		
	}
	
	schema;
	
	#parse(list: AbilitiesSchema) {
		for (const ability of list) {
			this.set(ability._id, ability);
			if (ability.subAbilities)
				this.#parse(ability.subAbilities);
		}
		
	}
	
	merge(target: GenericAbilities, source: GenericAbilities) {
		for (const [ abilityId, ability ] of Object.entries(source)) {
			const schema = this.get(abilityId);
			if (schema) {
				if (schema.isInheritable !== false && ability)
					if (!(abilityId in target))
						target[abilityId] = structuredClone(ability);
					else if (schema.params) {
						const targetAbility = target[abilityId] as AbilityWithParams;
						const sourceAbility = ability as AbilityWithParams;
						for (const param of schema.params)
							if (param.isInheritable !== false && param._id in sourceAbility)
								if (!(param._id in targetAbility))
									targetAbility[param._id] = structuredClone(sourceAbility[param._id]);
								else
									if (param.type === "number") {
										if ((targetAbility[param._id] as AbilityParamNumber) < (sourceAbility[param._id] as AbilityParamNumber))
											targetAbility[param._id] = sourceAbility[param._id];
									} else if (param.type === "items") {
										const targetItems = targetAbility[param._id] as AbilityParamItems;
										for (const itemId of sourceAbility[param._id] as AbilityParamItems)
											if (!targetItems.includes(itemId))
												targetItems.push(itemId);
									}
					}
			} else
				delete source[abilityId];
		}
		
		return target;
	}
	
	getMinimumOf(_id: string) {
		const schema = this.get(_id);
		if (schema?.params) {
			const ability: Ability = {};
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
		return [ ...this.values() ].reduce((abilities: GenericAbilities, schema: AbilitySchema) => {
			if (schema.params) {
				const ability: Ability = {};
				for (const param of schema.params)
					if (param.type === "number")
						ability[param._id] = param.max ?? 0;
					else if (param.type === "items")
						ability[param._id] = param.items.map(item => item._id);
				
				abilities[schema._id] = ability;
			} else
				abilities[schema._id as keyof typeof abilities] = true;
			
			return abilities;
		}, {});
	}
	
	getSchemeFor(user: User<AS>) {
		return (function resolve(abilitiesSchema: AbilitySchema[]) {
			for (let i = 0; i < abilitiesSchema.length; i++) {
				const schema = abilitiesSchema[i];
				const userAbility = user.abilities[schema._id as keyof typeof user.abilities];
				if (userAbility) {
					if (schema.params)
						for (const param of schema.params) {
							const userParam = (userAbility as AbilityWithParams)[param._id];
							if (param.type === "number") {
								if ("max" in param)
									param.max = userParam as number;
							} else if (param.type === "items")
								for (let j = 0; j < param.items.length; j++)
									if (!(userParam as AbilityParamItems).includes(param.items[j]._id))
										(param.items as AbilityParamItemSchema[]).splice(j--, 1);
						}
					if (schema.subAbilities)
						resolve(schema.subAbilities as AbilitySchema[]);
				} else
					abilitiesSchema.splice(i--, 1);
			}
			
			return abilitiesSchema;
		})(structuredClone(this.schema) as AbilitySchema[]);
	}
	
	adjust(abilities: GenericAbilities) {
		const adjustedAbilities: Record<string, unknown> = {};
		let isAdjusted = false;
		
		for (const [ _id, ability ] of Object.entries(abilities) as [ string, Ability ][]) {
			const abilitySchema = this.get(_id);
			if (abilitySchema)
				if (abilitySchema.params) {
					const adjustedAbility: AbilityWithParams = {};
					
					if (isAbilityWithParams(ability)) {
						for (const paramSchema of abilitySchema.params)
							if (paramSchema._id in ability) {
								let paramValue = ability[paramSchema._id];
								if (paramSchema.type === "number") {
									if (!isAbilityParamNumber(paramValue))
										paramValue = (paramSchema.min ?? 0) as AbilityParamNumber;
									
									const adjustedParamValue =
										adjustedAbility[paramSchema._id] =
											Math.max(Math.min(paramValue, paramSchema.max ?? Infinity), paramSchema.min ?? 0);
									
									if (paramValue !== adjustedParamValue)
										isAdjusted = true;
								} else if (paramSchema.type === "items") {
									if (!isAbilityParamItems(paramValue))
										paramValue = [] as AbilityParamItems;
									
									const adjustedParamValue =
										adjustedAbility[paramSchema._id] =
											intersection(paramSchema.items.map(item => item._id), paramValue);
									
									if (paramValue.length !== adjustedParamValue.length || paramValue.some(paramId => !adjustedParamValue.includes(paramId)))
										isAdjusted = true;
								}
							}
					} else {
						for (const paramSchema of abilitySchema.params)
							if (paramSchema.type === "number")
								adjustedAbility[paramSchema._id] = paramSchema.min ?? 0;
							else if (paramSchema.type === "items")
								adjustedAbility[paramSchema._id] = [];
						
						isAdjusted = true;
					}
					
					adjustedAbilities[_id] = adjustedAbility;
				} else {
					adjustedAbilities[_id] = true;
					
					if (ability !== true)
						isAdjusted = true;
				}
			else
				isAdjusted = true;
		}
		
		if (isAdjusted) {
			Object.assign(empty(abilities), adjustedAbilities);
			
			return true;
		}
		
		return false;
	}
	
}
