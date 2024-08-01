type CommonSchema = {
	_id: string;
	title?: string;
};

export type AbilityParamItemSchema = CommonSchema;

type AbilityParamItemsSchema = {
	type: "items";
	items: readonly AbilityParamItemSchema[];
	isInheritable?: boolean;
} & CommonSchema;

type AbilityParamNumberSchema = {
	type: "number";
	min?: number;
	max?: number;
	isInheritable?: boolean;
} & CommonSchema;

type AbilityParamSchema = AbilityParamItemsSchema | AbilityParamNumberSchema;

export type AbilitySchema = {
	params?: readonly AbilityParamSchema[];
	subAbilities?: AbilitiesSchema;
	isInheritable?: boolean;
} & CommonSchema;

export type AbilitiesSchema = readonly AbilitySchema[];

type ExtractParamSchemaType<PS extends AbilityParamSchema> =
	PS extends AbilityParamNumberSchema ?
		number :
		PS extends AbilityParamItemsSchema ?
			PS["items"][number]["_id"][] :
			never;

type ExtractAbilitySchemaType<AS extends AbilitySchema> =
	AS["params"] extends readonly AbilityParamSchema[] ?
		{ [K in AS["params"][number] as K["_id"]]: ExtractParamSchemaType<K> } :
		true;

type FlattenAbilitySchema<A extends AbilitySchema> =
	{ [K in A["_id"]]: ExtractAbilitySchemaType<A> } & (
		A["subAbilities"] extends AbilitiesSchema ?
			FlattenAbilitySchemas<A["subAbilities"]> :
			object
	);

export type FlattenAbilitySchemas<A extends AbilitiesSchema> =
	Partial<
		A extends readonly [ infer Head extends AbilitySchema, ...infer Tail extends AbilitiesSchema ] ?
			FlattenAbilitySchema<Head> & FlattenAbilitySchemas<Tail> :
			object
	>;

export type Abilities<A extends AbilitiesSchema> = {
	login?: boolean;
	inSite?: {
		sections: ("users")[];
	};
} & FlattenAbilitySchemas<A>;

type AbilityParamItem = string;
export type AbilityParamItems = AbilityParamItem[];
export type AbilityParamNumber = number;
export type AbilityParam = AbilityParamItems | AbilityParamNumber;

export type AbilityWithParams = Record<string, AbilityParam>;
export type AbilityBoolean = true;
export type Ability = AbilityBoolean | AbilityWithParams;
export type GenericAbilities = Record<string, Ability>;
