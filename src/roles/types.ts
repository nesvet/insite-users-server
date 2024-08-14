import { InSiteCollectionIndexes, InSiteCollectionSchema } from "insite-db";
import { GenericAbilities } from "../abilities";


export type RoleDoc = {
	_id: Exclude<string, "root">;
	involves: Exclude<string, "root">[];
	abilities: GenericAbilities;
	title: string;
	description: string;
	createdAt: number;
};

export type RolesOptions = {
	schema?: InSiteCollectionSchema;
	indexes?: InSiteCollectionIndexes;
	root?: Partial<RoleDoc>;
};
