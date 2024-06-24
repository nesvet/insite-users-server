import { regexps } from "../lib";


export const basisSchema = {
	required: [
		"_id",
		"title",
		"note",
		"owners",
		"createdAt"
	],
	properties: {
		_id: {
			bsonType: "string",
			pattern: regexps._id.source
		},
		title: {
			bsonType: "string",
			maxLength: 512
		},
		note: {
			bsonType: "string",
			maxLength: 131072
		},
		owners: {
			bsonType: "array",
			uniqueItems: true,
			items: {
				bsonType: "string",
				pattern: regexps._id.source
			},
			additionalItems: false
		},
		createdAt: {
			bsonType: "number"
		}
	},
	additionalProperties: false
};
