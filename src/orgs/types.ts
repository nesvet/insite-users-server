import { CollectionIndexes, CollectionOptions, CollectionSchema } from "insite-db";


export type OrgDoc = {
	_id: string;
	title: string;
	note: string;
	owners: string[];
	meta: Record<string, unknown>;
	createdAt: number;
};

export type OrgsOptions = {
	schema?: CollectionSchema;
	indexes?: CollectionIndexes;
	null?: Partial<OrgDoc>;
	collection?: Omit<CollectionOptions, "fullDocument" | "watch">;
};
