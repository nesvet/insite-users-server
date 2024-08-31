type AbilityParamItem = string;
export type AbilityParamItems = AbilityParamItem[];
export type AbilityParamNumber = number;
export type AbilityParam = AbilityParamItems | AbilityParamNumber;

export type AbilityWithParams = Record<string, AbilityParam>;
export type AbilityBoolean = true;
export type Ability = AbilityBoolean | AbilityWithParams;
export type GenericAbilities = Record<string, Ability>;
