import { InSiteCollectionSchema } from "insite-db";
import { regexps } from "../lib";


export const basisSchema: InSiteCollectionSchema = {
	required: [
		"_id",
		"involves",
		"abilities",
		"title",
		"description",
		"createdAt"
	],
	properties: {
		_id: {
			bsonType: "string",
			pattern: regexps.role.source,
			not: { enum: [ "root" ] }
		},
		involves: {
			bsonType: "array",
			uniqueItems: true,
			items: {
				bsonType: "string",
				pattern: regexps.role.source,
				not: { enum: [ "root" ] }
			},
			additionalItems: false
		},
		abilities: {
			bsonType: "object"
		},
		title: {
			bsonType: "string",
			maxLength: 256
		},
		description: {
			bsonType: "string",
			maxLength: 10240
		},
		createdAt: {
			bsonType: "number"
		}
	},
	additionalProperties: false
};
