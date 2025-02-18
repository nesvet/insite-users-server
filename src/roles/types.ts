import { CollectionIndexes, CollectionSchema } from "insite-db";
import { GenericAbilities } from "../abilities";


export type RoleDoc = {
	_id: Exclude<string, "root">;
	involves: Exclude<string, "root">[];
	abilities: GenericAbilities;
	title: string;
	description: string;
	meta: Record<string, unknown>;
	createdAt: number;
};

export type RolesOptions = {
	schema?: CollectionSchema;
	indexes?: CollectionIndexes;
	root?: Partial<RoleDoc>;
};
