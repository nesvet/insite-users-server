import { InSiteCollectionSchema } from "insite-db";
import { regexps } from "../../lib";


export const schema: InSiteCollectionSchema = {
	required: [
		"_id",
		"type",
		"size",
		"ts",
		"data"
	],
	properties: {
		_id: {
			bsonType: "string",
			pattern: regexps._id.source
		},
		type: {
			bsonType: "string",
			maxLength: 256
		},
		size: {
			bsonType: "number"
		},
		ts: {
			bsonType: "string",
			maxLength: 10
		},
		data: {
			bsonType: "binData"
		}
	},
	additionalProperties: false
};
