import { regexps } from "../lib";


export const basisSchema = {
	required: [
		"_id",
		"email",
		"password",
		"roles",
		"name",
		"org",
		"job",
		"createdAt"
	],
	properties: {
		_id: {
			bsonType: "string",
			pattern: regexps._id.pattern
		},
		email: {
			bsonType: "string",
			pattern: regexps.email.pattern
		},
		password: {
			bsonType: "string",
			pattern: regexps.argon2.pattern
		},
		roles: {
			bsonType: "array",
			uniqueItems: true,
			items: {
				bsonType: "string",
				pattern: regexps.role.pattern
			},
			additionalItems: false
		},
		name: {
			bsonType: "object",
			required: [
				"first",
				"middle",
				"last"
			],
			properties: {
				first: {
					bsonType: "string",
					maxLength: 512
				},
				middle: {
					bsonType: "string",
					maxLength: 512
				},
				last: {
					bsonType: "string",
					maxLength: 512
				}
			},
			additionalProperties: false
		},
		org: {
			oneOf: [
				{
					bsonType: "string",
					pattern: regexps._id.pattern
				},
				{
					bsonType: "null"
				}
			]
		},
		job: {
			bsonType: "string",
			maxLength: 512
		},
		avatar: {
			oneOf: [
				{
					bsonType: "string",
					maxLength: 10
				},
				{
					bsonType: "null"
				}
			]
		},
		createdAt: {
			bsonType: "number"
		}
	},
	additionalProperties: false
};
