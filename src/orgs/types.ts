import { CollectionIndexes, CollectionSchema } from "insite-db";


export type OrgDoc = {
	_id: string;
	title: string;
	note: string;
	owners: string[];
	createdAt: number;
};

export type OrgsOptions = {
	schema?: CollectionSchema;
	indexes?: CollectionIndexes;
	null?: Partial<OrgDoc>;
};
