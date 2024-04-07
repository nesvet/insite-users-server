import { regexps } from "../lib";


export const basisSchema = {
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
			pattern: regexps.sessionId.pattern
		},
		user: {
			bsonType: "string",
			pattern: regexps._id.pattern
		},
		userAgent: {
			bsonType: "string",
			maxLength: 4096
		},
		remoteAddress: {
			bsonType: "string",
			pattern: regexps.ip.pattern
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
	},
	additionalProperties: false
};
