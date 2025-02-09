import { CollectionSchema } from "insite-db";
import { regexps } from "../lib";


export const basisSchema: CollectionSchema = {
	required: [
		"_id",
		"user",
		"remoteAddress",
		"isOnline",
		"createdAt",
		"prolongedAt",
		"expiresAt"
	],
	properties: {
		_id: {
			bsonType: "string",
			pattern: regexps.sessionId.source
		},
		user: {
			bsonType: "string",
			pattern: regexps._id.source
		},
		userAgent: {
			bsonType: "string",
			maxLength: 4096
		},
		remoteAddress: {
			bsonType: "string",
			pattern: regexps.ip.source
		},
		isOnline: {
			bsonType: "bool"
		},
		createdAt: {
			bsonType: "number"
		},
		prolongedAt: {
			bsonType: "number"
		},
		expiresAt: {
			bsonType: "date"
		}
	}
};
