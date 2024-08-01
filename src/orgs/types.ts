import { InSiteCollectionIndexes, InSiteCollectionSchema } from "insite-db";


export type OrgDoc = {
	_id: string;
	title: string;
	note: string;
	owners: string[];
	createdAt: number;
};

export type OrgsOptions = {
	schema?: InSiteCollectionSchema;
	indexes?: InSiteCollectionIndexes;
	null?: Partial<OrgDoc>;
};
