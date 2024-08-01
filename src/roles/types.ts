import { InSiteCollectionIndexes, InSiteCollectionSchema } from "insite-db";


export type RoleDoc = {
	_id: Exclude<string, "root">;
	involves: Exclude<string, "root">[];
	abilities: Record<string, unknown>;
	title: string;
	description: string;
	createdAt: number;
};

export type RolesOptions = {
	schema?: InSiteCollectionSchema;
	indexes?: InSiteCollectionIndexes;
	root?: Partial<RoleDoc>;
};
