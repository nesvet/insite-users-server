import { InSiteCollectionIndexes, InSiteCollectionSchema } from "insite-db";


export type SessionDoc = {
	_id: string;
	user: string;
	userAgent: string;
	remoteAddress: string;
	isOnline: boolean;
	createdAt: number;
	prolongedAt: number;
	expiresAt: Date;
	[customProp: string]: unknown;
};

export type SessionsOptions = {
	schema?: InSiteCollectionSchema;
	indexes?: InSiteCollectionIndexes;
};
